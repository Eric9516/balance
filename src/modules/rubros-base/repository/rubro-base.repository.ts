import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toRubroBaseDTO, type RubroBaseDTO } from '../domain/types'
import type { CreateRubroBaseInput } from '../schemas/rubro-base.schemas'
import { esSeccionEERR, esSeccionSSP } from '../domain/secciones'

// Cada estudio tiene su propio catálogo: todo se lee y se cambia dentro del estudio.

const includeGrupo = {
  rubroGrupo: {
    select: { nombre: true, estadoDestino: true, seccionSSP: true, seccionEERR: true },
  },
} as const

export async function findAllRubrosBase(estudioId: string): Promise<RubroBaseDTO[]> {
  const rows = await db.rubroBase.findMany({
    where: { estudioId },
    orderBy: { orden: 'asc' },
    include: includeGrupo,
  })
  return rows.map(toRubroBaseDTO)
}

export async function findRubroBaseById(
  estudioId: string,
  id: string,
): Promise<RubroBaseDTO | null> {
  if (!esUuid(id)) return null
  const r = await db.rubroBase.findFirst({ where: { id, estudioId }, include: includeGrupo })
  return r ? toRubroBaseDTO(r) : null
}

export async function createRubroBase(
  estudioId: string,
  input: CreateRubroBaseInput,
): Promise<RubroBaseDTO> {
  const r = await db.rubroBase.create({
    data: { estudioId, ...buildData(input) },
    include: includeGrupo,
  })
  return toRubroBaseDTO(r)
}

/** El llamador comprueba antes que la clasificación es del estudio (findRubroBaseById). */
export async function updateRubroBase(
  id: string,
  input: CreateRubroBaseInput,
): Promise<RubroBaseDTO> {
  const r = await db.rubroBase.update({
    where: { id },
    data: buildData(input),
    include: includeGrupo,
  })
  return toRubroBaseDTO(r)
}

export async function deleteRubroBase(estudioId: string, id: string): Promise<void> {
  await db.rubroBase.deleteMany({ where: { id, estudioId } })
}

export async function findNextOrden(
  estudioId: string,
  seccionSSP?: string,
  seccionEERR?: string,
): Promise<number> {
  const where = esSeccionSSP(seccionSSP)
    ? { seccionSSP }
    : esSeccionEERR(seccionEERR)
      ? { seccionEERR }
      : {}

  const last = await db.rubroBase.findFirst({
    where: { estudioId, ...where },
    orderBy: { orden: 'desc' },
    select: { orden: true },
  })
  return last ? last.orden + 10 : 100
}

function buildData(input: CreateRubroBaseInput) {
  return {
    rubroGrupoId: input.rubroGrupoId || null,
    codigo: input.codigo,
    nombre: input.nombre,
    descripcion: null,
    estadoDestino: input.estadoDestino,
    seccionSSP: input.seccionSSP || null,
    seccionEERR: input.seccionEERR || null,
    naturalezaEsperada: input.naturalezaEsperada,
    orden: parseInt(input.orden, 10),
    activo: true,
  }
}
