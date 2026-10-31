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
- **Código del celular** (TOTP, segundo paso): obligatorio para los dueños. Contadores y asistentes lo pueden activar, y el dueño puede exigírselo a todo su estudio. **Por ahora apagado** (decisión del dueño del producto, 2026-10-30, hasta que la app se use con más estudios): es un interruptor de la plataforma (`acceso.ajustes.codigo_obligatorio_duenos`, migración `20261030230000`); quien ya lo configuró lo sigue usando.
- **Contraseña olvidada:** como no hay correo, el dueño le genera una provisoria a su gente, que la cambia al entrar. Al dueño se la genera la plataforma.

Cómo (patrón de Gestión empresarial, migración `20261030180000_login_propio`):

- `public.usuarios` lleva el estudio y su regla por fila. Siempre queda un dueño activo en cada estudio.
- El esquema `acceso`, cerrado para la app, guarda las contraseñas (solo su huella Argon2id), las sesiones (solo la huella sha-256 del número al azar que viaja en la cookie) y los intentos. La app usa solo sus funciones, que son las únicas que ven más de un estudio a propósito.
- Freno a quien prueba contraseñas: 5 fallos seguidos de un correo o 30 de una dirección en 15 minutos. Mismo mensaje y mismo tiempo de respuesta si el correo no existe.
- Contraseña de al menos 12 caracteres, sin reglas de composición: lo que cuenta es el largo.
- Código del celular (migración `20261030220000_codigo_del_celular`): TOTP de 6 cifras cada 30 segundos (RFC 6238), calculado con lo que trae Node. El secreto se guarda cifrado (AES-256-GCM) con `CLAVE_CODIGOS`, que no está en la base. Hasta escribir el código, la sesión queda "a medio entrar": 10 minutos, sin ver ningún dato, y 5 códigos equivocados la cierran. Un código no se acepta dos veces.
- Orden al entrar: la contraseña; si es provisoria, elegir la propia (se cierran las sesiones de los otros equipos, no la de este); si usa código, configurarlo o escribirlo; y después, la página que se había pedido.
- Desde la plataforma: `pnpm usuarios:crear` da de alta a una persona y `pnpm usuarios:rescatar` le borra el código del celular o le da una contraseña provisoria.
- **Permisos por rol** (migración `20261030235000_permisos_por_rol`): qué puede cada rol está en `src/modules/acceso/domain/permisos.ts`. La app lo controla al principio de cada acción y de cada pantalla, explica el motivo (AUTH-007) y muestra a cada uno solo lo que puede usar. La base controla lo mismo con disparadores, que leen el rol y la persona que la app declara en cada conexión desde la sesión (`app.rol`, `app.usuario`): solo el dueño cambia el estudio y su gente; contador y dueño configuran auditores, clasificaciones y secciones, confirman, autorizan el comparativo, pasan a revisión, cierran y eliminan ejercicios; el asistente carga datos y puede desconfirmar. Sin rol declarado (tareas internas y pruebas) no se limita por rol, pero la regla por estudio sigue.
- **La gente del estudio** (Configuración → Usuarios, solo el dueño, como en Gestión empresarial): la app genera la contraseña provisoria (3 grupos de 4 letras y números que no se confunden) y la muestra una sola vez. Nadie se cambia el rol, se desactiva ni se elimina a sí mismo, y a un dueño no se lo elimina sin antes cambiarle el rol. Una contraseña provisoria nueva o quitar el código del celular cierran las sesiones de esa persona.
- **Mi cuenta** (cada persona): cambia su nombre y su contraseña (pide la actual y cuenta como un intento de entrar) y cierra la sesión en los demás equipos.

## Consecuencias

- Una copia de la base no sirve para entrar ni para leer contraseñas.
- Un contador que trabaja para dos estudios necesita dos cuentas, con correos distintos.
- Sin servicio de correo, recuperar una contraseña depende del dueño del estudio.

## Alternativas descartadas

- **Supabase Auth:** ata el login a Supabase, del que la app se va.
- **Una cuenta para varios estudios:** el dueño del producto prefirió una cuenta por estudio.
