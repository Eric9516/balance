import type { ComparativoManual } from '@prisma/client'
import { db } from '@/lib/db'
import type { ComparativoManualDTO, ModuloComparativo } from '../domain/types'
import { importe } from '@/lib/importe'

function toDTO(r: ComparativoManual): ComparativoManualDTO {
  return {
    id: r.id,
    ejercicioId: r.ejercicioId,
    modulo: r.modulo as ModuloComparativo,
    clave: r.clave,
    label: r.label,
    valor: importe(r.valor),
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

export type ComparativoLoteItem = {
  modulo: ModuloComparativo
  clave: string
  label: string
  valor: number
  esHuerfano: boolean
  orden: number
}

/** Upsert de todo el borrador en UNA transacción (un solo round trip por Guardar). */
export async function upsertComparativoLote(
  ejercicioId: string,
  items: ComparativoLoteItem[],
): Promise<ComparativoManualDTO[]> {
  const rows = await db.$transaction(
    items.map((e) =>
      db.comparativoManual.upsert({
        where: { ejercicioId_modulo_clave: { ejercicioId, modulo: e.modulo, clave: e.clave } },
        create: {
          ejercicioId,
          modulo: e.modulo,
          clave: e.clave,
          label: e.label,
          valor: e.valor,
          esHuerfano: e.esHuerfano,
          orden: e.orden,
        },
        update: { label: e.label, valor: e.valor },
      }),
    ),
  )
  return rows.map(toDTO)
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
