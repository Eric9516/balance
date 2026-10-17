import type { RubroGrupo } from '@prisma/client'

export type RubroGrupoDTO = {
  id: string
  nombre: string
  sigla: string | null
  esGasto: boolean
  estadoDestino: string | null
  seccionSSP: string | null
  seccionEERR: string | null
  orden: number
  activo: boolean
  totalRubros: number
}

export function toRubroGrupoDTO(g: RubroGrupo & { _count?: { rubros: number } }): RubroGrupoDTO {
  return {
    id: g.id,
    nombre: g.nombre,
    sigla: g.sigla,
    esGasto: g.esGasto,
    estadoDestino: g.estadoDestino ?? null,
    seccionSSP: g.seccionSSP ?? null,
    seccionEERR: g.seccionEERR ?? null,
    orden: g.orden,
    activo: g.activo,
    totalRubros: g._count?.rubros ?? 0,
  }
}
