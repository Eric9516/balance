'use server'

import { revalidatePath } from 'next/cache'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import {
  findConfigAnterior,
  marcarComparativoModificado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import type { ComparativoManualDTO, ModuloComparativo } from '../domain/types'
import {
  upsertComparativo,
  upsertComparativoLote,
  deleteComparativo,
  deleteAllComparativosByEjercicio,
  type ComparativoLoteItem,
} from '../repository/comparativo.repository'

function revalidate(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

/**
 * Guardia de escenario: solo un ejercicio en modo MANUAL admite filas manuales.
 * En VINCULADO el comparativo viene del ejercicio anterior; aceptar escrituras acá
 * dejaría residuos que, aunque el dominio los ignora, confunden y ensucian la base.
 */
async function assertModoManual(ejercicioId: string): Promise<AppError | null> {
  const cfg = await findConfigAnterior(ejercicioId)
  if (!cfg) {
    return {
      tipo: 'TECNICO',
      severidad: 'ALTO',
      codigo: 'TECH-002',
      mensaje: 'Ejercicio no encontrado',
    }
  }
  if (cfg.modoAnterior === 'MANUAL') return null
  return {
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    codigo: 'NEG-012',
    mensaje:
      cfg.modoAnterior === 'VINCULADO'
        ? 'Este ejercicio toma la columna "Ejercicio anterior" del ejercicio vinculado: no admite carga manual.'
        : 'Para cargar la columna "Ejercicio anterior" a mano, configurá el ejercicio en modo "Carga manual" desde "Editar ejercicio".',
  }
}

export async function guardarLoteComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  items: ComparativoLoteItem[],
): Promise<ActionResult<ComparativoManualDTO[]>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const guardia = await assertModoManual(ejercicioId)
    if (guardia) return actionError(guardia)
    const rows = await upsertComparativoLote(ejercicioId, items)
    await marcarComparativoModificado(ejercicioId)
    revalidate(sociedadId, ejercicioId)
    return actionOk(rows)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_comparativo_lote' }),
    )
  }
}

export async function guardarComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  modulo: ModuloComparativo,
  clave: string,
  label: string,
  valor: number,
  esHuerfano: boolean,
  orden: number,
): Promise<ActionResult<ComparativoManualDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const guardia = await assertModoManual(ejercicioId)
    if (guardia) return actionError(guardia)
    const row = await upsertComparativo(ejercicioId, modulo, clave, label, valor, esHuerfano, orden)
    await marcarComparativoModificado(ejercicioId)
    revalidate(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_comparativo' }),
    )
  }
}

export async function eliminarComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  modulo: ModuloComparativo,
  clave: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    await deleteComparativo(ejercicioId, modulo, clave)
    await marcarComparativoModificado(ejercicioId)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'eliminar_comparativo' }),
    )
  }
}

export async function limpiarComparativosAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    await deleteAllComparativosByEjercicio(ejercicioId)
    await marcarComparativoModificado(ejercicioId)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'limpiar_comparativos' }),
    )
  }
}
