# BalanceRT — Documentación de desarrollo

Esta carpeta registra todo lo que se fue construyendo en el proyecto: decisiones, sprints, patrones y estado actual.  
Está pensada para que cualquier persona (o sesión nueva de Claude) pueda entender el proyecto sin contexto previo.

---

## Qué es BalanceRT

Plataforma web para estudios contables argentinos. Permite preparar y generar **estados contables bajo RT 54** (Resolución Técnica 54 de FACPCE), que es la norma vigente obligatoria para ejercicios que cierran a partir del 31/12/2025.

El flujo central del sistema es:
1. El contador registra su **estudio** y sus **auditores** firmantes
2. Crea **clientes** (personas físicas o jurídicas = "sociedades")
3. Por cada cliente abre **ejercicios contables** (períodos)
4. Importa el **balance de sumas y saldos** desde Excel
5. Clasifica las cuentas en **rubros** del plan de cuentas RT 54
6. Completa **notas** y **anexos**
7. El sistema genera automáticamente los **estados contables** (SSP, EERR, Evolución PN, Flujo de Efectivo)
8. Exporta en Word/PDF con el formato del estudio

La referencia de proceso está en: `Pasos_para_tipear_balances.pdf` (manual interno del contador).

---

## Estado actual del proyecto

| Módulo | Estado |
|---|---|
| Schema / DB | ✅ Completo (con migraciones aplicadas) |
| Infraestructura (errores, db, utils) | ✅ Completo |
| UI base (componentes, layout) | ✅ Completo |
| Estudio — CRUD | ✅ Completo |
| Auditores — CRUD | ✅ Completo |
| Sociedades (clientes) — CRUD | ✅ Completo |
| Ejercicios contables — CRUD | ✅ Completo (Sprint 1B) |
| Importación Excel | ⏳ Pendiente (Sprint 2) |
| Clasificación de cuentas | ⏳ Pendiente (Sprint 3) |
| Notas y anexos | ⏳ Pendiente (Sprint 4) |
| Estados contables automáticos | ⏳ Pendiente (Sprint 4) |
| Exportación Word/PDF | ⏳ Pendiente (Sprint 5) |

---

## Archivos en esta carpeta

| Archivo | Contenido |
|---|---|
| `README.md` | Este archivo — visión general e índice |
| `stack-y-arquitectura.md` | Stack técnico, estructura de carpetas, decisiones de arquitectura |
| `historial-sprints.md` | Qué se construyó en cada sprint, qué archivos se tocaron, problemas resueltos |
| `patrones.md` | Patrones de código establecidos que hay que seguir en todo el proyecto |

---

## Estructura de carpetas del proyecto

```
balancert/
├── prisma/
│   ├── schema.prisma          # Schema completo de la DB
│   ├── migrations/            # Migraciones aplicadas (5 hasta ahora)
│   ├── prisma.config.ts       # Config de Prisma 7 (adapter PG)
│   └── seed/
│       ├── index.ts
│       └── rubros.ts          # Seed de rubros contables RT 54
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (main)/            # Rutas con AppShell (sidebar)
│   │   │   ├── auditores/
│   │   │   ├── configuracion/
│   │   │   └── sociedades/    # Incluye /[id]/ejercicios
│   │   ├── setup/             # Pantalla de onboarding (sin sidebar)
│   │   └── layout.tsx / page.tsx / providers.tsx
│   ├── components/
│   │   ├── layout/            # AppShell, Sidebar, PageHeader
│   │   ├── shared/            # DeactivateButton
│   │   └── ui/                # badge, button, card, input, label, select
│   ├── lib/
│   │   ├── db.ts              # Cliente Prisma con adapter PG
│   │   ├── estudio-context.ts # getCurrentEstudioId / getCurrentEstudio
│   │   ├── utils.ts           # cn()
│   │   └── utils/             # cuit, currency, dates, decimal
│   │   └── constants/         # balance.ts (rubros labels), navigation.ts
│   ├── modules/               # Dominio de negocio
│   │   ├── errores/           # Sistema de errores y logging
│   │   ├── estudios/
│   │   ├── auditores/
│   │   ├── sociedades/
│   │   └── ejercicios/        # Creado en Sprint 1B
│   └── types/                 # Tipos globales TS
└── claude/                    # Esta carpeta
```
