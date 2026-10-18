# Historial de sprints

Cada sprint tiene: qué se hizo, archivos creados/modificados, y problemas resueltos.

---

## Sprint 0 — Infraestructura base
**Fecha:** 2026-05-28

### Qué se hizo

**1. Diseño del schema completo**

Se diseñó `prisma/schema.prisma` con todos los modelos del MVP desde el principio:
- `Estudio`, `EstudioConfiguracion`, `UsuarioEstudio`
- `Sociedad`, `Auditor`
- `EjercicioContable`, `CuentaContable`, `ImportacionExcel`, `MapeoExcel`
- `RubroBase`, `RubroActivoEstudio`
- `NotaEjercicio`, `DetalleNota`, `PlantillaNota`
- `PatrimonioNetoEjercicio`, `ErrorValidacion`, `ErrorTecnicoLog`
- Todos los enums: `EstadoEjercicio`, `SeccionEERR`, `SeccionSSP`, `TipoPersona`, etc.

**2. Migraciones iniciales aplicadas**
- `20260528231210_init` — primera migración con schema completo
- `20260528232125_init` — ajuste menor posterior al init

**3. Seed de rubros**

`prisma/seed/rubros.ts` — catálogo completo de rubros contables RT 54:
- 30+ rubros cubriendo SSP (activos, pasivos, PN) y EERR (ingresos, costos, gastos)
- Cada rubro con `codigo` único, `estadoDestino`, sección correspondiente, `naturalezaEsperada` y `orden`

**4. Infraestructura técnica**

- `src/lib/db.ts` — cliente Prisma con `PrismaPg` adapter (requerido por Prisma 7)
- `src/lib/estudio-context.ts` — `getCurrentEstudioId()` y `getCurrentEstudio()` con `cache()`
- `src/lib/utils.ts` — función `cn()` para Tailwind merge
- `src/lib/utils/cuit.ts` — `validarCuit()`, `normalizarCuit()`, `formatCuit()`
- `src/lib/utils/currency.ts` — formato de moneda ARS
- `src/lib/utils/decimal.ts` — helpers para `Prisma.Decimal`
- `src/lib/utils/dates.ts` — helpers de fecha
- `src/lib/constants/balance.ts` — labels de `SeccionEERR` y `SeccionSSP`
- `src/lib/constants/navigation.ts` — nav items

**5. Sistema de errores**

`src/modules/errores/`:
- `types.ts` — `AppError`, `ActionResult<T>`, `actionOk()`, `actionError()`
- `handler.ts` — `errorHandler()` que convierte cualquier error a `AppError`
- `prisma-mapper.ts` — mapea errores Prisma (P2002 unique violation, etc.) a `AppError`
- `logger.ts` — logging con Pino
- `catalog.ts` — catálogo de errores conocidos
- `components/Toast.tsx` — `toastError()`, `toastSuccess()` con Sonner
- `components/ErrorBoundary.tsx` — React Error Boundary

**6. Componentes UI**

`src/components/ui/`: badge, button, card, input, label, select  
`src/components/layout/`: AppShell, Sidebar, PageHeader  
`src/components/shared/`: DeactivateButton (confirmación en 2 clicks)

**7. Layout y rutas base**

- `src/app/layout.tsx` — root layout con providers
- `src/app/page.tsx` — redirect a `/sociedades`
- `src/app/providers.tsx` — React Query provider
- `src/app/(main)/layout.tsx` — verifica estudio activo, envuelve con AppShell
- `src/app/setup/page.tsx` — onboarding si no hay estudio

**8. Módulos CRUD iniciales**

Para cada módulo (estudios, auditores, sociedades) se creó la estructura completa:
- Schema Zod, domain types, repository, Server Actions, Form component, Table component
- Rutas: `page.tsx`, `nuevo/page.tsx`, `[id]/editar/page.tsx`

---

## Sprint 1 — Ajustes de schema post-PDF
**Fecha:** 2026-05-29 (misma sesión que Sprint 0)

### Contexto
Se leyó el PDF `Pasos_para_tipear_balances.pdf` — manual interno del proceso completo de preparación de balances bajo RT 54.

