# Servidor propio

BalanceRT corre en un servidor propio con la base al lado de la app. Cada consulta tarda menos de un
milisegundo, contra las decenas de milisegundos de la base en Supabase. Supabase queda como respaldo
nocturno.

- **Servidor:** Vultr, Santiago de Chile. Plan `vc2-2c-2gb` (2 vCPU, 2 GB), Ubuntu 24.04 LTS, con las
  copias automáticas de Vultr.
- **Dirección:** https://balancert.com.ar (y www.). El dominio es de NIC Argentina, delegado al DNS de
  Vultr (`ns1.vultr.com` y `ns2.vultr.com`).
- **App:** caja de Docker (`Dockerfile`) con el usuario `balancert`, solo lectura, 700 MB como máximo.
  Escucha en `127.0.0.1:3000` y Nginx la publica con HTTPS.
- **Base:** PostgreSQL 17, que solo atiende en `127.0.0.1`. Tiene dos usuarios:
  - `balancert_dueno`: migraciones. Su conexión está en `/etc/balancert/base-dueno.env`, solo para root.
  - `balancert_web`: la app. Solo puede pasar al rol `balancert_app`, así que nunca saltea las reglas por
    fila. Su conexión está en `/etc/balancert/web.env`.
  - El dueño ve por encima de la separación por estudio (`BYPASSRLS`), igual que `postgres` en Supabase:
    las funciones `security definer` (entrar, la sesión) corren con él y sin eso no encuentran ninguna
    cuenta.
- **Secretos:** se generan en el servidor y quedan solo en `/etc/balancert`. Nunca en el repositorio.
  `CLAVE_CODIGOS` no se genera: va a mano en `web.env` y tiene que ser la misma que en producción. Si
  no, nadie puede usar el código del celular que ya configuró.

## Archivos

| Archivo | Qué hace |
|---|---|
| `preparar.sh` | Prepara el servidor desde cero. Se puede repetir. |
| `desplegar.sh` | Publica la versión guardada en git. Se corre desde la computadora. |
| `app.sh` | Prende y cambia la app. Se instala como `balancert-app`. Si la nueva no responde, vuelve sola a la anterior. |
| `copiar-de-supabase.sh` | Copia los datos de Supabase al servidor, para el ensayo y para el pase. |
| `respaldo-a-supabase.sh` | Respaldo de cada noche a las 4:30, después del pase. |

## El pase

1. Publicar en el servidor la misma versión que está en uso (`desplegar.sh`).
2. Dejar de usar la app vieja y copiar los datos (`copiar-de-supabase.sh`).
3. `touch /etc/balancert/pase-hecho` y `systemctl enable --now balancert-respaldo.timer`.
4. Desde ese momento se usa la dirección del servidor. La app vieja no se vuelve a usar: el respaldo
   pisa Supabase cada noche, después de guardar una copia si alguien la cambió.
