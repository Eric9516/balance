# 0013. Login propio, sin Supabase

- **Estado:** Aceptada
- **Fecha:** 2026-10-30
- **Relacionada:** [0011](0011-una-sola-base-para-todos-los-estudios.md)

## Contexto

La app no tenía login: trabajaba con "el único estudio" de la base. Con una sola base para todos los estudios (0011), cada pedido tiene que llegar con la persona y su estudio. El dueño del producto quiere que nada dependa de Supabase, porque la app se muda a un servidor propio (DigitalOcean con Docker). Gestión empresarial ya tiene un login propio que funciona bien y es la referencia.

## Decisión

Decisiones del dueño del producto (2026-10-30):

- **Una cuenta por estudio:** el correo es único en toda la plataforma. Al entrar, la app ya sabe de qué estudio es la persona.
- **Tres roles:** dueño (todo, incluso la gente y la configuración del estudio), contador (arma, confirma y cierra los balances) y asistente (carga datos y avisa que terminó, pero no confirma ni cierra). El aviso del asistente aparece solo en la app: no hay correos.
- **Sesión:** se cierra a las 8 horas sin uso. Con "recordar este equipo", dura 30 días en esa computadora.
- **Código del celular** (TOTP, segundo paso): obligatorio para los dueños. Contadores y asistentes lo pueden activar, y el dueño puede exigírselo a todo su estudio.
- **Contraseña olvidada:** como no hay correo, el dueño le genera una provisoria a su gente, que la cambia al entrar. Al dueño se la genera la plataforma.

Cómo (patrón de Gestión empresarial, migración `20261030180000_login_propio`):

- `public.usuarios` lleva el estudio y su regla por fila. Siempre queda un dueño activo en cada estudio.
- El esquema `acceso`, cerrado para la app, guarda las contraseñas (solo su huella Argon2id), las sesiones (solo la huella sha-256 del número al azar que viaja en la cookie) y los intentos. La app usa solo sus funciones, que son las únicas que ven más de un estudio a propósito.
- Freno a quien prueba contraseñas: 5 fallos seguidos de un correo o 30 de una dirección en 15 minutos. Mismo mensaje y mismo tiempo de respuesta si el correo no existe.
- Contraseña de al menos 12 caracteres, sin reglas de composición: lo que cuenta es el largo.

## Consecuencias

- Una copia de la base no sirve para entrar ni para leer contraseñas.
- Un contador que trabaja para dos estudios necesita dos cuentas, con correos distintos.
- Sin servicio de correo, recuperar una contraseña depende del dueño del estudio.

## Alternativas descartadas

- **Supabase Auth:** ata el login a Supabase, del que la app se va.
- **Una cuenta para varios estudios:** el dueño del producto prefirió una cuenta por estudio.
