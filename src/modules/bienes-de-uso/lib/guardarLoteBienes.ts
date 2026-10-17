import { actionOk } from '@/modules/errores/types'
import type { ActionResult } from '@/modules/errores/types'
import {
  actualizarBienDeUsoAction,
  actualizarNetoAnteriorManualAction,
} from '../actions/bienes-de-uso.actions'
import type { BienDeUsoDTO } from '../domain/types'

// Persiste todos los bienes del borrador de una vez (campos + neto anterior manual).
// Reusa las acciones por fila existentes; el commit en bloque es responsabilidad
// del hook useEdicionLote, no de la acción del servidor.
export async function guardarLoteBienes(
  bienes: BienDeUsoDTO[],
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<BienDeUsoDTO[]>> {
  const resultados = await Promise.all(
    bienes.map(async (b) => {
      const campos = await actualizarBienDeUsoAction(b.id, ejercicioId, sociedadId, {
        categoria: b.categoria,
        costoInicioReexpresado: b.costoInicioReexpresado,
        costoAjusteInflacion: b.costoAjusteInflacion,
        altas: b.altas,
        bajas: b.bajas,
        depAcumInicio: b.depAcumInicio,
        depAjusteInflacion: b.depAjusteInflacion,
        depBajas: b.depBajas,
        depEjercicio: b.depEjercicio,
      })
      if (!campos.ok) return campos
      return actualizarNetoAnteriorManualAction(
        b.id,
        ejercicioId,
        sociedadId,
        b.netoResidualAnteriorManual,
      )
    }),
  )
  const fallo = resultados.find((r) => !r.ok)
  if (fallo && !fallo.ok) return fallo
  return actionOk(resultados.map((r) => (r as { ok: true; data: BienDeUsoDTO }).data))
}
