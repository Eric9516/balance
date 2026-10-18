# Patrones de código

Reglas establecidas en el proyecto. Deben seguirse en todo código nuevo para mantener coherencia y evitar bugs conocidos.

---

## 1. ActionResult — todas las Server Actions

Toda Server Action retorna `ActionResult<T>`:

```typescript
// ✅ Correcto
export async function crearAlgo(input: CreateInput): Promise<ActionResult<AlgoDTO>> {
  try {
    const parsed = CreateSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,   // ← Zod v4: .issues, no .errors
        campo: parsed.error.issues[0]?.path.join('.'),
      })
    }
    const estudioId = await getCurrentEstudioId()
    const algo = await createAlgo(estudioId, parsed.data)
    revalidatePath('/...')
    return actionOk(algo)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'algo', operacion: 'crear' }))
  }
}
```

En el cliente:
```typescript
const result = await crearAlgo(values)
if (!result.ok) { toastError(result.error); return }
toastSuccess('Creado correctamente')
router.push('/...')
```

---

## 2. Zod v4: `.issues` no `.errors`

```typescript
// ✅ Correcto (Zod v4)
parsed.error.issues[0]?.message

// ❌ Incorrecto (Zod v3)
parsed.error.errors[0]?.message
```

---

## 3. Fechas en formularios: z.string() + conversión en repository

El problema: `z.coerce.date()` produce tipo `Date`, pero React Hook Form y los inputs HTML siempre manejan strings. El resolver de Zod entra en conflicto de tipos con RHF.

```typescript
// ✅ En el schema Zod
fechaInicio: z.string().min(1, 'Requerida'),
fechaCierre: z.string().min(1, 'Requerida'),
fechaInscripcion: z.string().optional(),

// ✅ En el repository
fechaInicio: new Date(input.fechaInicio),
fechaCierre: new Date(input.fechaCierre),
fechaInscripcion: input.fechaInscripcion ? new Date(input.fechaInscripcion) : null,

// ✅ En el Form (defaultValues)
function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]  // → "2025-12-31"
}
fechaInicio: toDateInputValue(defaultValues.fechaInicio),
```

**Nunca usar `z.coerce.date()` en schemas que se usen con RHF.**

---

## 4. Números en formularios: z.string() + conversión en repository

Mismo patrón que las fechas:

```typescript
// ✅ En el schema
numeroEjercicio: z.string().optional(),
indiceInflacionAnterior: z.string().optional(),

// ✅ En el repository
function parseOptionalInt(val?: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}
function parseOptionalDecimal(val?: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

// ✅ En el Form (defaultValues)
numeroEjercicio: defaultValues.numeroEjercicio != null ? String(defaultValues.numeroEjercicio) : '',
```

**No usar `z.coerce.number()` ni `{ valueAsNumber: true }` en RHF — genera conflictos de tipos.**

---

## 5. Boolean optional: z.boolean().optional(), no .default()

```typescript
// ✅ Correcto
esDefault: z.boolean().optional(),

// ❌ Incorrecto — genera conflicto de tipos con RHF
esDefault: z.boolean().default(false),
```

En el repository, chequear explícitamente:
```typescript
if (input.esDefault === true) { ... }
```

---

## 6. DTO mapper: conversión de Prisma.Decimal

Los campos `Decimal` de Prisma llegan como `Prisma.Decimal`, no como `number`. Siempre convertir en el mapper:

```typescript
// ✅ Correcto
indiceInflacionAnterior: e.indiceInflacionAnterior != null ? Number(e.indiceInflacionAnterior) : null,

// ❌ Incorrecto — Prisma.Decimal no es number
indiceInflacionAnterior: e.indiceInflacionAnterior,
```

---

## 7. Formato de fechas UTC — evitar timezone shifts

Los `DateTime` de Prisma se almacenan en UTC. Cuando se hace `new Date("2025-12-31")` en JavaScript, se crea `2025-12-31T00:00:00.000Z` (UTC).

Para mostrar la fecha correctamente sin que el timezone del servidor la desplace:

```typescript
// ✅ Correcto — usa UTC
function formatFecha(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

// ❌ Puede dar un día menos en ciertos timezones
d.getDate() // usa timezone local del servidor
```

---

## 8. Transacción Prisma para esDefault

Cuando se establece un "default" único entre múltiples registros del mismo estudio:

```typescript
// ✅ Transacción interactiva de Prisma
if (input.esDefault === true) {
  const a = await db.$transaction(async (tx) => {
    await tx.auditor.updateMany({
      where: { estudioId, id: { not: id } },  // excluir el propio al editar
      data: { esDefault: false },
    })
    return tx.auditor.update({ where: { id }, data })
  })
  return toAuditorDTO(a)
}
```

---

## 9. Estructura de módulo — siempre la misma

```
módulo/
├── schemas/          # Zod — lo que viene del formulario
├── domain/types.ts   # DTO — lo que circula en la app
├── repository/       # Acceso a DB — solo queries Prisma
├── actions/          # Server Actions — validan + llaman repo + revalidatePath
├── components/       # React components
└── index.ts          # Re-exports públicos
```

