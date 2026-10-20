@AGENTS.md
# Instrucciones del proyecto BalanceRT

Este proyecto debe construirse con mentalidad de crecimiento, modularidad, mantenibilidad y escalabilidad.

## Visión y estándar de calidad (FUNDAMENTAL)

BalanceRT es un producto para **vender a estudios contables**. El estándar es ser lo mejor en absolutamente todo: arquitectura, base de datos, seguridad, velocidad, pruebas y experiencia de uso.

- **La base de datos es uno de los puntos fuertes del producto.** Tiene que ser robusta, segura, rápida y eficaz, y nunca puede quedar chica.
- **Pensar siempre en escala.** La app va a ser muy grande: muchísimos estudios, sociedades, ejercicios, cuentas y archivos. Todo se diseña para que a ese volumen siga rápida.
- **Buscar SIEMPRE optimizaciones de velocidad de la base**, en cada cambio, y señalarlas aunque no se hayan pedido.
- **Tecnología y procesos actuales.** Usar la última versión estable de cada herramienta que cumpla la antigüedad mínima de pnpm. Nada experimental sin probar.
- **Sobredimensionar con criterio** (concilia el principio 8): lo que es caro de cambiar después se hace grande desde ya (identidad, claves, tipos, auditoría, versionado, modelo por estudio). Lo que es barato de agregar (réplicas, particiones, cachés) se agrega cuando una medición lo pida.

## Regla primordial: jamás se redondea nada (OBLIGATORIA)

Decisión del dueño del producto (2026-10-19): **jamás se redondea absolutamente nada.** Ni importes, ni totales, ni líneas antes de sumar, ni al guardar en la base, ni índices o coeficientes.

- Toda cuenta con importes usa `@/lib/importe`, que no redondea.
- Prohibido `toFixed`, `Math.round`, `Math.floor`, `Math.ceil`, `Math.trunc`, `toDecimalPlaces` o `toDP` en código nuevo. `src/lib/sin-redondeos.test.ts` falla si aparece uno; los usos existentes están listados ahí con su motivo.
- Para mostrar un importe completo, sin redondear: `formatCurrency(valor, { decimales: 'todos' })`. Es obligatorio en mensajes de control y de error, donde la diferencia puede estar en el tercer decimal.
- La base no redondea al guardar: toda columna `Decimal` se declara `@db.Decimal`, sin precisión ni escala (numeric sin escala). `Decimal(18,2)` redondearía en silencio a 2 decimales y `Decimal(30)` a enteros. Cada columna de importe lleva un CHECK de rango `<tabla>_<columna>_rango` (menos de 16 dígitos enteros; índices, menos de 12) que además rechaza NaN e infinito. Ver la migración `20261019163923_importes_sin_redondeo`.
- **Presentación (decidido por el dueño del producto, 2026-10-19):** la pantalla y el documento muestran los importes con 2 decimales (`formatCurrency` por defecto). Es solo cómo se ven: los cálculos, los totales y la base usan siempre el valor completo, y al editar una celda se ve el valor completo.
- **Coeficiente de reexpresión (decidido por el dueño del producto, 2026-10-19):** se muestra con 2 decimales (`formatCoeficiente`) y se calcula SIEMPRE con el valor completo (`dividir`). Nunca se multiplica por el coeficiente mostrado. Calcular con un coeficiente cortado cambia los importes: es una regla contable y no se aplica sin el dueño del producto.
- Ante cualquier caso en que parezca necesario redondear: preguntar antes.

## Principios obligatorios

1. Mantener modularidad.
2. No mezclar lógica de negocio con interfaz.
3. No duplicar reglas.
4. No romper contratos existentes.
5. Proponer cambios pequeños, verificables y reversibles.
6. Explicar riesgos si una solución compromete mantenibilidad.
7. Priorizar claridad, trazabilidad y control sobre automatización excesiva.
8. No crear soluciones gigantes innecesarias.
9. Antes de modificar código, revisar la arquitectura existente.
10. Si hay dudas sobre una regla contable, pedir confirmación antes de inventar.

## Arquitectura esperada

Separar responsabilidades en capas claras:

- UI / Frontend: pantallas, formularios y componentes visuales.
- Backend / API: endpoints, validaciones de entrada y coordinación.
- Servicios: lógica de negocio.
- Dominio contable: reglas centrales del balance.
- Repositorios: acceso a base de datos.
- Infraestructura: PDF, Excel, archivos, IA, email e integraciones externas.

