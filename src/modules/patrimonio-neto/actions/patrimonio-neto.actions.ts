'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { actionError, actionOk, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { guardarEvolucionPN } from '../repository/patrimonio-neto.repository'
import type { EvolucionPNData, EvolucionPNInput } from '../domain/types'

export async function guardarEvolucionPNAction(
  ejercicioId: string,
  sociedadId: string,
  movimientos: EvolucionPNInput[],
  resultadoEjercicio: number,
): Promise<ActionResult<EvolucionPNData>> {
  try {
    const data = await guardarEvolucionPN(ejercicioId, movimientos, resultadoEjercicio)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(data)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'PATRIMONIO_NETO', operacion: 'guardar_evolucion_pn' }),
    )
  }
}

export async function confirmarPNAction(
  ejercicioId: string,
  sociedadId: string,
  confirmado: boolean,
): Promise<ActionResult<void>> {
  try {
    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data: { pnConfirmado: confirmado },
    })
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'PATRIMONIO_NETO', operacion: 'confirmar_pn' }),
    )
  }
}
