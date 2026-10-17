'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { upsertCostoVentas } from '../repository/costo-ventas.repository'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'
import type { CostoVentasDTO } from '../domain/types'

export async function guardarTodoCostoVentasAction(
  ejercicioId: string,
  sociedadId: string,
  data: {
    existenciaInicial: number
    compras: number
    gastosFabricacion: number
    existenciaFinal: number
  },
): Promise<ActionResult<CostoVentasDTO>> {
  try {
    const row = await upsertCostoVentas(ejercicioId, data)
    await resetEstadosConfirmado(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/costo-ventas`)
    return actionOk(row)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_costo_ventas' }))
  }
}
