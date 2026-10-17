# BalanceRT

Plataforma web configurable para la generación de estados contables bajo **RT 54** (Resolución Técnica 54 — FACPCE) para estudios contables argentinos.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14+ (App Router, Server Components) |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| ORM | Prisma + PostgreSQL |
| Validación | Zod (server + client) |
| Formularios | React Hook Form + zodResolver |
| Estado servidor | TanStack Query v5 |
| Importación Excel | SheetJS (xlsx) |
| Aritmética decimal | decimal.js (nunca `number` para importes) |
| Toasts | Sonner |

---

## Arquitectura

### Tres niveles de configuración

1. **Core del sistema** — normativa RT 54, inmutable (RubroBase, enums, lógica de cuadre)
2. **Configuración por estudio** — plantillas, mapeos Excel, preferencias de display
3. **Datos por sociedad/ejercicio** — cuentas, importaciones, notas, patrimonio neto

### Módulos verticales

Cada módulo en `src/modules/<nombre>/` tiene:

```
domain/        # tipos e interfaces de dominio
repository/    # acceso a base de datos (Prisma)
actions/       # Server Actions (ActionResult<T>)
schemas/       # schemas Zod compartidos server/client
components/    # componentes React del módulo
hooks/         # hooks de TanStack Query
types.ts       # tipos locales del módulo
index.ts       # re-exports públicos
```

### Invariantes contables (capa de aplicación)

- `saldoFinal = saldoDeudor - saldoAcreedor` (positivo = deudora, negativo = acreedora)
- `totalPatrimonioNeto = capital + ajusteCapital + reservas + resultadosNoAsignados + resultadoEjercicio`
- SSP y EERR son **vistas computadas** — no tienen tablas propias
- `estudioId` en `EjercicioContable` está desnormalizado desde `Sociedad.estudioId`

### ActionResult pattern

Todas las Server Actions retornan `ActionResult<T>`:

```typescript
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AppError }
```

---

## Setup inicial

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+

### Instalación

```bash
git clone <repo>
cd balancert
npm install
cp .env.example .env
# Editar .env con tu DATABASE_URL
```

### Base de datos

```bash
npm run db:migrate    # crea/actualiza el schema
npm run db:seed       # inserta los 30 rubros base de RT 54
npm run db:studio     # Prisma Studio (opcional)
```

### Desarrollo

```bash
npm run dev
```

---

## RubroBase — RT 54 PyME

Los 30 rubros base son **inmutables** desde la perspectiva de los estudios. Los estudios solo pueden activar/desactivar rubros via `RubroActivoEstudio`. No pueden crear nuevos rubros.

| Rango de orden | Sección |
|---------------|---------|
| 100–190 | Activo Corriente (SSP) |
| 200–290 | Activo No Corriente (SSP) |
| 300–390 | Pasivo Corriente (SSP) |
| 400–490 | Pasivo No Corriente (SSP) |
| 500–590 | Patrimonio Neto (SSP + PN) |
| 600–609 | EERR — Ingresos |
| 610–619 | EERR — Costo de ventas |
| 620–649 | EERR — Gastos de administración |
| 650–659 | EERR — Gastos de comercialización |
| 660–679 | EERR — Resultados financieros (incluye RECPAM) |
| 680–689 | EERR — Impuesto a las ganancias |

---

## Manejo de errores

El módulo `src/modules/errores/` es transversal y no importa ningún otro módulo del sistema.

- `types.ts` — `AppError`, `ActionResult<T>`, `TipoError`, `SeveridadError`
- `catalog.ts` — catálogo de errores por código (TECH-xxx, FORM-xxx, BIZ-xxx, AUTH-xxx)
- `handler.ts` — `errorHandler(error, ctx?)` → `AppError`
- `prisma-mapper.ts` — mapea errores Prisma (P2002, P2003, P2025) a `AppError`
- `logger.ts` — logging seguro (nunca loguea PII ni importes)
- `components/ErrorBoundary.tsx` — Error Boundary de React
- `components/Toast.tsx` — wrappers de Sonner tipados con `AppError`

---

## Snapshots legales

- `auditorSnapshot: Json` en `EjercicioContable` — copia del auditor al momento del cierre; independiente de cambios futuros en su perfil
- `mapeoSnapshot: Json` en `ImportacionExcel` — copia del mapeo utilizado; trazabilidad de la importación

---

## Estado del proyecto

**Sprint 0 completado** — base técnica lista para Sprint 1 (CRUD de Sociedades y Ejercicios).