El orden del proceso según el PDF:
> Carátula → Notas II → Bienes de Uso → Costo de Ventas → Gastos → Estado de Resultados → Evolución PN → SSP → Ajuste inflación → Re-validar → Flujo de Efectivo → Nota I → Informe Auditor

### Qué se hizo

**Migración: `add_caratula_and_eerr_fields`**

Campos agregados a `SeccionEERR` (enum):
- `GASTOS_BANCARIOS`
- `IMPUESTOS_CONTRIBUCIONES`

Campos agregados a `Sociedad`:
- Todos los de carátula: `domicilioLegal`, `localidad`, `provincia`, `actividadPpal`, `actividadSecundaria`, `clasificacionRT54`, `fechaInscripcion`, `matriculaPJ`, `plazoDuracion`, `composicionCapital`

Campos agregados a `Auditor`:
- `universidad String?`

Campos agregados a `EjercicioContable`:
- `numeroEjercicio Int?`
- `fechaInformeAuditor DateTime?`

Archivos actualizados:
- `src/lib/constants/balance.ts` — nuevos labels para los 2 enums EERR agregados
- `prisma/seed/rubros.ts` — 2 nuevos rubros: `EERR-GBAN-01` (Gastos bancarios) y `EERR-IICC-01` (Impuestos y contribuciones)

---

## Sprint 1A — Mejoras UX de formularios
**Fecha:** 2026-05-29

### Qué se hizo

**Migración: `improve_forms_estudio_auditor_sociedad`**

Nuevos campos en `Estudio`:
- `localidad String?`, `provincia String?`

Nuevos campos en `Auditor`:
- `tituloProfesional String?`, `localidadInforme String?`, `textoFirma String?`
- `esDefault Boolean @default(false)`

Nuevos campos en `Sociedad`:
- `condicionFiscal String?`, `codigoPostal String?`, `clasificacionRT54 String?`

**Módulo Estudios**

`EstudioForm.tsx` — reescritura completa:
- Radio cards (Building2 / User icon) para tipo: "Sociedad / estudio organizado" vs "Profesional independiente"
- Secciones: tipo de estudio / datos del estudio / contacto y domicilio
- Campo `localidad` y `provincia` agregados
- CTA: "Guardar y continuar" en creación, "Guardar cambios" en edición
- Texto explicativo diferenciando estudio vs sociedad

`estudio.repository.ts` — actualizado con nuevos campos  
`domain/types.ts` — actualizado con `localidad`, `provincia`

**Módulo Auditores**

`AuditorForm.tsx` — reescritura completa:
- 3 secciones: Datos personales / Datos profesionales / Firma e informe
- Botón "Generar automáticamente" con ícono Wand2: compone `textoFirma` a partir de nombre, título, universidad, matrícula, consejo usando `useWatch`
- `textoFirma`: textarea monospace, 4 líneas
- Checkbox `esDefault` en card con descripción
- Nuevo campo `localidadInforme` con explicación ("Leones, 15 de Abril de 2026.-")

`AuditorTable.tsx` — actualizado:
- Badge "Por defecto" (variant `defecto`) en filas con `esDefault: true`
- Columna combinada "Título / Consejo"
- CUIT debajo del nombre

`auditor.repository.ts` — reescritura:
- `createAuditor`: si `esDefault=true` → transacción que primero hace `updateMany` para quitar esDefault de todos, luego crea el nuevo
- `updateAuditor`: misma lógica pero excluye el propio ID del `updateMany`
- `orderBy`: `[{ esDefault: 'desc' }, { apellido: 'asc' }, { nombre: 'asc' }]`

`auditor.schemas.ts`:
- Usamos `z.boolean().optional()` para `esDefault` (NO `z.boolean().default(false)` — ver patrones.md)

`badge.tsx` — nuevo variant `defecto: 'bg-blue-50 text-blue-700 ring-blue-200'`

**Módulo Sociedades**