La lógica contable no debe estar dentro de botones, pantallas o componentes visuales.

## Reglas para nuevas funcionalidades

Antes de implementar una nueva función, definir:

1. Qué problema resuelve.
2. Qué módulo toca.
3. Qué entidades afecta.
4. Qué reglas de negocio aplica.
5. Qué validaciones necesita.
6. Qué errores puede generar.
7. Qué permisos requiere.
8. Qué impacto tiene sobre datos existentes.
9. Cómo se prueba.
10. Qué riesgo técnico o contable tiene.

## Base de datos (OBLIGATORIA)

### Modelo de datos

Toda modificación de base de datos debe cuidar:

- Relaciones claras.
- IDs consistentes.
- Estados del proceso.
- Historial cuando corresponda.
- Auditoría de acciones importantes.
- No borrar información sensible sin control.
- Evitar campos genéricos tipo "otros", "data", "config" salvo justificación clara.
- **Fechas:** las contables son `DateTime @db.Date` (un día, sin hora) y los instantes `DateTime @db.Timestamptz(3)`. Todo campo `DateTime` nuevo declara uno de los dos (ver `docs/decisiones/0006`).
- **Nombres:** tablas y columnas en snake_case. Cada campo camelCase de `schema.prisma` lleva `@map("snake_case")`; el SQL escrito a mano usa los nombres de columna (ver `docs/decisiones/0007`).
- **Identificadores:** UUIDv7 generado por la base: `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid`, y toda referencia `@db.Uuid`. Las búsquedas por identificador que reciben datos de afuera (dirección de una página, formulario) validan con `esUuid` (`src/lib/utils/uuid.ts`) y responden "no encontrado" (ver `docs/decisiones/0008`).
- **Conexiones:** toda conexión a la base se crea con `crearPoolPg` (`src/lib/pool-pg.ts`), que fija la sesión en UTC. El adaptador de Prisma lo necesita para leer y escribir bien los instantes.

### Seguridad

- **La base es la última barrera.** Permisos, invariantes duras, inmutabilidad y auditoría se hacen cumplir en PostgreSQL (reglas por fila, CHECK, disparadores), no solo en la app. Los **cálculos contables** viven en el dominio de TypeScript: no duplicarlos en SQL.
- **Toda tabla nueva nace cerrada:** reglas por fila activadas y sin permisos para `anon` ni `authenticated` (ver la migración `20261019001827_cerrar_acceso_anonimo`). Nunca otorgarlos sin una política explícita y probada.
- **Toda función nueva** lleva `revoke execute ... from public, anon` y un `grant` solo a quien corresponda. `security definer` solo si hace falta, siempre con `set search_path`.
- **Un ejercicio CERRADO no se modifica.** Reabrirlo solo con una función que exige dueño y motivo, y que queda auditada.
- **Sin borrado físico de datos contables:** se archivan.
- **Secretos** (claves, tokens, contraseñas, `DATABASE_URL`) nunca en el repositorio ni en el chat.

### Velocidad y escala

- **Toda clave foránea lleva índice.** Los índices compuestos se diseñan según las consultas reales.
- **Sin consultas N+1:** traer en lote y solo las columnas necesarias (`select`).
- **Listas largas paginadas por cursor.** Nunca `offset` grande ni traer todo a memoria.
- **Tipos compactos y correctos:** fechas contables como fecha sin hora, marcas de tiempo con zona horaria, importes como decimal sin escala en la base (no redondea y ocupa lo mismo).
- **Toda cuenta con importes usa `@/lib/importe`** (`sumar`, `sumarPor`, `restar`, `multiplicar`, `dividir`, `comparaImportes`, y `importe()` para leer de la base). Prohibido `+`, `-`, `*`, `/` o `reduce` sueltos sobre importes. Es exacto y corta con NEG-060 por encima de 70 billones de pesos (ver `docs/decisiones/0009`).
- **Tablas que van a crecer mucho** (cuentas, historial, movimientos): claves pensadas para poder particionar sin rediseñar.
- **Los archivos no van en la base.** Excel importados, PDF emitidos, logos y firmas van a almacenamiento de objetos. En la base solo la referencia, los metadatos y su hash. Nunca base64 ni binarios en tablas.
- **Medir antes de dar por bueno:** `pnpm rendimiento` (PostgreSQL real, datos sintéticos grandes y el código real de la app; ver `docs/RENDIMIENTO.md`), `EXPLAIN` de cada consulta nueva y `pg_stat_statements` en producción. Una consulta que lee entera una tabla grande es un error.
- **Contar los viajes a la base, no solo el tiempo:** con Supabase en otra ciudad cada ida y vuelta cuesta decenas de milisegundos. Consultas independientes van en paralelo; cada `include` de Prisma agrega un viaje.
- **Transacciones cortas**, sin llamadas externas adentro.

