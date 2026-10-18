'use server'

import { revalidatePath } from 'next/cache'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { findCostoVentas, upsertCostoVentas } from '../repository/costo-ventas.repository'
import {
  findEjercicioById,
  resetEstadosConfirmado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { aplicarArrastreCostoVentas } from '../domain/saldosInicio'
import type { CostoVentasDTO } from '../domain/types'

/**
 * Guarda el Anexo II. En modo VINCULADO con Anexo II en el anterior, la existencia
 * inicial se fija en la existencia final del anterior (el cliente no puede pisarla).
 */
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
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Ejercicio no encontrado',
      })
    }
    const anteriorId = idAnteriorDerivable(ejercicio)
    const anterior = anteriorId ? await findCostoVentas(anteriorId) : null
    const arrastre = aplicarArrastreCostoVentas(
      { id: '', ejercicioId, ...data },
      anterior,
      modoEfectivo(ejercicio),
    )
    const saneado = arrastre.datos ?? { id: '', ejercicioId, ...data }

    const row = await upsertCostoVentas(ejercicioId, {
      existenciaInicial: saneado.existenciaInicial,
      compras: saneado.compras,
      gastosFabricacion: saneado.gastosFabricacion,
      existenciaFinal: saneado.existenciaFinal,
    })
    await resetEstadosConfirmado(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_costo_ventas' }),
    )
  }
}
