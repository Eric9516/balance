'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'

export async function confirmarEstadosAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data: { estadosConfirmado: true },
    })
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'confirmar_estados' }))
  }
}
