/**
 * Servicio: Anexo II (Costo de ventas) de un ejercicio con la existencia inicial
 * arrastrada y la columna "Ejercicio anterior" resuelta según el modo. Única forma
 * de obtenerlo para la pantalla y el documento imprimible.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import {
  editarAnteriorManual,
  resolverCostoVentasAnterior,
} from '@/modules/comparativo-manual/lib/politica'
import { ajustarCostoVentas, getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import { aplicarArrastreCostoVentas, type ResultadoArrastreCV } from '../domain/saldosInicio'
import type { CostoVentasDTO } from '../domain/types'
import { findCostoVentas } from '../repository/costo-ventas.repository'

export type CostoVentasCargado = ResultadoArrastreCV & {
  /** Columna "Ejercicio anterior" ya resuelta por modo (null = sin comparativo). */
  datosAnteriores: CostoVentasDTO | null
  /** Conceptos que solo existieron en el ejercicio anterior (carga manual). */
  conceptosExtra: ComparativoManualDTO[]
}

export async function cargarCostoVentas(
  ejercicio: EjercicioContableDTO,
): Promise<CostoVentasCargado> {
  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const coeficiente = getCoeficienteComparativo(ejercicio)
  const [datos, anteriorRaw, comparativos] = await Promise.all([
    findCostoVentas(ejercicio.id),
    anteriorId ? findCostoVentas(anteriorId) : Promise.resolve(null),
    editarAnteriorManual(modo)
      ? findComparativoByEjercicio(ejercicio.id, 'COSTO_VENTAS')
      : Promise.resolve([] as ComparativoManualDTO[]),
  ])
  // El anterior en moneda de cierre: la existencia inicial es su existencia final reexpresada.
  const anterior = ajustarCostoVentas(anteriorRaw, coeficiente)
  const arrastre = aplicarArrastreCostoVentas(datos, anterior, modo)
  return {
    ...arrastre,
    datosAnteriores: resolverCostoVentasAnterior(anterior, modo, comparativos, ejercicio.id),
    conceptosExtra: comparativos.filter((c) => c.esHuerfano),
  }
}
