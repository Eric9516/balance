# Stack y Arquitectura

## Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 16.2.6 | Framework full-stack (App Router) |
| React | 19.2.4 | UI |
| TypeScript | 5.x (strict) | Tipado |
| Prisma | 7.8.0 | ORM |
| PostgreSQL | — | Base de datos (Supabase) |
| Zod | 4.4.3 | Validación de esquemas |
| React Hook Form | 7.76.1 | Formularios |
| @hookform/resolvers | 5.4.0 | Integración RHF + Zod v4 |
| Tailwind CSS | 4.x | Estilos |
| Sonner | 2.x | Toasts |
| Lucide React | 1.17.0 | Íconos |
| class-variance-authority | 0.7.1 | Variantes de componentes UI |
| decimal.js | 10.6.0 | Aritmética decimal precisa |
| pg | 8.x | Driver PostgreSQL |
| @prisma/adapter-pg | 7.8.0 | Adapter para Prisma 7 con pg |

---

## Conexión a la base de datos

Prisma 7 requiere un adapter explícito. El cliente se configura en `src/lib/db.ts`:

```typescript
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
return new PrismaClient({ adapter })
```

El datasource en `schema.prisma` **no tiene `url`** — eso va en `prisma.config.ts`:

```typescript
// prisma/prisma.config.ts
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

export default defineConfig({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})
```

La DB es Supabase (PostgreSQL). Se usa el **Session Pooler** (puerto 5432 de Supabase Pooler, NO el puerto 5432 directo). Si se usa el puerto directo, las migraciones fallan en producción.

---

## Arquitectura: App Router + Server Components

- Las **páginas** (`page.tsx`) son Server Components por defecto → hacen fetch directo a DB
- Los **formularios** son Client Components (`'use client'`) → usan RHF
- Las **mutations** son Server Actions (`'use server'`) en `actions/*.ts`
- El patrón es: **Page → fetch datos → pasa como props → Client Component → Server Action**

### Route groups

- `(main)/` — rutas con el AppShell (sidebar). El layout verifica que exista un estudio activo.
- `setup/` — pantalla de configuración inicial, sin sidebar.

---

## Módulos de negocio

Cada módulo vive en `src/modules/[nombre]/` y sigue esta estructura fija:

```
[modulo]/
├── schemas/        # Zod: validación de entrada (lo que viene del form)
│   └── *.schemas.ts
├── domain/         # DTO: tipos que fluyen por toda la app
│   └── types.ts
├── repository/     # Acceso a DB (queries Prisma)
│   └── *.repository.ts
├── actions/        # Server Actions (validan + llaman repository + revalidatePath)
│   └── *.actions.ts
├── components/     # React components del módulo
│   └── *.tsx
└── index.ts        # Re-exports públicos
```

El flujo de datos es siempre en una dirección:
```
Form (Client) → Server Action → Schema.safeParse → Repository → DB
                                                              ↓
                              ← ActionResult<DTO> ←  DTO mapper ←
```

---

## Contexto de estudio

La app es single-tenant por sesión. Se usa `getCurrentEstudioId()` desde `src/lib/estudio-context.ts` para obtener el estudio activo:

```typescript
export const getCurrentEstudioId = cache(async (): Promise<string> => {
  const estudio = await db.estudio.findFirst({ where: { activo: true } })
  if (!estudio) redirect('/setup')
  return estudio.id
})
```

Esto evita pasar `estudioId` por props o context en todos lados. Se llama directo en Server Components y Server Actions.

---

## Base de datos: modelos principales

### Jerarquía principal
```
Estudio
├── Auditor[]           (firmantes del estudio)
└── Sociedad[]          (clientes)
    └── EjercicioContable[]
        ├── CuentaContable[]      (del balance de sumas y saldos)
        ├── ImportacionExcel[]    (archivos importados)
        ├── NotaEjercicio[]       (notas del balance)
        ├── ErrorValidacion[]     (errores de cuadre)
        └── PatrimonioNetoEjercicio
```

### Enums clave

**EstadoEjercicio**: `BORRADOR → EN_PROCESO → REVISION → CERRADO`

**SeccionEERR** (Estado de Resultados):
- `INGRESOS`, `COSTO_VENTAS`, `GASTOS_ADM`, `GASTOS_COM`
- `GASTOS_BANCARIOS`, `IMPUESTOS_CONTRIBUCIONES`
- `RESULTADOS_FINANCIEROS`, `IMPUESTO_GANANCIAS`

**SeccionSSP** (Estado de Situación Patrimonial):
- `ACTIVO_CORRIENTE`, `ACTIVO_NO_CORRIENTE`
- `PASIVO_CORRIENTE`, `PASIVO_NO_CORRIENTE`, `PATRIMONIO_NETO`

**TipoPersona**: `FISICA` | `JURIDICA`

### RubroBase

Catálogo maestro de rubros contables bajo RT 54. Se siembra con `prisma/seed/rubros.ts`.  
Cada rubro tiene: `codigo`, `nombre`, `estadoDestino` (SSP/EERR/PN), `seccionSSP?`, `seccionEERR?`, `naturalezaEsperada` (DEUDORA/ACREEDORA), `orden`.

Las cuentas del balance se clasifican asignando un `rubroBaseId`.

---

## Componentes UI

Todos custom, sin librerías de componentes externas (no Radix UI directamente, solo @radix-ui/react-slot para el Button asChild).

| Componente | Props clave |
|---|---|
| `Button` | `variant`: default/secondary/ghost/destructive, `size`: sm/default/lg, `asChild` |
| `Input` | `error: boolean` (cambia borde a rojo) |
| `Select` | `error: boolean` |
| `Badge` | `variant`: activo/inactivo/borrador/proceso/revision/cerrado/error/defecto |
| `Card` + `CardContent` + `CardHeader` + `CardTitle` + `CardFooter` | — |
| `Label` | — |
| `PageHeader` | `title`, `description?`, `action?` |
| `DeactivateButton` | `id`, `action`, confirmación en 2 clicks |

---

## Sistema de errores

`AppError` es la estructura central:
```typescript
interface AppError {
  tipo: 'TECNICO' | 'VALIDACION' | 'FORMULARIO' | 'NEGOCIO' | 'AUTORIZACION'
  severidad: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  codigo: string        // 'FORM-001', 'TECH-002', 'NEG-001', etc.
  mensaje: string
  detalle?: string
  campo?: string
}
```

Todos los Server Actions retornan `ActionResult<T>`:
```typescript
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AppError }
```

Los errores de Prisma se mapean en `src/modules/errores/prisma-mapper.ts`.  
Los toasts se muestran con `toastError(error)` / `toastSuccess(msg)` desde `src/modules/errores/components/Toast.tsx`.
