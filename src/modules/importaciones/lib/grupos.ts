import type { RubroBaseSimple } from '../domain/types'
import { labelSeccion } from '@/modules/rubros-base/domain/secciones'

function getGroupLabel(r: RubroBaseSimple): string {
  if (r.rubroGrupoNombre) {
    if (r.seccionEERR) return `EERR — ${r.rubroGrupoNombre}`
    if (r.seccionSSP) return `SSP — ${r.rubroGrupoNombre}`
    // sección libre: si es gasto → va al EERR aunque no tenga seccionEERR seteada
    if (r.rubroGrupoEsGasto) return `EERR — ${r.rubroGrupoNombre}`
    return r.rubroGrupoNombre
  }
  if (r.seccionSSP) return `SSP — ${labelSeccion(r.seccionSSP)}`
  if (r.seccionEERR) return `EERR — ${labelSeccion(r.seccionEERR)}`
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
