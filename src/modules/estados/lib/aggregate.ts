import type { CuentaContableDTO, RubroBaseSimple } from '@/modules/importaciones/domain/types'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { NotaDTO } from '@/modules/notas/domain/types'
import type { EstadosData, RubroFila, FilaCuenta, EERRData } from '../domain/types'
import { calcularCostoTotal } from '@/modules/costo-ventas/domain/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Corrige el signo para presentación.
 *  ACREEDORA (pasivos, PN, ingresos): saldo negativo en sumas y saldos → positivo en presentación
 *  DEUDORA (activos, gastos): saldo positivo → positivo en presentación
 */
function signFor(naturaleza: string, saldo: number): number {
  return naturaleza === 'ACREEDORA' ? -saldo : saldo
}

/** Agrupa cuentas por rubro y calcula displayValue */
function buildRubroFilas(
  cuentas: CuentaContableDTO[],
  cuentasAnt: CuentaContableDTO[],
  rubros: RubroBaseSimple[],
  notaNumeroByRubroId: Map<string, number | null>,
): RubroFila[] {
  const byRubro = new Map<string, CuentaContableDTO[]>()
  const byRubroAnt = new Map<string, CuentaContableDTO[]>()

  for (const c of cuentas.filter((c) => c.rubroBaseId)) {
    const list = byRubro.get(c.rubroBaseId!) ?? []
    list.push(c)
    byRubro.set(c.rubroBaseId!, list)
  }
  for (const c of cuentasAnt.filter((c) => c.rubroBaseId)) {
    const list = byRubroAnt.get(c.rubroBaseId!) ?? []
    list.push(c)
    byRubroAnt.set(c.rubroBaseId!, list)
  }

  const filasMap = new Map<string, RubroFila>()

  // Build from current year
  for (const [rubroId, cs] of byRubro) {
    const rubro = rubros.find((r) => r.id === rubroId)
    if (!rubro) continue

    const totalSaldo = cs.reduce((acc, c) => acc + c.saldoFinal, 0)
    const displayValue = signFor(rubro.naturalezaEsperada, totalSaldo)

    const cuentaFilas: FilaCuenta[] = cs
      .map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        displayValue: signFor(rubro.naturalezaEsperada, c.saldoFinal),
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))

    filasMap.set(rubroId, {
      id: rubro.id,
      codigo: rubro.codigo,
      nombre: rubro.nombre,
      estadoDestino: rubro.estadoDestino,
      seccionSSP: rubro.seccionSSP,
      seccionEERR: rubro.seccionEERR,
      naturalezaEsperada: rubro.naturalezaEsperada,
      orden: rubro.orden,
      displayValue,
      displayValueAnt: 0,
      notaNumero: notaNumeroByRubroId.get(rubroId) ?? null,
      cuentas: cuentaFilas,
    })
  }

  // Patch prior year values
  for (const [rubroId, cs] of byRubroAnt) {
    const rubro = rubros.find((r) => r.id === rubroId)
    if (!rubro) continue
    const totalSaldo = cs.reduce((acc, c) => acc + c.saldoFinal, 0)
    const displayValueAnt = signFor(rubro.naturalezaEsperada, totalSaldo)
    if (filasMap.has(rubroId)) {
      filasMap.get(rubroId)!.displayValueAnt = displayValueAnt
    } else {
      // Rubro exists in prior year but not current — still show it
      filasMap.set(rubroId, {
        id: rubro.id,
        codigo: rubro.codigo,
        nombre: rubro.nombre,
        estadoDestino: rubro.estadoDestino,
        seccionSSP: rubro.seccionSSP,
        seccionEERR: rubro.seccionEERR,
        naturalezaEsperada: rubro.naturalezaEsperada,
        orden: rubro.orden,
        displayValue: 0,
        displayValueAnt,
        notaNumero: notaNumeroByRubroId.get(rubroId) ?? null,
        cuentas: [],
      })
    }
  }

  return Array.from(filasMap.values()).sort((a, b) => a.orden - b.orden)
}

