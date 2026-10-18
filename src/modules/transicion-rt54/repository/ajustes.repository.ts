import { db } from '@/lib/db'
import {
  toAjusteTransicionDTO,
  type AjusteTransicionDTO,
  type AjusteTransicionInput,
} from '../domain/types'

export async function findAjustesByEjercicio(ejercicioId: string): Promise<AjusteTransicionDTO[]> {
  const rows = await db.ajusteTransicionRT54.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
  })
  return rows.map(toAjusteTransicionDTO)
}

export async function createAjuste(
  ejercicioId: string,
  input: AjusteTransicionInput,
): Promise<AjusteTransicionDTO> {
  const row = await db.ajusteTransicionRT54.create({ data: { ejercicioId, ...input } })
  return toAjusteTransicionDTO(row)
}

/** Reemplaza las partidas del ejercicio por el borrador completo, en una transacción. */
export async function reemplazarAjustes(
  ejercicioId: string,
  ajustes: (AjusteTransicionInput & { id?: string })[],
): Promise<AjusteTransicionDTO[]> {
  await db.$transaction(async (tx) => {
    const ids = ajustes.map((a) => a.id).filter((id): id is string => !!id)
    await tx.ajusteTransicionRT54.deleteMany({
      where: { ejercicioId, ...(ids.length > 0 ? { id: { notIn: ids } } : {}) },
    })
    for (const [i, a] of ajustes.entries()) {
      const data = {
        orden: i + 1,
        tipo: a.tipo,
        concepto: a.concepto,
        descripcion: a.descripcion,
        componentePN: a.componentePN,
        importePN: a.importePN,
        importeResultadoAnterior: a.importeResultadoAnterior,
        rubroOrigen: a.rubroOrigen,
        rubroDestino: a.rubroDestino,
        importeReclasificado: a.importeReclasificado,
      }
      if (a.id) {
        await tx.ajusteTransicionRT54.update({ where: { id: a.id }, data })
      } else {
        await tx.ajusteTransicionRT54.create({ data: { ejercicioId, ...data } })
      }
    }
  })
  return findAjustesByEjercicio(ejercicioId)
}

export async function deleteAjuste(id: string): Promise<void> {
  await db.ajusteTransicionRT54.delete({ where: { id } })
}