### Migraciones

- Siempre `prisma migrate`; **nunca** `db push` sobre una base con datos. Nunca editar una migración ya aplicada: se agrega una nueva.
- Cada migración empieza con un comentario que explica qué problema resuelve y cómo revertirla.
- Tiene que correr igual en PostgreSQL común (CI, pruebas) y en Supabase: lo propio de Supabase (roles `anon`/`authenticated`, esquema `auth`) va dentro de bloques que comprueban si existe.
- Se prueba la cadena completa desde cero antes de aplicarla en producción.
- Cambios sin cortes: primero agregar, después migrar los datos, al final quitar. Los índices sobre tablas grandes se crean sin bloquear (`CONCURRENTLY`).

## Modelo de despliegue (decidido)

- **Un proyecto de Supabase por estudio** (base, login y archivos), creado con el correo del estudio y a su nombre. Puede vivir en la cuenta del estudio o en una organización propia: **el código es exactamente el mismo en los dos casos.**
- **Una instalación de la app por estudio**, con el mismo código y la misma versión para todos. Todo lo propio del estudio sale de su configuración, nunca del código.
- **Las protecciones no dependen de que el estudio no tenga las claves de administración** de su proyecto: los hashes de las versiones emitidas y del historial se guardan en un servicio central propio, la licencia se verifica en el servidor propio y un chequeo periódico compara cada base contra el esquema esperado.
- **Actualizaciones por tandas:** primero un estudio de prueba, después uno o dos reales, después el resto. Un panel central registra qué versión tiene cada estudio.

## Proyecto de referencia

`C:\Users\agus_\OneDrive\Desktop\Gestion empresarial` (en la computadora del dueño del proyecto) es la referencia de login, seguridad, robustez de la base y pruebas. Ver sus `docs/SEGURIDAD.md`, `docs/AUDITORIA-BASE-DE-DATOS.md` y `docs/PRUEBAS.md`.

- Se copian **patrones**, no tablas de negocio.
- **Nunca se modifica** ese proyecto.

## Dependencias (pnpm)

- **pnpm es el único gestor de paquetes**, con la versión fijada en `packageManager`. Nunca npm ni yarn.
- `pnpm-workspace.yaml`: solo se autorizan los scripts de instalación que hacen falta (`allowBuilds`) y no se instalan versiones publicadas hace menos de 3 días (`minimumReleaseAge`).
- `pnpm audit --prod` sin vulnerabilidades altas ni críticas.
- Los paquetes que no vienen de npm van en `vendor/`, con su origen y su huella en `vendor/LEEME.md`.

## Hoja de ruta de la base de datos

Actualizar esta lista al terminar cada fase. Cada fase se hace en avances chicos, probados y reversibles.

