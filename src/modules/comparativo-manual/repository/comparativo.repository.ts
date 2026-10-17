import { db } from '@/lib/db'
import type { ComparativoManualDTO, ModuloComparativo } from '../domain/types'

function toDTO(r: {
  id: string
  ejercicioId: string
  modulo: string
  clave: string
  label: string
  valor: number
  esHuerfano: boolean
  orden: number
}): ComparativoManualDTO {
  return {
    id: r.id,
    ejercicioId: r.ejercicioId,
    modulo: r.modulo as ModuloComparativo,
    clave: r.clave,
    label: r.label,
    valor: r.valor,
    esHuerfano: r.esHuerfano,
    orden: r.orden,
  }
}

export async function findComparativoByEjercicio(
  ejercicioId: string,
  modulo?: ModuloComparativo,
): Promise<ComparativoManualDTO[]> {
  const rows = await db.comparativoManual.findMany({
    where: { ejercicioId, ...(modulo ? { modulo } : {}) },
    orderBy: [{ modulo: 'asc' }, { orden: 'asc' }, { label: 'asc' }],
  })
  return rows.map(toDTO)
}

export async function upsertComparativo(
  ejercicioId: string,
  modulo: ModuloComparativo,
  clave: string,
  label: string,
  valor: number,
  esHuerfano: boolean,
  orden: number,
): Promise<ComparativoManualDTO> {
  const row = await db.comparativoManual.upsert({
    where: { ejercicioId_modulo_clave: { ejercicioId, modulo, clave } },
    create: { ejercicioId, modulo, clave, label, valor, esHuerfano, orden },
    update: { label, valor },
  })
  return toDTO(row)
}

export async function deleteComparativo(
  ejercicioId: string,
  modulo: ModuloComparativo,
  clave: string,
): Promise<void> {
  await db.comparativoManual.deleteMany({
    where: { ejercicioId, modulo, clave },
  })
}

export async function deleteAllComparativosByEjercicio(ejercicioId: string): Promise<void> {
  await db.comparativoManual.deleteMany({ where: { ejercicioId } })
}