Nunca poner queries de DB en los Server Actions. Nunca poner lógica de negocio en el repository.

---

## 10. Soft delete vs hard delete

**Por defecto: soft delete** con `activo: Boolean`.  
Los modelos con ciclo de vida (Estudio, Sociedad, Auditor) usan `activo: false` para "eliminar".

**Excepción — hard delete para ejercicios en BORRADOR:**  
`EjercicioContable` usa hard delete porque tiene `estado` como mecanismo de ciclo de vida, no `activo`. Pero solo se permite eliminar si `estado === 'BORRADOR'`. Una vez iniciado el proceso, no se puede borrar.

---

## 11. Máquina de estados — EjercicioContable

Las transiciones válidas están definidas en `ejercicio.actions.ts`:

```typescript
const VALID_TRANSITIONS: Record<EstadoEjercicio, EstadoEjercicio[]> = {
  BORRADOR:    ['EN_PROCESO'],
  EN_PROCESO:  ['REVISION'],
  REVISION:    ['CERRADO', 'EN_PROCESO'],   // puede volver atrás
  CERRADO:     [],                           // terminal
}
```

La validación ocurre en el Server Action, no en el componente. El componente solo muestra los botones disponibles.

---

## 12. Convención de nombres

| Cosa | Convención | Ejemplo |
|---|---|---|
| Server Actions | verbo + entidad en español | `crearAuditor`, `actualizarSociedad` |
| Repository functions | verbo en inglés | `createAuditor`, `findSociedadById` |
| DTO types | NombreDTO | `AuditorDTO`, `EjercicioContableDTO` |
| Mapper functions | toNombreDTO | `toAuditorDTO`, `toEjercicioDTO` |
| Schemas | CreateNombreSchema, UpdateNombreSchema | `CreateAuditorSchema` |
| Components | NombrePascalCase | `AuditorForm`, `EjercicioTable` |
| DB models | singular PascalCase (Prisma) | `Auditor`, `EjercicioContable` |
| DB tables | plural snake_case (@@map) | `auditores`, `ejercicios_contables` |

---

## 13. revalidatePath — apuntar a ruta específica

```typescript
// ✅ Ruta específica cuando tenemos el ID
revalidatePath(`/sociedades/${sociedadId}/ejercicios`)

// ✅ Ruta genérica para módulos sin subpáginas
revalidatePath('/auditores')
revalidatePath('/sociedades')
```

No usar `revalidatePath('/')` ni `revalidatePath('/', 'layout')` — demasiado amplio.

---

## 14. getCurrentEstudioId — siempre desde Server Actions y pages

```typescript
// ✅ En Server Actions
const estudioId = await getCurrentEstudioId()

// ✅ En pages (Server Components)
const estudioId = await getCurrentEstudioId()
const auditores = await findAuditoresByEstudio(estudioId)
```

No pasar `estudioId` como prop desde el layout. Llamar directo donde se necesita (está cacheado con `React.cache`).

---

## 15. Ejercicio anterior: modo único, política única, servidor que sanea

- `modoAnterior` (VINCULADO | MANUAL | SIN_ANTERIOR | null) es la única fuente de verdad. No leer `ejercicioAnteriorId` sin pasar por `idAnteriorDerivable()` (solo devuelve el id en VINCULADO).
- Lo que entra a estados/anexos desde el anterior pasa por `comparativo-manual/lib/politica.ts`. Nunca mezclar derivado y manual a mano en una página.
- Lo bloqueado (saldos de inicio del E.E.P.N., inicio del Anexo I, existencia inicial del Anexo II) se **sanea en la action** con las funciones `aplicarArrastre*` del dominio: el cliente puede mandar cualquier cosa, el servidor guarda lo derivado.
- Toda escritura sobre la columna "Ejercicio anterior" en MANUAL llama a `marcarComparativoModificado()` (anula la autorización y desconfirma estados).
- Confirmar/avanzar estado pasa por `compuertaAutorizacion()`; devuelve `NEG-030` con el primer bloqueante y cuántos más hay.
- Importes arrastrados en UI: `CeldaBloqueada` (candado), nunca un input disabled.

```typescript
// ✅ En una action que guarda un anexo
const arrastre = aplicarArrastreCostoVentas(datos, anterior, modoEfectivo(ejercicio))
await upsertCostoVentas(ejercicioId, arrastre.datos ?? datos)
```

---

## 16. Pruebas de integración contra PostgreSQL

`npm run test:int` usa `vitest.integration.config.mts`: archivos `*.itest.ts`, base `balancert_test` (se crea, migra desde cero y trunca en el globalSetup). `next/cache` y `next/navigation` se mockean con `vi.mock`. Las unitarias (`npm test`) siguen sin base.

---

## 17. Prisma generate obligatorio después de migrate

```bash
npx prisma migrate dev --name nombre_migracion
npx prisma generate  # ← SIEMPRE después de migrate
```

Sin el `generate`, TypeScript no reconoce los campos nuevos y da errores de tipo aunque la DB ya esté actualizada.