- **Urgente (hecho, 2026-10-19):** cierre del acceso anónimo, paso a pnpm, Next 16.4.2, SheetJS 0.20.3 y Prisma como dependencia de desarrollo.
- **Hecho, 2026-10-19:** registro de decisiones (`docs/decisiones`), medición con `pnpm rendimiento` y línea base (`docs/RENDIMIENTO.md`), índices para todas las claves foráneas y lecturas con menos viajes a la base.
- **Hecho, 2026-10-19:** Fase 0, paso 2: fechas contables sin hora, instantes con zona horaria y sesión fijada en UTC.
- **Hecho, 2026-10-19:** Fase 0, paso 3: columnas en snake_case.
- **Hecho, 2026-10-19:** Fase 0, paso 4: claves UUIDv7 generadas por la base (base 19% más chica en la escala media).
- **Hecho, 2026-10-19:** Fase 0, paso 5: importes con aritmética exacta en todo el código, sin redondeos, y columnas de importes e índices sin escala en la base (antes redondeaban a 2 y 6 decimales al guardar).
- **Fase 0, decisiones irreversibles** mientras hay pocos datos: claves UUIDv7, fechas contables sin hora, un tipo de importe con margen amplio, columnas en snake_case, catálogo RT 54 versionado y registro de decisiones de arquitectura.
- **Fase 1, login:** Supabase Auth, roles, cuenta nueva bloqueada, nunca sin dueño y doble factor para dueños y administradores.
- **Fase 2, la base como última barrera:** roles de base separados, reglas por fila, CHECK, ejercicio cerrado inmutable, control de versión en lo editable permisos por defecto de funciones cerrados y clave foránea del ejercicio a su sociedad que incluya el estudio (hoy `crearEjercicio` usa el primer estudio activo y puede dejar un ejercicio con un estudio distinto al de su sociedad).
- **Fase 3, auditoría legal:** historial solo de agregado, particionado por mes, cadena de hashes, retención de 10 años y versión emitida con su hash.
- **Fase 4, rendimiento y escala:** metas de volumen escritas y medidas con datos sintéticos.
- **Fase 5, pruebas al nivel de la referencia:** matriz de permisos, pgTAP, deriva de esquema, escala, concurrencia, mutación y pantalla con accesibilidad.
- **Fase 6, operación:** copias con recuperación a un punto en el tiempo, entornos separados, migraciones aplicadas desde la CI con aprobación, observabilidad, Ley 25.326, revisión OWASP ASVS y prueba de penetración externa.

## Validaciones y errores

Los errores deben ser claros y accionables.

Mal ejemplo:

"No se pudo generar el balance."

Buen ejemplo:

"No se puede generar el Estado de Situación Patrimonial porque existen 3 cuentas sin rubro asignado."

Toda validación importante debe estar en backend o dominio, no solamente en frontend.

## Proyecto contable

Este sistema no debe pensarse como una app para cargar datos solamente, sino como una plataforma para generar balances contables de forma controlada.

Debe contemplar:

- Empresas.
- Ejercicios.
- Cuentas.
- Rubros.
- Estados contables.
- Anexos.
- Notas.
- Validaciones.
- Usuarios.
- Permisos.
- Auditoría.
- Versionado de plantillas/reglas cuando corresponda.

## IA

La IA no debe decidir datos contables críticos de forma automática.

Puede usarse para:

- Analizar.
- Sugerir.
- Explicar.
- Detectar inconsistencias.
- Generar borradores.

Pero las decisiones contables importantes deben quedar bajo control del usuario/contador.

## Convención de UI — Tablas editables (OBLIGATORIA)

Toda tabla/sección con números editables (anexos, estados, notas, comparativos) usa **un único patrón**. No inventar otros controles de edición ni reimplementar guardado a mano.

**Piezas compartidas (usar siempre, no recrear):**
- `@/components/shared/useEdicionLote` — hook genérico de borrador: `Editar → editar un borrador local → Guardar (un commit) o Cancelar (descarta)`. Reemplaza cualquier guardado on-blur por celda.
- `@/components/shared/useGuardarAccion` — ejecuta una server action `ActionResult<T>` con `startTransition` + toast de error automático. Usar para altas/bajas estructurales (crear fila, eliminar fila) que sí se persisten de inmediato, fuera del borrador.
- `@/components/shared/BotonEditar` — control único: Lápiz "Editar" → en edición muestra **Cancelar** + **Guardar** (ya no "Listo"). Va **arriba a la derecha** de la tabla/sección.
- `@/components/shared/CeldaNumero` — celda de número. Fuera de edición muestra formateado ('—' si 0); en edición es input controlado que llama a `onSave` **on-blur**, pero `onSave` debe actualizar el borrador (`actualizar` de `useEdicionLote`), nunca llamar a una server action directamente.
- `@/modules/comparativo-manual/components/CeldaAnteriorEditable` → `useComparativoLote` — mismo patrón de borrador, especializado para la columna "Ejercicio Anterior" (puede mezclar varios módulos SSP/EERR/GASTOS/COSTO_VENTAS bajo un solo Guardar).
- `@/lib/utils/parseImporte` — único parseo de importes (formato AR/anglo + paréntesis = negativo). **Prohibido** `parseFloat(x.replace(',','.'))` suelto.
- `@/lib/utils/dates.formatFecha` — único formateo de fechas de cierre (UTC dd/mm/yyyy). NO usar `formatDate` (zona Buenos Aires) para fechas contables.
- `@/components/shared/CeldaBloqueada` — único modo de mostrar un importe **arrastrado del ejercicio anterior** (modo VINCULADO): candado + valor + origen en tooltip. Nunca un input deshabilitado.
- `@/components/shared/AvisosArrastre` — leyenda del candado y advertencias de fuentes faltantes en el anterior.

