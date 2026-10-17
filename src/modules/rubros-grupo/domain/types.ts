import type { EstadoDestino, RubroGrupo, SeccionEERR, SeccionSSP } from '@prisma/client'

export type RubroGrupoDTO = {
  id: string
  nombre: string
  sigla: string | null
  esGasto: boolean
  estadoDestino: EstadoDestino | null
  seccionSSP: SeccionSSP | null
  seccionEERR: SeccionEERR | null
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