`SociedadForm.tsx` — reescritura completa:
- `tipoPersona` como `<Select>` (JURIDICA / FISICA)
- `useWatch` en `tipoPersona` para lógica condicional `esFisica`
- FISICA: muestra `condicionFiscal`, oculta `tipoSocietario` / `plazoDuracion` / `composicionCapital`
- JURIDICA: muestra `tipoSocietario`, todos los campos registrales
- Labels dinámicos: "Nombre y apellido" vs "Razón social", "Domicilio fiscal" vs "Domicilio legal", etc.
- Secciones: Identificación / Domicilio / Actividad / Datos contables / Datos registrales
- Select `clasificacionRT54` (PyME pequeña / PyME mediana / Otra entidad)

`SociedadTable.tsx` — reescritura:
- Nombre es Link a `/sociedades/${id}/ejercicios` (ya conectado con ejercicios)
- Botón "Ejercicios" con ícono FolderOpen
- Columna cabecera: "Cliente" en lugar de "Razón social"
- Muestra `localidad` y `tipoSocietario` / `condicionFiscal` como subtítulo

`sociedad.repository.ts` — refactor con helper `buildData()` compartido entre create y update

`TIPO_PERSONA_LABELS` actualizado: `JURIDICA: 'Persona jurídica'`, `FISICA: 'Persona física'`

### Problemas resueltos en Sprint 1A

**`z.coerce.date()` incompatible con RHF**
- Error: "Two different types with this name exist, but they are unrelated"
- Causa: `z.coerce.date()` produce `Date`, pero el input HTML siempre devuelve `string`; el resolver de RHF no puede reconciliar los tipos
- Solución: usar `z.string().optional()` para campos de fecha en todos los schemas; convertir a `Date` en el repository con `new Date(input.fechaInscripcion)`

**`z.boolean().default(false)` incompatible con RHF**
- Error de tipo en `useForm<CreateAuditorInput>`
- Causa: `z.boolean().default(false)` infiere `boolean` pero RHF internamente trata el campo como `boolean | undefined`
- Solución: usar `z.boolean().optional()` y en el repository verificar `input.esDefault === true`

**`balance.ts` no editable**
- Error: el archivo tenía caracteres multi-byte UTF-8 (ó, á) que el Edit tool no podía matchear
- Solución: usar Write tool (reescritura completa del archivo)

**Campos nuevos no reconocidos por TypeScript antes de `generate`**
- Error: TypeScript no ve los campos nuevos hasta que se regenera el cliente
- Solución: siempre correr `npx prisma generate` después de `prisma migrate dev`

---

## Sprint 1B — CRUD EjercicioContable
**Fecha:** 2026-05-29

### Qué se hizo

**Migración: `add_ejercicio_inflacion_fields`**

Nuevos campos en `EjercicioContable`:
- `clasificacionEntidad String?` — clasificación por ejercicio (puede diferir de la del cliente)
- `indiceInflacionAnterior Decimal? @db.Decimal(10,6)` — IPIM al inicio del período
- `indiceInflacionActual Decimal? @db.Decimal(10,6)` — IPIM al cierre del período
- El coeficiente anual se calcula como `indiceActual / indiceAnterior` (no se persiste, se computa)

**Módulo `src/modules/ejercicios/`** — creado desde cero

`schemas/ejercicio.schemas.ts`:
- Todos los campos numéricos y de fecha como `z.string().optional()` (patrón del proyecto)
- Fechas: `fechaInicio` (required), `fechaCierre` (required), `fechaInformeAuditor` (optional)
- Números: `numeroEjercicio`, `indiceInflacionAnterior`, `indiceInflacionActual` como strings, convertidos en el repo

`domain/types.ts`:
- `EjercicioContableDTO` con todos los campos + `auditorNombre: string | null` (join)
- `ESTADO_LABELS` — labels en español para cada estado
- `ESTADO_BADGE_VARIANTS` — mapeo de estado a variant del Badge
- `CLASIFICACION_ENTIDAD_OPTIONS` — array de opciones
- `toEjercicioDTO(e: WithAuditor)` — mapper que convierte `Prisma.Decimal` a `number`

