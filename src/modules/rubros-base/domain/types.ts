import type {
  EstadoDestino,
  NaturalezaEsperada,
  RubroBase,
  SeccionEERR,
  SeccionSSP,
} from '@prisma/client'
import { labelSeccion } from './secciones'

export type RubroBaseDTO = {
  id: string
  rubroGrupoId: string | null
  rubroGrupoNombre: string | null
  codigo: string
  nombre: string
  estadoDestino: EstadoDestino
  seccionSSP: SeccionSSP | null
  seccionEERR: SeccionEERR | null
  naturalezaEsperada: NaturalezaEsperada
  orden: number
  activo: boolean
}

type RubroBaseWithGrupo = RubroBase & {
  rubroGrupo?: {
    nombre: string
    estadoDestino: EstadoDestino | null
    seccionSSP: SeccionSSP | null
    seccionEERR: SeccionEERR | null
  } | null
}

export function toRubroBaseDTO(r: RubroBaseWithGrupo): RubroBaseDTO {
  return {
    id: r.id,
    rubroGrupoId: r.rubroGrupoId,
    rubroGrupoNombre: r.rubroGrupo?.nombre ?? null,
    codigo: r.codigo,
    nombre: r.nombre,
    estadoDestino: r.estadoDestino,
    seccionSSP: r.seccionSSP,
    seccionEERR: r.seccionEERR,
    naturalezaEsperada: r.naturalezaEsperada,
    orden: r.orden,
    activo: r.activo,
  }
}

export function getSeccionLabel(r: RubroBaseDTO): string {
  const seccion = r.seccionSSP ?? r.seccionEERR
  return seccion ? labelSeccion(seccion) : '—'
}
