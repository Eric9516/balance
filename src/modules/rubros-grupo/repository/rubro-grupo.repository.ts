import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toRubroGrupoDTO, type RubroGrupoDTO } from '../domain/types'
import type { CreateRubroGrupoInput } from '../schemas/rubro-grupo.schemas'

// Cada estudio tiene sus propias secciones: todo se lee y se cambia dentro del estudio.

const withCount = { _count: { select: { rubros: true } } } as const

export async function findAllRubroGrupos(estudioId: string): Promise<RubroGrupoDTO[]> {
  const rows = await db.rubroGrupo.findMany({
    where: { estudioId },
    orderBy: { orden: 'asc' },
    include: withCount,
  })
  return rows.map(toRubroGrupoDTO)
}

export async function findRubroGrupoById(
  estudioId: string,
  id: string,
): Promise<RubroGrupoDTO | null> {
  if (!esUuid(id)) return null
  const g = await db.rubroGrupo.findFirst({ where: { id, estudioId }, include: withCount })
  return g ? toRubroGrupoDTO(g) : null
}

function buildData(input: CreateRubroGrupoInput) {
  return {
    nombre: input.nombre,
    sigla: input.sigla || null,
    esGasto: input.esGasto ?? false,
    orden: parseInt(input.orden, 10),
    // RT 54 queda null — libre de configurar después si se necesita
    estadoDestino: null,
    seccionSSP: null,
    seccionEERR: null,
  }
}

export async function createRubroGrupo(
  estudioId: string,
  input: CreateRubroGrupoInput,
): Promise<RubroGrupoDTO> {
  const g = await db.rubroGrupo.create({
    data: { estudioId, ...buildData(input) },
    include: withCount,
  })
  return toRubroGrupoDTO(g)
}

/** El llamador comprueba antes que la sección es del estudio (findRubroGrupoById). */
export async function updateRubroGrupo(
  id: string,
  input: CreateRubroGrupoInput,
): Promise<RubroGrupoDTO> {
  const g = await db.rubroGrupo.update({
    where: { id },
    data: buildData(input),
    include: withCount,
  })
  return toRubroGrupoDTO(g)
}

export async function toggleEsGastoGrupo(
  estudioId: string,
  id: string,
  esGasto: boolean,
): Promise<void> {
  await db.rubroGrupo.updateMany({ where: { id, estudioId }, data: { esGasto } })
}

export async function toggleAparecEnEERRGrupo(
  estudioId: string,
  id: string,
  aparecEnEERR: boolean,
): Promise<void> {
  await db.rubroGrupo.updateMany({ where: { id, estudioId }, data: { aparecEnEERR } })
}

export async function deleteRubroGrupo(estudioId: string, id: string): Promise<void> {
  await db.rubroGrupo.deleteMany({ where: { id, estudioId } })
}

export async function swapOrdenGrupos(estudioId: string, idA: string, idB: string): Promise<void> {
  const [a, b] = await Promise.all([
    db.rubroGrupo.findFirst({ where: { id: idA, estudioId }, select: { orden: true } }),
    db.rubroGrupo.findFirst({ where: { id: idB, estudioId }, select: { orden: true } }),
  ])
  if (!a || !b) return
  await db.$transaction([
    db.rubroGrupo.update({ where: { id: idA }, data: { orden: b.orden } }),
    db.rubroGrupo.update({ where: { id: idB }, data: { orden: a.orden } }),
  ])
}

export async function findNextOrdenGrupo(estudioId: string): Promise<number> {
  const last = await db.rubroGrupo.findFirst({
    where: { estudioId },
    orderBy: { orden: 'desc' },
    select: { orden: true },
  })
  return last ? last.orden + 10 : 10
}
