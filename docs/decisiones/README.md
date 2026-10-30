# Registro de decisiones de arquitectura

Cada decisión de arquitectura que sea cara de cambiar después queda escrita acá, con su motivo, en un archivo propio y numerado. Sirve para no rediscutir lo ya decidido y para que quien llegue después entienda por qué el sistema es como es.

## Cómo se escribe una

- Un archivo por decisión: `NNNN-titulo-corto.md`, con el número siguiente.
- Secciones: **Estado**, **Contexto**, **Decisión**, **Consecuencias** y **Alternativas descartadas**.
- Una decisión aceptada no se edita: si cambia, se escribe otra que la reemplaza y la vieja pasa a estado "Reemplazada por NNNN".

## Decisiones

| N° | Decisión | Estado |
|---|---|---|
| [0001](0001-un-proyecto-por-estudio.md) | Un proyecto de Supabase y una instalación de la app por estudio | Reemplazada por 0011 |
| [0002](0002-la-base-como-ultima-barrera.md) | La base hace cumplir permisos, invariantes, inmutabilidad y auditoría; los cálculos contables quedan en TypeScript | Aceptada |
| [0003](0003-base-cerrada-por-defecto.md) | La base nace cerrada a los roles de la API de Supabase | Aceptada |
| [0004](0004-pnpm-y-cadena-de-suministro.md) | pnpm con controles de cadena de suministro | Aceptada |
| [0005](0005-medir-antes-de-optimizar.md) | Sobredimensionar lo irreversible y medir el rendimiento con PostgreSQL real y datos grandes | Aceptada |
| [0006](0006-fechas-y-zona-horaria.md) | Fechas contables sin hora, instantes con zona horaria y sesión en UTC | Aceptada |
| [0007](0007-columnas-en-snake-case.md) | Columnas en snake_case | Aceptada |
| [0008](0008-claves-uuid-v7.md) | Claves UUIDv7 generadas por la base | Aceptada |
| [0009](0009-importes-exactos.md) | Importes con aritmética exacta | Aceptada |
| [0010](0010-catalogo-rt54-versionado.md) | Catálogo RT 54 versionado | Propuesta |
| [0011](0011-una-sola-base-para-todos-los-estudios.md) | Una sola app y una sola base para todos los estudios, con la separación impuesta por la base | Aceptada |
| [0012](0012-catalogo-propio-de-cada-estudio.md) | Cada estudio con su propio catálogo de clasificaciones, copiado del oficial al crearse | Aceptada |
| [0013](0013-login-propio.md) | Login propio sin Supabase: una cuenta por estudio, tres roles, sesiones de 8 horas o 30 días y código del celular para dueños | Aceptada |
