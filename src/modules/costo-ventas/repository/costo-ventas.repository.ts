import { cache } from 'react'
import { db } from '@/lib/db'
import { toCostoVentasDTO, type CostoVentasDTO } from '../domain/types'

/** Memoizado por request (React cache). */
export const findCostoVentas = cache(
  async (ejercicioId: string): Promise<CostoVentasDTO | null> => {
    const row = await db.costoVentasEjercicio.findUnique({ where: { ejercicioId } })
    return row ? toCostoVentasDTO(row) : null
  },
)

export async function upsertCostoVentas(
  ejercicioId: string,
  data: {
    existenciaInicial?: number
    compras?: number
    gastosFabricacion?: number
    existenciaFinal?: number
  },
): Promise<CostoVentasDTO> {
  const row = await db.costoVentasEjercicio.upsert({
    where: { ejercicioId },
    create: {
      ejercicioId,
      existenciaInicial: data.existenciaInicial ?? 0,
      compras: data.compras ?? 0,
      gastosFabricacion: data.gastosFabricacion ?? 0,
      existenciaFinal: data.existenciaFinal ?? 0,
    },
    update: {
      ...(data.existenciaInicial !== undefined && { existenciaInicial: data.existenciaInicial }),
      ...(data.compras !== undefined && { compras: data.compras }),
      ...(data.gastosFabricacion !== undefined && { gastosFabricacion: data.gastosFabricacion }),
      ...(data.existenciaFinal !== undefined && { existenciaFinal: data.existenciaFinal }),
    },
  })
  return toCostoVentasDTO(row)
}
