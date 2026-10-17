import type { RubroBaseSimple } from '../domain/types'

// ─── Labels para grupos ───────────────────────────────────────────────────────

const SECCION_SSP_LABELS: Record<string, string> = {
  ACTIVO_CORRIENTE: 'Activo Corriente',
  ACTIVO_NO_CORRIENTE: 'Activo No Corriente',
  PASIVO_CORRIENTE: 'Pasivo Corriente',
  PASIVO_NO_CORRIENTE: 'Pasivo No Corriente',
  PATRIMONIO_NETO: 'Patrimonio Neto',
}

const SECCION_EERR_LABELS: Record<string, string> = {
  INGRESOS: 'Ingresos',
  COSTO_VENTAS: 'Costo de Ventas',
  GASTOS_ADM: 'Gastos de Administración',
  GASTOS_COM: 'Gastos de Comercialización',
  GASTOS_BANCARIOS: 'Gastos Bancarios',
  IMPUESTOS_CONTRIBUCIONES: 'Impuestos y Contribuciones',
  RESULTADOS_FINANCIEROS: 'Resultados Financieros',
  IMPUESTO_GANANCIAS: 'Impuesto a las Ganancias',
}

function getGroupLabel(r: RubroBaseSimple): string {
  if (r.rubroGrupoNombre) {
    if (r.seccionEERR) return `EERR — ${r.rubroGrupoNombre}`
    if (r.seccionSSP) return `SSP — ${r.rubroGrupoNombre}`
    // sección libre: si es gasto → va al EERR aunque no tenga seccionEERR seteada
    if (r.rubroGrupoEsGasto) return `EERR — ${r.rubroGrupoNombre}`
    return r.rubroGrupoNombre
  }
  if (r.seccionSSP) return `SSP — ${SECCION_SSP_LABELS[r.seccionSSP] ?? r.seccionSSP}`
  if (r.seccionEERR) return `EERR — ${SECCION_EERR_LABELS[r.seccionEERR] ?? r.seccionEERR}`
  return 'Otros'
}

export function buildGroups(rubros: RubroBaseSimple[]): [string, RubroBaseSimple[]][] {
  const map = new Map<string, RubroBaseSimple[]>()
  for (const r of rubros) {
    const label = getGroupLabel(r)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(r)
  }
  return Array.from(map.entries())
}
