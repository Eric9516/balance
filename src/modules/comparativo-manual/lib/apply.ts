/**
 * Aplica los comparativos manuales a los datos de estados y gastos.
 * Puro — no modifica los originales, devuelve copias con los valores sobreescritos.
 */

import type { EstadosData, EERRData, RubroFila } from '@/modules/estados/domain/types'
import type { GastosSecciones, GastoSeccion } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import { parsSeccionDeClaveHuerfano, type ComparativoManualDTO } from '../domain/types'

// ─── Aplicar comparativos al EstadosData (SSP + EERR) ────────────────────────

export function applyComparativosToEstados(
  data: EstadosData,
  comparativos: ComparativoManualDTO[],
  nivelSSP: 'SECCION' | 'RUBRO',
): EstadosData {
  const sspItems = comparativos.filter((c) => c.modulo === 'SSP')
  const eerrItems = comparativos.filter((c) => c.modulo === 'EERR')
  const gastosItems = comparativos.filter((c) => c.modulo === 'GASTOS')

  const eerrMap = new Map(eerrItems.map((c) => [c.clave, c.valor]))
  const gastosMap = new Map(gastosItems.map((c) => [c.clave, c.valor]))

  // ── SSP ────────────────────────────────────────────────────────────────────
  let sspRubros: RubroFila[] = data.sspRubros

  if (nivelSSP === 'RUBRO' && sspItems.length > 0) {
    const sspMap = new Map(sspItems.map((c) => [c.clave, c.valor]))
    // Override displayValueAnt para rubros existentes
    sspRubros = data.sspRubros.map((r) => ({
      ...r,
      displayValueAnt: sspMap.has(r.id) ? (sspMap.get(r.id) ?? 0) : r.displayValueAnt,
    }))
    // Agregar rubros huérfanos (existían antes, ya no existen)
    // Si el clave tiene sección codificada (sec:{seccion}:{ts}), se asigna
    // a la sección correcta y contribuye a sus totales.
    // Si no tiene sección (formato legacy), seccionSSP = null → aparece
    // en la sección "Del período anterior" al final del SSP.
    const huerfanos = sspItems.filter((c) => c.esHuerfano)
    for (const h of huerfanos) {
      const seccionSSP = parsSeccionDeClaveHuerfano(h.clave)
      sspRubros.push({
        id: h.clave,
        codigo: h.clave,
        nombre: h.label,
        estadoDestino: 'SSP',
        seccionSSP,
        seccionEERR: null,
        naturalezaEsperada: 'DEUDORA',
        orden: 9999 + h.orden,
        displayValue: 0,
        displayValueAnt: h.valor,
        notaNumero: null,
        cuentas: [],
      })
    }
  }

  // ── EERR ───────────────────────────────────────────────────────────────────
  const ingresosAnt = eerrMap.get('INGRESOS') ?? data.eerr.ingresosAnt
  const costoVentasAnt = eerrMap.get('COSTO_VENTAS') ?? data.eerr.costoVentasAnt
  const rfAnt = eerrMap.get('RESULTADOS_FINANCIEROS') ?? data.eerr.resultadosFinancierosAnt
  const igAnt = eerrMap.get('IMPUESTO_GANANCIAS') ?? data.eerr.impuestoGananciasAnt

  // Gastos: override totalAnt por sección + agregar secciones huérfanas
  const seccionesGasto = data.eerr.seccionesGasto.map((s) => ({
    ...s,
    totalAnt: gastosMap.has(s.key) ? (gastosMap.get(s.key) ?? 0) : s.totalAnt,
  }))
  const huerfanosGastos = gastosItems.filter((c) => c.esHuerfano)
  for (const h of huerfanosGastos) {
    seccionesGasto.push({ key: h.clave, nombre: h.label, total: 0, totalAnt: h.valor })
  }

  // Recalcular subtotales comparativos
  const totalGastosAnt = seccionesGasto.reduce((acc, s) => acc + s.totalAnt, 0)
  const utilidadBrutaAnt = ingresosAnt - costoVentasAnt
  const resultadoAntesIGAnt = utilidadBrutaAnt - totalGastosAnt + rfAnt
  const utilidadEjercicioAnt = resultadoAntesIGAnt - igAnt

  const eerr: EERRData = {
    ...data.eerr,
    ingresosAnt,
    costoVentasAnt,
    resultadosFinancierosAnt: rfAnt,
    impuestoGananciasAnt: igAnt,
    seccionesGasto,
    utilidadBrutaAnt,
    resultadoAntesIGAnt,
    utilidadEjercicioAnt,
  }

  return { ...data, sspRubros, eerr }
}

// ─── Aplicar comparativos al GastosSecciones ─────────────────────────────────

export function applyComparativosToGastos(
  data: GastosSecciones,
  comparativos: ComparativoManualDTO[],
): GastosSecciones {
  const gastosMap = new Map(
    comparativos.filter((c) => c.modulo === 'GASTOS').map((c) => [c.clave, c]),
  )

  const secciones: GastoSeccion[] = data.secciones.map((s) => ({
    ...s,
    totalAnterior: gastosMap.has(s.key)
      ? (gastosMap.get(s.key)?.valor ?? s.totalAnterior)
      : s.totalAnterior,
  }))

  // Secciones huérfanas: existían antes, ya no existen en el ejercicio actual
  const huerfanos = [...gastosMap.values()].filter((c) => c.esHuerfano)
  for (const h of huerfanos) {
    secciones.push({
      key: h.clave,
      grupoId: null,
      grupoNombre: h.label,
      grupoSigla: null,
      esGastoDefault: false,
      aparecEnEERR: true,
      filas: [],
      total: 0,
      totalAnterior: h.valor,
    })
  }

  return { ...data, secciones }
}

// ─── Construir CostoVentasDTO anterior desde comparativos manuales ────────────

export function buildCostoVentasAntFromComparativos(
  ejercicioId: string,
  comparativos: ComparativoManualDTO[],
): CostoVentasDTO | null {
  const items = comparativos.filter((c) => c.modulo === 'COSTO_VENTAS')
  if (items.length === 0) return null
  const map = new Map(items.map((c) => [c.clave, c.valor]))
  return {
    id: 'manual',
    ejercicioId,
    existenciaInicial: map.get('existenciaInicial') ?? 0,
    compras: map.get('compras') ?? 0,
    gastosFabricacion: map.get('gastosFabricacion') ?? 0,
    existenciaFinal: map.get('existenciaFinal') ?? 0,
  }
}
