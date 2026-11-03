/**
 * Servicio: carga de los estados contables (SSP + EERR) y del E.E.P.N. de un ejercicio,
 * resolviendo el comparativo y los saldos de inicio según el modo del ejercicio anterior.
 * Única forma de obtener estos datos (la página, la compuerta de autorización y la nota
 * de transición pasan por acá).
 */

import {
  aplicarFilasNotaSSP,
  aplicarLineasDeNotas,
  notasParaUbicar,
  type NotaParaUbicar,
} from '../domain/lineasDeNotas'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import {
  aplicarArrastreCostoVentas,
  existenciaFinalAnteriorDesdeNotas,
} from '@/modules/costo-ventas/domain/saldosInicio'
import { findGastosDinamicos } from '@/modules/gastos/repository/gastos-dinamico.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { notaPorRubro } from '@/modules/notas/domain/types'
import { generaNotaCuantitativa } from '@/modules/notas/domain/regeneracion'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import type { BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import { REGLA_POR_CLAVE } from '@/modules/documentos/domain/reglas'
import { findMovimientosPN } from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import { derivarDesdeAnteriorPN } from '@/modules/patrimonio-neto/domain/saldosInicio'
import { armarEvolucionPN } from '@/modules/patrimonio-neto/domain/evolucion'
import type { EvolucionPNData } from '@/modules/patrimonio-neto/domain/types'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import {
  editarAnteriorManual,
  usarDerivadoDelAnterior,
  mostrarColumnaAnterior,
  resolverCostoVentasAnterior,
  resolverEstados,
  resolverGastos,
} from '@/modules/comparativo-manual/lib/politica'
import type { EstadosData } from '../domain/types'
import { buildEstadosData } from '../lib/aggregate'
import {
  ajustarCostoVentas,
  ajustarCuentas,
  ajustarGastos,
  getCoeficienteComparativo,
  getIndicesReexpresion,
  SIN_REEXPRESION,
} from '../lib/ajuste'
import { sumar, sumarPor } from '@/lib/importe'
import {
  ajustarComparativos,
  ajustarMovimientosPN,
  ajustarNetosAnexoI,
  ajustarNotas,
  indicesDelAnteriorManual,
} from '@/modules/comparativo-manual/lib/ajuste'
import type { NotaDTO } from '@/modules/notas/domain/types'
import type { EvolucionPNMovimientoDTO } from '@/modules/patrimonio-neto/domain/types'

export type EstadosConPN = {
  estadosData: EstadosData
  pnData: EvolucionPNData
  comparativos: ComparativoManualDTO[]
  coeficiente: number
  anteriorId: string | null
  /** Notas que se pueden ubicar como filas del Estado de Resultados (carga manual). */
  notasParaUbicar: NotaParaUbicar[]
  /** Anterior manual ya ajustado: los mismos estados con lo cargado, para mostrarlo al lado. */
  cargado: { estadosData: EstadosData; pnData: EvolucionPNData } | null
}

export async function cargarEstadosConPN(
  ejercicio: EjercicioContableDTO,
  cuentas: CuentaContableDTO[],
): Promise<EstadosConPN> {
  const ejercicioId = ejercicio.id
  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const indices = getIndicesReexpresion(ejercicio)

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
    bienesDeUso,
  ] = await Promise.all([
    findRubrosBase(ejercicio.estudioId),
    anteriorId ? findCuentasByEjercicio(anteriorId) : Promise.resolve([] as CuentaContableDTO[]),
    findCostoVentas(ejercicioId),
    anteriorId ? findCostoVentas(anteriorId) : Promise.resolve(null),
    findGastosDinamicos(ejercicio.estudioId, ejercicioId, anteriorId),
    findNotasByEjercicio(ejercicioId),
    editarAnteriorManual(modo)
      ? findComparativoByEjercicio(ejercicioId)
      : Promise.resolve([] as ComparativoManualDTO[]),
    anteriorId ? findMovimientosPN(anteriorId) : Promise.resolve([]),
    findMovimientosPN(ejercicioId),
    // Carga manual: el anterior de bienes de uso sale del Anexo I.
    editarAnteriorManual(modo)
      ? findBienesDeUso(ejercicioId)
      : Promise.resolve([] as BienDeUsoDTO[]),
  ])

  // La existencia inicial es de este año y nunca se ajusta: vinculado, es la final del anterior como
  // cerró (lo guardado antes de esta regla puede estar ajustado).
  const costoVentasActual = usarDerivadoDelAnterior(modo)
    ? aplicarArrastreCostoVentas(costoVentas, costoVentasAntRaw, modo).datos
    : costoVentas

  const idsConCuentas = new Set(cuentas.flatMap((c) => c.notaEjercicioId ?? []))

  // Una sola lectura: con el anterior ajustado se arma dos veces, ajustado y con lo cargado.
  const armar = (
    comparativos: ComparativoManualDTO[],
    notas: NotaDTO[],
    bienesDeUso: BienDeUsoDTO[],
    movsActual: EvolucionPNMovimientoDTO[],
    indicesVinculado = indices,
  ) => {
    const costoVentasAnt = resolverCostoVentasAnterior(
      ajustarCostoVentas(costoVentasAntRaw, indicesVinculado),
      modo,
      comparativos,
      ejercicioId,
      editarAnteriorManual(modo)
        ? existenciaFinalAnteriorDesdeNotas({ rubros, cuentas, notas })
        : null,
    )

    // Gastos: el Anexo III ya resuelto según el modo es la única fuente de las líneas de gasto
    // del EERR. En MANUAL sus totales del anterior por sección se calculan desde las filas
    // (resolverGastos); resolverEstados no vuelve a aplicar gastos.
    const gastos = resolverGastos(ajustarGastos(gastosRaw, indicesVinculado), modo, comparativos)
    const raw = buildEstadosData(cuentas, rubros, {
      cuentasAnt: ajustarCuentas(cuentasAntRaw, indicesVinculado),
      costoVentas: costoVentasActual,
      costoVentasAnt,
      gastosDinamicos: gastos,
      notas,
      hayEjercicioAnterior: mostrarColumnaAnterior(modo),
    })
    // Dónde se carga el anterior de cada rubro con detalle: su nota (con la nota, si ya se generó)
    // o, bienes de uso, el Anexo I (los rubros que sugieren ese anexo).
    const notaDeRubro = notaPorRubro(cuentas, notas)
    const rubrosAnexoI = new Set(REGLA_POR_CLAVE.get('ANEXO_BIENES_USO')?.rubros ?? [])
    const resueltos = resolverEstados(raw, modo, comparativos, {
      notas: new Map(
        rubros.filter(generaNotaCuantitativa).map((r) => [r.id, notaDeRubro.get(r.id) ?? null]),
      ),
      bienesDeUso: {
        rubroIds: new Set(rubros.filter((r) => rubrosAnexoI.has(r.codigo)).map((r) => r.id)),
        categorias: bienesDeUso,
      },
    })
    // Carga manual: las notas ubicadas como filas entran en los subtotales del anterior.
    const estadosData = editarAnteriorManual(modo)
      ? {
          ...resueltos,
          eerr: aplicarLineasDeNotas(resueltos.eerr, notas, idsConCuentas),
          sspRubros: aplicarFilasNotaSSP(resueltos.sspRubros, notas, idsConCuentas),
        }
      : resueltos

    const pnData = armarEvolucionPN({
      ejercicioId,
      guardados: movsActual,
      resultadoEjercicio: estadosData.eerr.utilidadEjercicio,
      modo,
      derivado: derivarDesdeAnteriorPN(movsAnterior, indices),
      resultadoAnterior: editarAnteriorManual(modo) ? estadosData.eerr.utilidadEjercicioAnt : null,
    })
    return { estadosData, pnData }
  }

  const manual = indicesDelAnteriorManual(ejercicio)
  const { estadosData, pnData: pnAjustado } = armar(
    ajustarComparativos(comparativos, manual),
    ajustarNotas(notas, manual),
    ajustarNetosAnexoI(bienesDeUso, manual),
    ajustarMovimientosPN(movsActual, manual),
  )

  // Ya ajustado, la columna anterior del E.E.P.N. no se edita: se corrige desde el paso del anterior.
  const pnData = manual
    ? { ...pnAjustado, bloqueo: { ...pnAjustado.bloqueo, totalAnterior: true } }
    : pnAjustado

  const cargado = manual ? armar(comparativos, notas, bienesDeUso, movsActual) : null
  const sspRubrosSinAjustar =
    cargado?.estadosData.sspRubros ??
    (usarDerivadoDelAnterior(modo) && indices.actual !== indices.anterior
      ? armar(comparativos, notas, bienesDeUso, movsActual, SIN_REEXPRESION).estadosData.sspRubros
      : undefined)

  return {
    estadosData: sspRubrosSinAjustar ? { ...estadosData, sspRubrosSinAjustar } : estadosData,
    pnData,
    comparativos,
    notasParaUbicar: editarAnteriorManual(modo)
      ? notasParaUbicar(ajustarNotas(notas, manual), idsConCuentas)
      : [],
    coeficiente: getCoeficienteComparativo(ejercicio),
    anteriorId,
    cargado,
  }
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
