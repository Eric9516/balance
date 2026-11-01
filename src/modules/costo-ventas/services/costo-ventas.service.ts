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
import { ajustarCostoVentas, getIndicesReexpresion } from '@/modules/estados/lib/ajuste'
import {
  ajustarComparativos,
  ajustarNotas,
  indicesDelAnteriorManual,
} from '@/modules/comparativo-manual/lib/ajuste'
import {
  aplicarArrastreCostoVentas,
  existenciaFinalAnteriorDesdeNotas,
  type ResultadoArrastreCV,
} from '../domain/saldosInicio'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import type { CostoVentasDTO } from '../domain/types'
import { findCostoVentas } from '../repository/costo-ventas.repository'

export type CostoVentasCargado = ResultadoArrastreCV & {
  /** Columna "Ejercicio anterior" ya resuelta por modo (null = sin comparativo). */
  datosAnteriores: CostoVentasDTO | null
  /** Conceptos que solo existieron en el ejercicio anterior (carga manual). */
  conceptosExtra: ComparativoManualDTO[]
  /** Carga manual: existencia final del año anterior propuesta desde la nota de bienes de cambio. */
  existenciaFinalAnteriorPropuesta: number | null
  /** Anterior manual ya ajustado: lo que se había cargado, para mostrarlo al lado. */
  cargado: { anterior: CostoVentasDTO | null; conceptosExtra: ComparativoManualDTO[] } | null
}

/**
 * El Anexo II del año anterior resuelto según el modo: vinculado, el del anterior reexpresado;
 * manual, lo cargado en la columna "Ejercicio anterior" con la existencia final propuesta desde la
 * nota de bienes de cambio. Lo usan la pantalla, el documento y el guardado (mismo arrastre).
 */
export async function cargarAnteriorCostoVentas(ejercicio: EjercicioContableDTO): Promise<{
  anterior: CostoVentasDTO | null
  comparativos: ComparativoManualDTO[]
  propuesta: number | null
  cargado: CostoVentasCargado['cargado']
  /** Para la existencia inicial de este año, que nunca se ajusta. */
  anteriorSinAjustar: CostoVentasDTO | null
}> {
  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const manual = editarAnteriorManual(modo)
  // Una sola oleada: lo del anterior y, en carga manual, lo que hace falta para la propuesta.
  const [anteriorRaw, comparativos, rubros, cuentas, notas] = await Promise.all([
    anteriorId ? findCostoVentas(anteriorId) : Promise.resolve(null),
    manual
      ? findComparativoByEjercicio(ejercicio.id, 'COSTO_VENTAS')
      : Promise.resolve([] as ComparativoManualDTO[]),
    manual ? findRubrosBase(ejercicio.estudioId) : Promise.resolve([]),
    manual ? findCuentasByEjercicio(ejercicio.id) : Promise.resolve([]),
    manual ? findNotasByEjercicio(ejercicio.id) : Promise.resolve([]),
  ])
  const indicesManual = indicesDelAnteriorManual(ejercicio)
  const ajustados = ajustarComparativos(comparativos, indicesManual)
  const propuesta = manual
    ? existenciaFinalAnteriorDesdeNotas({
        rubros,
        cuentas,
        notas: ajustarNotas(notas, indicesManual),
      })
    : null
  const anterior = resolverCostoVentasAnterior(
    ajustarCostoVentas(anteriorRaw, getIndicesReexpresion(ejercicio)),
    modo,
    ajustados,
    ejercicio.id,
    propuesta,
  )
  const anteriorCargado = indicesManual
    ? resolverCostoVentasAnterior(
        null,
        modo,
        comparativos,
        ejercicio.id,
        existenciaFinalAnteriorDesdeNotas({ rubros, cuentas, notas }),
      )
    : null
  return {
    anterior,
    comparativos: ajustados,
    propuesta,
    cargado: indicesManual
      ? {
          anterior: anteriorCargado,
          conceptosExtra: comparativos.filter((c) => c.esHuerfano),
        }
      : null,
    anteriorSinAjustar: indicesManual ? anteriorCargado : (anteriorRaw ?? anterior),
  }
}

export async function cargarCostoVentas(
  ejercicio: EjercicioContableDTO,
): Promise<CostoVentasCargado> {
  const [datos, { anterior, comparativos, propuesta, cargado, anteriorSinAjustar }] =
    await Promise.all([findCostoVentas(ejercicio.id), cargarAnteriorCostoVentas(ejercicio)])
  return {
    // La existencia inicial es la existencia final del anterior (vinculado o cargado a mano). Es de
    // este año: nunca se ajusta.
    ...aplicarArrastreCostoVentas(datos, anteriorSinAjustar, modoEfectivo(ejercicio)),
    datosAnteriores: anterior,
    conceptosExtra: comparativos.filter((c) => c.esHuerfano),
    existenciaFinalAnteriorPropuesta: propuesta,
    cargado,
  }
}