`repository/ejercicio.repository.ts`:
- `buildData()` helper con `parseOptionalInt()`, `parseOptionalDecimal()` y `buildDenominacion()`
- `buildDenominacion()` genera "Ejercicio al DD/MM/YYYY" usando UTC para evitar timezone shifts
- `findEjerciciosBySociedad()` — join con auditor, orderBy fechaCierre desc
- `findEjercicioById()` — con join auditor
- `createEjercicio(sociedadId, estudioId, input)`
- `updateEjercicio(id, input)`
- `cambiarEstado(id, estado)`
- `deleteEjercicio(id)` — hard delete (solo para BORRADOR)

`actions/ejercicio.actions.ts`:
- `crearEjercicio(sociedadId, input)`
- `actualizarEjercicio(id, sociedadId, input)`
- `avanzarEstadoEjercicio(id, sociedadId, estadoActual, nuevoEstado)` — valida transición con `VALID_TRANSITIONS`
- `eliminarEjercicio(id, sociedadId)` — verifica que sea BORRADOR antes de eliminar
- `revalidatePath` apunta a la ruta específica del cliente: `/sociedades/${sociedadId}/ejercicios`

Transiciones válidas:
```
BORRADOR → EN_PROCESO
EN_PROCESO → REVISION
REVISION → CERRADO  (o de vuelta: REVISION → EN_PROCESO)
CERRADO → (ninguna)
```

`components/EjercicioEstadoButton.tsx` — Client Component:
- Botón para avanzar/retroceder estado
- Props: `id`, `sociedadId`, `estadoActual`, `nuevoEstado`, `label`, `variant`

`components/EjercicioEliminarButton.tsx` — Client Component:
- Eliminar con confirmación en 2 clicks (mismo patrón que DeactivateButton)
- Solo disponible para BORRADOR

`components/EjercicioTable.tsx` — Server Component:
- Columnas: Ejercicio / Período / Auditor / Estado / Acciones
- Período en formato `DD/MM/YYYY → DD/MM/YYYY` (mono)
- Número de ejercicio como `#N` en gris si está seteado
- Acciones por estado:
  - BORRADOR: Editar + Iniciar + Eliminar
  - EN_PROCESO: Editar + A revisión
  - REVISION: Editar + Cerrar + Reabrir
  - CERRADO: solo Editar

`components/EjercicioForm.tsx` — Client Component:
- 6 secciones: Período / Denominación / Auditor y comparativo / Ajuste por inflación / Clasificación y cierre
- Denominación: campo opcional con placeholder dinámico y preview del valor auto-generado
- Auditor: select pre-seleccionado al `esDefault` cuando es creación
- Ejercicio anterior: se muestra solo si existen ejercicios previos del mismo cliente
- Inflación: inputs de índices + card de coeficiente calculado en tiempo real con `useWatch`
- `coefAnual = indActual / indAnterior` calculado en el componente, nunca persistido

**Rutas creadas:**

`src/app/(main)/sociedades/[id]/ejercicios/page.tsx`
- Carga sociedad (notFound si no existe) + lista de ejercicios
- Header con nombre del cliente + botón "Nuevo ejercicio" + link "← Clientes"

`src/app/(main)/sociedades/[id]/ejercicios/nuevo/page.tsx`
- Carga sociedad + auditores activos del estudio + ejercicios existentes del cliente
- Pasa todo como props a `EjercicioForm`

`src/app/(main)/sociedades/[id]/ejercicios/[ejercicioId]/editar/page.tsx`
- Carga sociedad + ejercicio (notFound si alguno no existe)
- Carga auditores + todos los ejercicios del cliente (excluyendo el actual para la lista de comparativos)
- `generateMetadata` dinámica con nombre del ejercicio

---

## Sprint 6 — Ejercicio anterior, saldos de inicio y compuerta RT 54
**Fecha:** 2026-10-18

### Qué se hizo

