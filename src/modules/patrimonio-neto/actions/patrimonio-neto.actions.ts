'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionError, actionOk, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import {
  findEjercicioById,
  marcarComparativoModificado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { compuertaAutorizacion } from '@/modules/ejercicios/services/autorizacion.service'
import { getIndicesReexpresion } from '@/modules/estados/lib/ajuste'
import { findMovimientosPN, guardarMovimientosPN } from '../repository/patrimonio-neto.repository'
import { derivarDesdeAnteriorPN } from '../domain/saldosInicio'
import { armarEvolucionPN, conResultado } from '../domain/evolucion'
import type { EvolucionPNData, EvolucionPNInput } from '../domain/types'
import { restar } from '@/lib/importe'
import { faltaPermiso } from '@/lib/estudio-context'

/**
 * Guarda el E.E.P.N. Lo que manda el cliente se SANEA en el servidor:
 *  - el resultado del ejercicio siempre viene del EERR;
 *  - en modo VINCULADO con fuente, "Saldos al inicio" y la columna "Ejercicio anterior"
 *    se recalculan desde el anterior (el cliente no puede pisarlos);
 *  - en modo MANUAL, cambiar la columna "Ejercicio anterior" invalida la autorización. El
 *    resultado del año anterior no cuenta: no se carga, sale del estado de resultados anterior.
 */
export async function guardarEvolucionPNAction(
  ejercicioId: string,
  sociedadId: string,
  movimientos: EvolucionPNInput[],
  resultadoEjercicio: number,
): Promise<ActionResult<EvolucionPNData>> {
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
    const modo = modoEfectivo(ejercicio)
    const anteriorId = idAnteriorDerivable(ejercicio)
    const [movsAnterior, guardadosPrevios] = await Promise.all([
      anteriorId ? findMovimientosPN(anteriorId) : Promise.resolve([]),
      findMovimientosPN(ejercicioId),
    ])
    const derivado = derivarDesdeAnteriorPN(movsAnterior, getIndicesReexpresion(ejercicio))

    const saneado = armarEvolucionPN({
      ejercicioId,
      guardados: conResultado(
        movimientos.map((m) => ({ ...m, id: '', ejercicioId })),
        resultadoEjercicio,
      ),
      resultadoEjercicio,
      modo,
      derivado,
    })

    await guardarMovimientosPN(ejercicioId, saneado.movimientos)

    if (modo === 'MANUAL') {
      const previo = new Map(guardadosPrevios.map((m) => [m.tipo, m.totalAnterior]))
      const cambioAnterior = saneado.movimientos.some(
        (m) =>
          m.tipo !== 'RESULTADO_EJERCICIO' && restar(previo.get(m.tipo), m.totalAnterior) !== 0,
      )
      if (cambioAnterior) await marcarComparativoModificado(ejercicioId)
    }

    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(saneado)
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
    const sinPermiso = await faltaPermiso('confirmar_y_cerrar')
    if (sinPermiso) return actionError(sinPermiso)
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (confirmado) {
      // El E.E.P.N. no depende del flujo de efectivo: su descuadre se exige al confirmar estados.
      const bloqueo = await compuertaAutorizacion(ejercicioId, { ignorarCodigos: ['AUT-050'] })
      if (bloqueo) return actionError(bloqueo)
    }
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