## Convención — Ejercicio anterior (OBLIGATORIA)

`EjercicioContable.modoAnterior` es la **única fuente de verdad** de cómo se resuelve el ejercicio anterior (`VINCULADO` | `MANUAL` | `SIN_ANTERIOR` | null = pendiente). Toda lectura del anterior pasa por `@/modules/ejercicios/domain/ejercicioAnterior` (`modoEfectivo`, `idAnteriorDerivable`) y por la política de `@/modules/comparativo-manual/lib/politica` (`mostrarColumnaAnterior`, `editarAnteriorManual`, `resolverEstados`, …). Reglas:

- **VINCULADO**: saldos de inicio y columna "Ejercicio anterior" se derivan del anterior y se bloquean. Las filas de `comparativo_manual` se ignoran y las actions las rechazan (`NEG-012`). El servidor sanea lo bloqueado al guardar (E.E.P.N., Anexo I, Anexo II) aunque el cliente mande otra cosa.
- **MANUAL**: la columna anterior se carga a mano y se **autoriza** (`comparativoAutorizadoEn/Por`). Cualquier escritura sobre esa columna la anula (`marcarComparativoModificado`).
- **SIN_ANTERIOR / pendiente**: sin columna comparativa.
- La **compuerta** `@/modules/ejercicios/services/autorizacion.service` corre antes de confirmar estados, confirmar E.E.P.N. y pasar a Revisión/Cierre. Nunca agregar una confirmación que la saltee.
- Los estados y el E.E.P.N. se cargan SOLO vía `@/modules/estados/services/estados.service.cargarEstadosConPN`.
- El Estado de Flujo de Efectivo se carga SOLO vía `@/modules/flujo-efectivo/services/flujo.service.cargarFlujo`. El efectivo al cierre (y al inicio, si hay comparativo) sale del SSP sumando los rubros con `RubroBase.esEfectivo`; nunca se toma del cliente. La compuerta exige que cuadre (AUT-050).
- Migraciones: siempre `prisma migrate`; **nunca** `db push` sobre una base con datos (ver README).

**Modelo de interacción estándar:**
1. La región arranca en modo lectura.
2. `BotonEditar` (vía `useEdicionLote`) entra en modo edición: se trabaja sobre un **borrador local**, nada se persiste todavía.
3. En edición, las `CeldaNumero` actualizan el borrador en memoria (`actualizar`), no la base de datos.
4. "Cancelar" descarta el borrador completo. "Guardar" hace **un solo commit** de todo el borrador a la vez.
5. Altas/bajas estructurales (agregar fila, eliminar fila, eliminar nota) se persisten de inmediato con `useGuardarAccion`, fuera del borrador — y deben reflejarse en él vía `sincronizar` con función (`sincronizar((prev) => ...)`), que las aplica a lo guardado y al borrador. Nunca con `actualizar`: solo cambia el borrador, que fuera de edición no se ve, y la fila nueva no aparece hasta refrescar. Lo vigila `src/components/shared/convencion-edicion.test.ts`.
6. La columna "Ejercicio Anterior" (comparativo manual) usa su **propio** `useComparativoLote` + `BotonEditar` (vía `ToggleEditarAnterior`), independiente del borrador de los valores del ejercicio actual.

**Referencias de implementación:** `CostoVentasView`, `BienesDeUsoView` (borrador a nivel tabla, array completo), `NotasView` (borrador por nota), `PatrimonioNetoView`, `GastosView`/`EstadosView` (vía `useComparativoLote`; `EstadosView` combina SSP+EERR+GASTOS en un solo borrador porque comparten un único toggle).

Toda tabla **nueva** nace con este patrón.

## Forma de trabajo

Trabajar en micro avances.

Para cada cambio:

1. Analizar antes de tocar código.
2. Proponer plan breve.
3. Implementar lo mínimo necesario.
4. Verificar que no se rompió nada.
5. Explicar qué se modificó.
6. Indicar riesgos o próximos pasos.