/** Suma displayValues de cuentas de cierta sección EERR */
function sumEerr(filasMap: Map<string, RubroFila>, seccion: string, ant = false): number {
  let total = 0
  for (const fila of filasMap.values()) {
    if (fila.seccionEERR === seccion) {
      total += ant ? fila.displayValueAnt : fila.displayValue
    }
  }
  return total
}

// ─── Función principal ────────────────────────────────────────────────────────

export function buildEstadosData(
  cuentas: CuentaContableDTO[],
  rubros: RubroBaseSimple[],
  options: {
    cuentasAnt?: CuentaContableDTO[]
    costoVentas?: CostoVentasDTO | null
    costoVentasAnt?: CostoVentasDTO | null
    gastosDinamicos?: GastosSecciones | null
    patrimonioNetoFinal?: number | null
    patrimonioNetoFinalAnt?: number | null
    notas?: NotaDTO[]
    hayEjercicioAnterior?: boolean
  } = {},
): EstadosData {
  const {
    cuentasAnt = [],
    costoVentas,
    costoVentasAnt,
    gastosDinamicos = null,
    patrimonioNetoFinal = null,
    patrimonioNetoFinalAnt = null,
    notas = [],
    hayEjercicioAnterior = false,
  } = options

  const sinClasificar = cuentas.filter((c) => !c.rubroBaseId).length

  // ── Mapear nota.numero por rubroId ─────────────────────────────────────────
  // Para cada nota, encontrar el rubro al que pertenecen sus cuentas y asignar el número
  const notaNumeroByRubroId = new Map<string, number | null>()
  for (const cuenta of cuentas) {
    if (cuenta.rubroBaseId && cuenta.notaEjercicioId) {
      const nota = notas.find((n) => n.id === cuenta.notaEjercicioId)
      if (nota?.numero != null && !notaNumeroByRubroId.has(cuenta.rubroBaseId)) {
        notaNumeroByRubroId.set(cuenta.rubroBaseId, nota.numero)
      }
    }
  }

  // ── Construir todas las filas ──────────────────────────────────────────────
  const todasFilas = buildRubroFilas(cuentas, cuentasAnt, rubros, notaNumeroByRubroId)

  // ── SSP: activos + pasivos + PN ────────────────────────────────────────────
  // Regla: Bienes de Cambio toma su valor de la Existencia Final del Anexo II
  // (si existe). Si no hay Anexo II, usa el saldo de las cuentas clasificadas.
  const esBienesCambio = (nombre: string) =>
    nombre.toLowerCase().includes('bien') && nombre.toLowerCase().includes('cambio')

  const sspRubros = todasFilas
    .filter((r) => r.estadoDestino === 'SSP' || r.estadoDestino === 'PN')
    .sort((a, b) => a.orden - b.orden)
    .map((r) => {
      if (!esBienesCambio(r.nombre)) return r
      return {
        ...r,
        displayValue:    costoVentas    ? costoVentas.existenciaFinal    : r.displayValue,
        displayValueAnt: costoVentasAnt ? costoVentasAnt.existenciaFinal : r.displayValueAnt,
      }
    })

  // ── EERR por rubro (para Ingresos, RF, IG) ─────────────────────────────────
  const eerrFilasMap = new Map(
    todasFilas
      .filter((r) => r.estadoDestino === 'EERR')
      .map((r) => [r.id, r]),
  )

  // Fuente de datos para cada sección
  const ingresosVal = sumEerr(eerrFilasMap, 'INGRESOS')
  const ingresosAntVal = sumEerr(eerrFilasMap, 'INGRESOS', true)

  const rfVal = sumEerr(eerrFilasMap, 'RESULTADOS_FINANCIEROS')
  const rfAntVal = sumEerr(eerrFilasMap, 'RESULTADOS_FINANCIEROS', true)
  const rfCuentas = todasFilas
    .filter((r) => r.seccionEERR === 'RESULTADOS_FINANCIEROS')
    .flatMap((r) => r.cuentas)

  const igVal = sumEerr(eerrFilasMap, 'IMPUESTO_GANANCIAS')
  const igAntVal = sumEerr(eerrFilasMap, 'IMPUESTO_GANANCIAS', true)
  const igCuentas = todasFilas
    .filter((r) => r.seccionEERR === 'IMPUESTO_GANANCIAS')
    .flatMap((r) => r.cuentas)

  // Nota numbers para ingresos y costo ventas
  const notaIngresosNum = todasFilas
    .find((r) => r.seccionEERR === 'INGRESOS')
    ?.notaNumero ?? null

  const notaCostoVentasNum = todasFilas
    .find((r) => r.seccionEERR === 'COSTO_VENTAS')
    ?.notaNumero ?? null

  // Costo ventas: Anexo II si existe, sino de cuentas
  const usaAnexoCosto = !!(costoVentas)
  const costoVal = usaAnexoCosto
    ? calcularCostoTotal(costoVentas!)
    : sumEerr(eerrFilasMap, 'COSTO_VENTAS')
  const costoAntVal = costoVentasAnt
    ? calcularCostoTotal(costoVentasAnt)
    : sumEerr(eerrFilasMap, 'COSTO_VENTAS', true)

  // Gastos: única fuente de verdad = Anexo III dinámico.
  // Cada sección del Anexo III es una línea separada en el EERR.
  // Solo las secciones marcadas como aparecEnEERR=true aparecen como líneas en el EERR.
  // Las secciones con aparecEnEERR=false (ej: gastos vinculados al costo) van al Anexo III
  // pero no se deducen en el EERR porque ya están capturadas en el Costo de Ventas (Anexo II).
  const seccionesGasto: import('../domain/types').GastoSeccionEERR[] =
    (gastosDinamicos?.secciones ?? [])
      .filter((s) => s.aparecEnEERR)
      .map((s) => ({
        key: s.key,
        nombre: s.grupoNombre,
        total: s.total,
        totalAnt: s.totalAnterior,
      }))

  const usaAnexoGastos = seccionesGasto.length > 0
  const totalGastos = seccionesGasto.reduce((acc, s) => acc + s.total, 0)
  const totalGastosAnt = seccionesGasto.reduce((acc, s) => acc + s.totalAnt, 0)

  // Subtotales
  const utilidadBruta = ingresosVal - costoVal
  const utilidadBrutaAnt = ingresosAntVal - costoAntVal

  const resultadoAntesIG = utilidadBruta - totalGastos + rfVal
  const resultadoAntesIGAnt = utilidadBrutaAnt - totalGastosAnt + rfAntVal

  const utilidadEjercicio = resultadoAntesIG - igVal
  const utilidadEjercicioAnt = resultadoAntesIGAnt - igAntVal

  const eerr: EERRData = {
    ingresos: ingresosVal,
    ingresosAnt: ingresosAntVal,
    notaIngresosNum,
    costoVentas: costoVal,
    costoVentasAnt: costoAntVal,
    notaCostoVentasNum,
    usaAnexoCosto,
    seccionesGasto,
    usaAnexoGastos,
    resultadosFinancieros: rfVal,
    resultadosFinancierosAnt: rfAntVal,
    rfCuentas,
    impuestoGanancias: igVal,
    impuestoGananciasAnt: igAntVal,
    igCuentas,
    utilidadBruta,
    utilidadBrutaAnt,
    resultadoAntesIG,
    resultadoAntesIGAnt,
    utilidadEjercicio,
    utilidadEjercicioAnt,
  }

  const eerrRubros = todasFilas
    .filter((r) => r.estadoDestino === 'EERR')
    .sort((a, b) => a.orden - b.orden)

  return {
    sspRubros,
    eerrRubros,
    eerr,
    patrimonioNetoFinal,
    patrimonioNetoFinalAnt,
    sinClasificar,
    totalCuentas: cuentas.length,
    hayEjercicioAnterior,
  }
}
