import { db } from '@/lib/db'
import { toRubroBaseDTO, type RubroBaseDTO } from '../domain/types'
import type { CreateRubroBaseInput } from '../schemas/rubro-base.schemas'

const includeGrupo = { rubroGrupo: { select: { nombre: true, estadoDestino: true as true, seccionSSP: true as true, seccionEERR: true as true } } } as const

export async function findAllRubrosBase(): Promise<RubroBaseDTO[]> {
  const rows = await db.rubroBase.findMany({
    orderBy: { orden: 'asc' },
    include: includeGrupo,
  })
  return rows.map(toRubroBaseDTO)
}

export async function findRubroBaseById(id: string): Promise<RubroBaseDTO | null> {
  const r = await db.rubroBase.findUnique({ where: { id }, include: includeGrupo })
  return r ? toRubroBaseDTO(r) : null
}

export async function createRubroBase(input: CreateRubroBaseInput): Promise<RubroBaseDTO> {
  const r = await db.rubroBase.create({ data: buildData(input), include: includeGrupo })
  return toRubroBaseDTO(r)
}

export async function updateRubroBase(id: string, input: CreateRubroBaseInput): Promise<RubroBaseDTO> {
  const r = await db.rubroBase.update({ where: { id }, data: buildData(input), include: includeGrupo })
  return toRubroBaseDTO(r)
}

export async function deleteRubroBase(id: string): Promise<void> {
  await db.rubroBase.delete({ where: { id } })
}

export async function findNextOrden(seccionSSP?: string, seccionEERR?: string): Promise<number> {
  const where = seccionSSP
    ? { seccionSSP: seccionSSP as any }
    : seccionEERR
      ? { seccionEERR: seccionEERR as any }
      : {}

  const last = await db.rubroBase.findFirst({
    where,
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
    estadoDestino: input.estadoDestino as any,
    seccionSSP: (input.seccionSSP || null) as any,
    seccionEERR: (input.seccionEERR || null) as any,
    naturalezaEsperada: input.naturalezaEsperada as any,
    orden: parseInt(input.orden, 10),
    activo: true,
  }
}


