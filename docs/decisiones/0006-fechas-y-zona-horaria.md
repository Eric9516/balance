# 0006. Fechas contables sin hora, instantes con zona horaria y sesión en UTC

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

- Las fechas contables (inicio, cierre e informe del auditor del ejercicio; inscripción y plazo de la sociedad) se guardaban como fecha con hora y sin zona. Un cierre al 31/12/2025 quedaba "31/12/2025 00:00" de ninguna zona: mostrado con la hora de Argentina pasa a ser 30/12/2025. Lo evitaba solo una regla del código (`formatFecha` en UTC).
- Los instantes (creado, modificado, autorizado, resuelto) se guardaban sin zona: el momento era ambiguo, y la auditoría de la Fase 3 necesita el instante exacto.
- El adaptador de Prisma (`@prisma/adapter-pg`) **asume que la sesión de PostgreSQL está en UTC**: escribe los instantes sin zona y, al leer `timestamptz`, reemplaza la zona que devuelve la base por "+00:00". Con columnas `timestamptz` y una base con otra zona por defecto, todas las horas quedarían corridas sin aviso.
- El pooler de Supabase **ignora** la zona horaria pedida al conectarse (parámetro `options`): pedida "America/Argentina/Buenos_Aires", la sesión quedó en UTC (verificado el 2026-10-19).

## Decisión

- **Fechas contables:** `DateTime @db.Date`. La base guarda el día, sin hora.
- **Instantes:** `DateTime @db.Timestamptz(3)`, con milisegundos como antes.
- **Todo campo `DateTime` nuevo declara uno de los dos.** Sin anotación, Prisma crea `timestamp` sin zona.
- **Toda conexión a la base se crea con `crearPoolPg`** (`src/lib/pool-pg.ts`): un cliente propio fija `SET TIME ZONE 'UTC'` como parte de la conexión, y el pool no la entrega hasta que terminó. Si falla, la conexión falla a la vista.
- La migración `20261019093546_fechas_sin_hora_e_instantes_con_zona` convierte los instantes guardados interpretándolos como UTC (`USING ... AT TIME ZONE 'UTC'`), que es como los escribía Prisma, sin depender de la zona de la sesión que la corra.

## Consecuencias

- Una fecha contable ya no puede correrse de día por zona horaria, ni en la base ni al leerla.
- Las comparaciones por día (superposición de ejercicios, continuidad con el anterior) son exactas: las restricciones de la Fase 2 se apoyan en esto.
- La app no depende de la zona horaria configurada en el proyecto de Supabase de cada estudio.
- Cada conexión nueva cuesta un viaje más, una sola vez: el pool reutiliza las conexiones.
- Las fechas contables ocupan 4 bytes en vez de 8, y sus índices son más chicos.

## Evidencia

- **Datos reales:** las 7 fechas contables guardadas estaban a las 00:00 en UTC, así que pasar a fecha sin hora no corrió ningún día.
- **Pruebas:** `src/test/integracion/fechas-y-zona-horaria.itest.ts` cubre el camino real del formulario, el 29 de febrero, el último día del año, instantes con milisegundos, un cliente sin UTC que ve el mismo instante absoluto y los valores por defecto de la base.
- **Prueba de la prueba:** sin la línea que fija UTC, las pruebas fallan y muestran un instante corrido 10.800.000 ms (3 horas exactas).

### Matriz de zonas horarias

El PostgreSQL de las pruebas arranca por defecto en hora argentina, no en UTC. Las 38 pruebas de integración pasaron en todas estas combinaciones:

| Zona de la app (`TZ`) | Zona de la base (`TEST_PG_TIMEZONE`) |
|---|---|
| America/Argentina/Buenos_Aires | America/Argentina/Buenos_Aires (por defecto) |
| Asia/Tokyo | Asia/Tokyo |
| Pacific/Kiritimati (UTC+14) | America/Los_Angeles (horario de verano) |
| UTC | UTC |
| America/Argentina/Buenos_Aires | Pacific/Kiritimati |
| Pacific/Pago_Pago (UTC−11) | Asia/Kolkata (UTC+5:30) |

```bash
TZ=Asia/Tokyo TEST_PG_TIMEZONE=Pacific/Kiritimati pnpm test:int
```

## Alternativas descartadas

- **Dejar los instantes sin zona:** el adaptador los maneja bien en cualquier sesión, pero el momento guardado es ambiguo para la auditoría.
- **Fijar UTC con el parámetro `options` al conectar:** el pooler de Supabase lo ignora.
- **Fijar UTC con una consulta en el evento `connect` del pool:** funciona porque pg encola las consultas, pero pg lo marca como obsoleto y lo elimina en su versión 9.
- **Fijar la zona de cada base con `ALTER DATABASE`:** depende de permisos del proyecto de Supabase y de que nadie la cambie después.
