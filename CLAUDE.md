@AGENTS.md
# Instrucciones del proyecto BalanceRT

Este proyecto debe construirse con mentalidad de crecimiento, modularidad, mantenibilidad y escalabilidad.

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

## Base de datos

Toda modificación de base de datos debe cuidar:

- Relaciones claras.
- IDs consistentes.
- Estados del proceso.
- Historial cuando corresponda.
- Auditoría de acciones importantes.
- No borrar información sensible sin control.
- Evitar campos genéricos tipo "otros", "data", "config" salvo justificación clara.

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

**Modelo de interacción estándar:**
1. La región arranca en modo lectura.
2. `BotonEditar` (vía `useEdicionLote`) entra en modo edición: se trabaja sobre un **borrador local**, nada se persiste todavía.
3. En edición, las `CeldaNumero` actualizan el borrador en memoria (`actualizar`), no la base de datos.
4. "Cancelar" descarta el borrador completo. "Guardar" hace **un solo commit** de todo el borrador a la vez.
5. Altas/bajas estructurales (agregar fila, eliminar fila, eliminar nota) se persisten de inmediato con `useGuardarAccion`, fuera del borrador — y deben reflejarse en él vía `sincronizar`.
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