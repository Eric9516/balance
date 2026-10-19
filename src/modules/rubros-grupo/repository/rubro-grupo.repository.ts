import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toRubroGrupoDTO, type RubroGrupoDTO } from '../domain/types'
import type { CreateRubroGrupoInput } from '../schemas/rubro-grupo.schemas'

const withCount = { _count: { select: { rubros: true } } } as const

export async function findAllRubroGrupos(): Promise<RubroGrupoDTO[]> {
  const rows = await db.rubroGrupo.findMany({
    orderBy: { orden: 'asc' },
    include: withCount,
  })
  return rows.map(toRubroGrupoDTO)
}

export async function findRubroGrupoById(id: string): Promise<RubroGrupoDTO | null> {
  if (!esUuid(id)) return null
  const g = await db.rubroGrupo.findUnique({ where: { id }, include: withCount })
  return g ? toRubroGrupoDTO(g) : null
}

function buildData(input: CreateRubroGrupoInput): Prisma.RubroGrupoCreateInput {
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

export async function createRubroGrupo(input: CreateRubroGrupoInput): Promise<RubroGrupoDTO> {
  const g = await db.rubroGrupo.create({ data: buildData(input), include: withCount })
  return toRubroGrupoDTO(g)
}

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

export async function toggleEsGastoGrupo(id: string, esGasto: boolean): Promise<void> {
  await db.rubroGrupo.update({ where: { id }, data: { esGasto } })
}

export async function toggleAparecEnEERRGrupo(id: string, aparecEnEERR: boolean): Promise<void> {
  await db.rubroGrupo.update({ where: { id }, data: { aparecEnEERR } })
}

export async function deleteRubroGrupo(id: string): Promise<void> {
  await db.rubroGrupo.delete({ where: { id } })
}

export async function swapOrdenGrupos(idA: string, idB: string): Promise<void> {
  const [a, b] = await Promise.all([
    db.rubroGrupo.findUnique({ where: { id: idA }, select: { orden: true } }),
    db.rubroGrupo.findUnique({ where: { id: idB }, select: { orden: true } }),
  ])
  if (!a || !b) return
  await db.$transaction([
    db.rubroGrupo.update({ where: { id: idA }, data: { orden: b.orden } }),
    db.rubroGrupo.update({ where: { id: idB }, data: { orden: a.orden } }),
  ])
}

export async function findNextOrdenGrupo(): Promise<number> {
  const last = await db.rubroGrupo.findFirst({
    orderBy: { orden: 'desc' },
    select: { orden: true },
  })
  return last ? last.orden + 10 : 10
}
