'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import {
  asignarRubroCuenta,
  asignarRubrosBulk,
  updateCuenta,
  deleteCuenta,
  type CambiosCuenta,
} from '../repository/cuentas.repository'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'
import { errorDescuadre, type EfectoEnCuadre } from '../domain/importacion'

const importe = z.number().finite()

/** Lo que se edita de una cuenta. zod descarta cualquier otra clave que mande la pantalla. */
const CambiosCuentaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la cuenta no puede quedar vacío.').optional(),
  saldoDeudor: importe.optional(),
  saldoAcreedor: importe.optional(),
  saldoFinal: importe.optional(),
})

const CUENTA_NO_ENCONTRADA: AppError = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'No se encontró esa cuenta en este ejercicio. Recargá la página y volvé a intentar.',
}

/** Lo que se confirma en el cartel: guardar aunque el balance deje de cuadrar. */
export type OpcionesCambioCuenta = { aceptarDescuadre?: boolean }

/** Qué le hizo el cambio al cuadre (null si no tocó el debe ni el haber). */
export type CambioCuentaHecho = { efecto: EfectoEnCuadre | null }

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
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!(await asignarRubroCuenta(ejercicioId, cuentaId, rubroBaseId))) {
      return actionError(CUENTA_NO_ENCONTRADA)
    }
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'clasificacion', operacion: 'asignar' }))
  }
}

export async function actualizarCuentaAction(
  cuentaId: string,
  data: CambiosCuenta,
  ejercicioId: string,
  sociedadId: string,
  opciones?: OpcionesCambioCuenta,
): Promise<ActionResult<CambioCuentaHecho>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = CambiosCuentaSchema.safeParse(data)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: parsed.error.issues[0]?.message ?? 'Datos inválidos en la cuenta.',
        campo: parsed.error.issues[0]?.path.join('.'),
      })
    }
    const r = await updateCuenta(
      ejercicioId,
      cuentaId,
      parsed.data,
      opciones?.aceptarDescuadre === true,
    )
    if (r.estado === 'NO_ENCONTRADA') return actionError(CUENTA_NO_ENCONTRADA)
    if (r.estado === 'DESCUADRA') return actionError(errorDescuadre(r.efecto))
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk({ efecto: r.efecto })
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'clasificacion', operacion: 'actualizar-cuenta' }),
    )
  }
}

export async function eliminarCuentaAction(
  cuentaId: string,
  ejercicioId: string,
  sociedadId: string,
  opciones?: OpcionesCambioCuenta,
): Promise<ActionResult<CambioCuentaHecho>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const r = await deleteCuenta(ejercicioId, cuentaId, opciones?.aceptarDescuadre === true)
    if (r.estado === 'NO_ENCONTRADA') return actionError(CUENTA_NO_ENCONTRADA)
    if (r.estado === 'DESCUADRA') return actionError(errorDescuadre(r.efecto))
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk({ efecto: r.efecto })
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'clasificacion', operacion: 'eliminar-cuenta' }),
    )
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
    // Una sola escritura con el ejercicio en la condición: las cuentas ajenas no se tocan.
    await asignarRubrosBulk(ejercicioId, cuentaIds, rubroBaseId)
    await resetEstadosConfirmado(ejercicioId)
    revalidateClasificacion(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'clasificacion', operacion: 'asignar-bulk' }))
  }
}
