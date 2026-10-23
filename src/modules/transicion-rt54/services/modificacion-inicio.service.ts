/**
 * Primera aplicación de la RT 54: después de crear, cambiar o borrar ajustes de la nota de
 * transición, la fila "Modificación de saldos al inicio" del E.E.P.N. los acompaña (el mismo importe
 * no se carga dos veces), salvo que el contador la haya cambiado a mano. Si la fila cambia, el
 * E.E.P.N. y los estados se vuelven a confirmar.
 */
import {
  desconfirmarPN,
  findEjercicioById,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  findMovimientosPN,
  guardarMovimientosPN,
} from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import { movimientoVacio } from '@/modules/patrimonio-neto/domain/evolucion'
import { PN_MOVIMIENTOS } from '@/modules/patrimonio-neto/domain/types'
import { findAjustesByEjercicio } from '../repository/ajustes.repository'
import {
  filaSigueAjustes,
  mismasColumnas,
  modificacionInicioDesdeAjustes,
} from '../domain/modificacionInicio'
import type { AjusteTransicionDTO } from '../domain/types'

export async function sincronizarModificacionInicio(
  ejercicioId: string,
  antes: AjusteTransicionDTO[],
): Promise<void> {
  const [ejercicio, despues, movimientos] = await Promise.all([
    findEjercicioById(ejercicioId),
    findAjustesByEjercicio(ejercicioId),
    findMovimientosPN(ejercicioId),
  ])
  if (
    !ejercicio ||
    ejercicio.adopcionRT54 !== 'PRIMERA_ADOPCION' ||
    ejercicio.estado === 'CERRADO'
  ) {
    return
  }
  const nueva = modificacionInicioDesdeAjustes(despues)
  if (!nueva) return
  const orden = PN_MOVIMIENTOS.find((m) => m.tipo === 'MODIFICACION_INICIO')?.orden ?? 0
  const fila =
    movimientos.find((m) => m.tipo === 'MODIFICACION_INICIO') ??
    movimientoVacio(ejercicioId, 'MODIFICACION_INICIO', orden)
  if (!filaSigueAjustes(fila, modificacionInicioDesdeAjustes(antes))) return
  if (mismasColumnas(fila, nueva)) return
  await guardarMovimientosPN(ejercicioId, [{ ...fila, ...nueva }])
  await desconfirmarPN(ejercicioId)
}
