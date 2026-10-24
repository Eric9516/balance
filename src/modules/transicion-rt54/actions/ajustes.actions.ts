'use server'

import { revalidatePath } from 'next/cache'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import {
  createAjuste,
  deleteAjuste,
  findAjustesByEjercicio,
  reemplazarAjustes,
} from '../repository/ajustes.repository'
import { sincronizarModificacionInicio } from '../services/modificacion-inicio.service'
import type { AjusteTransicionDTO, AjusteTransicionInput } from '../domain/types'

function revalidar(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

export async function crearAjusteTransicionAction(
  ejercicioId: string,
  sociedadId: string,
  input: Omit<AjusteTransicionInput, 'orden'>,
): Promise<ActionResult<AjusteTransicionDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const existentes = await findAjustesByEjercicio(ejercicioId)
    const row = await createAjuste(ejercicioId, { ...input, orden: existentes.length + 1 })
    await sincronizarModificacionInicio(ejercicioId, existentes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'crear_ajuste_transicion' }),
    )
  }
}

export async function guardarLoteAjustesTransicionAction(
  ejercicioId: string,
  sociedadId: string,
  ajustes: (AjusteTransicionInput & { id?: string })[],
): Promise<ActionResult<AjusteTransicionDTO[]>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const antes = await findAjustesByEjercicio(ejercicioId)
    const rows = await reemplazarAjustes(ejercicioId, ajustes)
    await sincronizarModificacionInicio(ejercicioId, antes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(rows)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'guardar_ajustes_transicion' }),
    )
  }
}

export async function eliminarAjusteTransicionAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const antes = await findAjustesByEjercicio(ejercicioId)
    if (!(await deleteAjuste(ejercicioId, id))) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje:
          'No se encontró esa partida de transición en este ejercicio. Recargá la página y volvé a intentar.',
      })
    }
    await sincronizarModificacionInicio(ejercicioId, antes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'eliminar_ajuste_transicion' }),
    )
  }
}
