/**
 * Servicio: carga de los estados contables (SSP + EERR) y del E.E.P.N. de un ejercicio,
 * resolviendo el comparativo y los saldos de inicio según el modo del ejercicio anterior.
 * Única forma de obtener estos datos (la página, la compuerta de autorización y la nota
 * de transición pasan por acá).
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { findGastosDinamicos } from '@/modules/gastos/repository/gastos-dinamico.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { findMovimientosPN } from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import { derivarDesdeAnteriorPN } from '@/modules/patrimonio-neto/domain/saldosInicio'
import { armarEvolucionPN } from '@/modules/patrimonio-neto/domain/evolucion'
import type { EvolucionPNData } from '@/modules/patrimonio-neto/domain/types'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import {
  editarAnteriorManual,
  mostrarColumnaAnterior,
  resolverCostoVentasAnterior,
  resolverEstados,
} from '@/modules/comparativo-manual/lib/politica'
import type { EstadosData } from '../domain/types'
import { buildEstadosData } from '../lib/aggregate'
import { ajustarCostoVentas, ajustarCuentas, getCoeficienteComparativo } from '../lib/ajuste'
import { sumar, sumarPor } from '@/lib/importe'

export type EstadosConPN = {
  estadosData: EstadosData
  pnData: EvolucionPNData
  comparativos: ComparativoManualDTO[]
  coeficiente: number
  anteriorId: string | null
}

export async function cargarEstadosConPN(
  ejercicio: EjercicioContableDTO,
  cuentas: CuentaContableDTO[],
): Promise<EstadosConPN> {
  const ejercicioId = ejercicio.id
  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const coeficiente = getCoeficienteComparativo(ejercicio)

  const [
    rubros,
    cuentasAntRaw,
    costoVentas,
    costoVentasAntRaw,
    gastosRaw,
    notas,
    comparativos,
    movsAnterior,
    movsActual,
  ] = await Promise.all([
    findRubrosBase(),
    anteriorId ? findCuentasByEjercicio(anteriorId) : Promise.resolve([] as CuentaContableDTO[]),
    findCostoVentas(ejercicioId),
    anteriorId ? findCostoVentas(anteriorId) : Promise.resolve(null),
    findGastosDinamicos(ejercicioId, anteriorId),
    findNotasByEjercicio(ejercicioId),
    editarAnteriorManual(modo)
      ? findComparativoByEjercicio(ejercicioId)
      : Promise.resolve([] as ComparativoManualDTO[]),
    anteriorId ? findMovimientosPN(anteriorId) : Promise.resolve([]),
    findMovimientosPN(ejercicioId),
  ])

  const costoVentasAnt = resolverCostoVentasAnterior(
    ajustarCostoVentas(costoVentasAntRaw, coeficiente),
    modo,
    comparativos,
    ejercicioId,
  )

  // Gastos: se pasan CRUDOS; resolverEstados aplica (en MANUAL) las filas manuales de
  // gastos sobre las líneas del EERR. Aplicarlas dos veces duplicaría secciones huérfanas.
  const raw = buildEstadosData(cuentas, rubros, {
    cuentasAnt: ajustarCuentas(cuentasAntRaw, coeficiente),
    costoVentas,
    costoVentasAnt,
    gastosDinamicos: gastosRaw,
    notas,
    hayEjercicioAnterior: mostrarColumnaAnterior(modo),
  })
  const estadosData = resolverEstados(raw, modo, comparativos)

  const pnData = armarEvolucionPN({
    ejercicioId,
    guardados: movsActual,
    resultadoEjercicio: estadosData.eerr.utilidadEjercicio,
    modo,
    derivado: derivarDesdeAnteriorPN(movsAnterior, coeficiente),
  })

  return { estadosData, pnData, comparativos, coeficiente, anteriorId }
}

/** Totales de la columna "Ejercicio anterior" del SSP (para el cuadre del anterior). */
export function totalesAnteriorSSP(estadosData: EstadosData, pnData: EvolucionPNData) {
  const sec = (key: string) =>
    sumarPor(
      estadosData.sspRubros.filter((r) => r.seccionSSP === key),
      (r) => r.displayValueAnt,
    )
  return {
    activo: sumar(sec('ACTIVO_CORRIENTE'), sec('ACTIVO_NO_CORRIENTE')),
    pasivo: sumar(sec('PASIVO_CORRIENTE'), sec('PASIVO_NO_CORRIENTE')),
    patrimonioNeto: pnData.totalAnterior,
  }
}
