'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { assertCuentaBelongsToCurrentEstudio, assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { asignarRubroCuenta, asignarRubrosBulk, updateCuenta, deleteCuenta } from '../repository/cuentas.repository'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'

function revalidateClasificacion(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/clasificar`)
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

export async function asignarRubroAction(
  cuentaId: string,
  rubroBaseId: string | null,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertCuentaBelongsToCurrentEstudio(cuentaId)
    await asignarRubroCuenta(cuentaId, rubroBaseId)
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'clasificacion', operacion: 'asignar' }))
  }
}

export async function actualizarCuentaAction(
  cuentaId: string,
  data: { nombre?: string; saldoDeudor?: number; saldoAcreedor?: number; saldoFinal?: number },
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertCuentaBelongsToCurrentEstudio(cuentaId)
    await updateCuenta(cuentaId, data)
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'clasificacion', operacion: 'actualizar-cuenta' }))
  }
}

export async function eliminarCuentaAction(
  cuentaId: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertCuentaBelongsToCurrentEstudio(cuentaId)
    await deleteCuenta(cuentaId)
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'clasificacion', operacion: 'eliminar-cuenta' }))
  }
}

export async function asignarRubrosBulkAction(
  cuentaIds: string[],
  rubroBaseId: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    if (!cuentaIds.length) return actionOk(undefined)
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    await Promise.all(cuentaIds.map((id) => assertCuentaBelongsToCurrentEstudio(id)))
    await asignarRubrosBulk(cuentaIds, rubroBaseId)
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'clasificacion', operacion: 'asignar-bulk' }),
    )
  }
}