**Migraciones**
- `20261018000323_regularizar_schema_actual` — idempotente; lleva al historial todo lo que se había aplicado con `db push` (rubros_grupo, comparativo_manual, documentos_ejercicio, gasto_seccion_config, flags de confirmación, enums). README: sección "Base de datos: migraciones" con el procedimiento de baselining. Se quitó el script `db:push`.
- `20261018000622_modo_anterior_categoria_ente_transicion` — enums `ModoEjercicioAnterior`, `CategoriaEnteRT54`, `TipoAjusteTransicion`, `ComponentePN`; campos `modoAnterior`, `categoriaEnte`, `comparativoAutorizadoEn/Por` en ejercicio; `categoriaEnte` en sociedad; tabla `ajustes_transicion_rt54`; `comparativo_manual.valor` a Decimal; índices por ejercicio. Backfill de modo y categoría desde los campos legacy (que se conservan hasta una migración posterior).
- `20261018xxxxxx_indices_complementarios_y_decimal` — índices restantes y `saldoAlAceptar` a Decimal.

**Dominio (puro, con pruebas)**
- `ejercicios/domain/ejercicioAnterior.ts` — modo efectivo, invariantes, validación del vínculo (misma sociedad, fechas, ciclos, anterior ya usado), elegibles y candidato automático, efectos de cambiar el modo.
- `comparativo-manual/lib/politica.ts` — única puerta del comparativo por modo (VINCULADO ignora lo manual; MANUAL ignora lo derivado).
- `patrimonio-neto/domain/saldosInicio.ts` + `evolucion.ts`, `bienes-de-uso/domain/saldosInicio.ts`, `costo-ventas/domain/saldosInicio.ts` — arrastre y bloqueo de saldos de inicio (duro con fuente, editable con advertencia sin fuente).
- `ejercicios/domain/autorizacion.ts` — compuerta de autorización final (códigos AUT-0xx).
- `transicion-rt54/lib/generarNota.ts` — borrador de la Nota de primera aplicación RT 54 con conciliaciones.

**Servicios y actions**
- `estados/services/estados.service.ts` — `cargarEstadosConPN`, única forma de cargar estados + E.E.P.N.
- `ejercicios/services/autorizacion.service.ts` — arma el contexto, evalúa y persiste en `errores_validacion`.
- Actions: validación del vínculo al crear/editar, efectos de cambio de modo, `autorizarComparativoAction`, compuerta en confirmar estados/PN y en Revisión/Cierre, saneo de campos bloqueados en E.E.P.N./Anexo I/Anexo II, guardia `NEG-012` para carga manual fuera de MANUAL, guardado de lotes en una transacción, `React.cache` en lecturas repetidas, pool de pg configurado.

**UI**
- Paso "Ejercicio anterior" (`PasoAnteriorView`) en el stepper: checklist por bloque, cuadre del anterior, compuerta y autorización con declaración.
- Formulario de ejercicio con tres tarjetas de modo y categoría del ente; candados (`CeldaBloqueada`) en E.E.P.N., Anexo I y II; encabezados "Ejercicio actual / anterior" con fechas; tarjeta de Nota de transición en Notas; `loading.tsx`.

**Pruebas**
- Unitarias de dominio (vitest) y de integración contra PostgreSQL (`npm run test:int`, base `balancert_test`, migraciones desde cero) con los escenarios adversariales A/B.

---

## Próximos sprints planificados

### Sprint 2 — Importación Excel
- Subir archivo `.xlsx` del balance de sumas y saldos
- Configurar mapeo de columnas (código, nombre, deudor, acreedor)
- Procesar y crear `CuentaContable[]` en el ejercicio
- Vista de las cuentas importadas

### Sprint 3 — Clasificación de cuentas
- Asignar `rubroBaseId` a cada `CuentaContable`
- Vista de clasificación: cuentas sin clasificar / clasificadas
- Búsqueda y asignación masiva

### Sprint 4 — Estados contables y notas
- Generación automática de SSP, EERR, Evolución PN
- CRUD de notas y detalle de notas
- Validación de cuadre del balance

### Sprint 5 — Exportación
- Word/PDF con el formato del estudio
- Carátula con datos de la sociedad y el auditor
