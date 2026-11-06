/**
 * Propuesta del Estado de Flujo de Efectivo desde el balance. Pura: sin acceso a la base.
 *
 * Es el método con que el estudio arma el flujo (método directo), definido por el dueño del producto
 * el 2026-11-06. La app propone cada línea y muestra de dónde sale; el contador revisa, corrige y la
 * usa o no. Nunca se guarda sola. Solo la columna del ejercicio actual.
 *
 * - Cobros por ventas: los ingresos del Estado de Resultados.
 * - Pagos a proveedores: compras del Anexo II + gastos del Anexo III, menos los de personal, los
 *   impuestos y lo que no es un pago (amortizaciones, previsiones). Cada gasto se clasifica: la app
 *   sugiere por el nombre de la cuenta y el contador lo corrige.
 * - Pagos al personal y pagos de impuestos: esos gastos del Anexo III.
 * - Variaciones del activo y del pasivo corrientes contra el anterior ajustado: si el activo
 *   aumenta, resta; si el pasivo aumenta, suma. Afuera quedan caja y bancos (es el efectivo), los
 *   bienes de cambio (ya están en las compras), las inversiones (actividades de inversión) y los
 *   préstamos (actividades de financiación). El contador puede sacar o agregar rubros.
 * - Impuesto a las ganancias: lo efectivamente pagado, que carga el contador. Para no contarlo dos
 *   veces, a la variación de los pasivos se le resta la de la posición del impuesto (deuda menos
 *   anticipos), que es el devengado menos lo pagado.
 * - Bienes de uso (Anexo I, valor de origen): las bajas suman y las altas restan.
 * - Aportes de los propietarios: en el primer ejercicio, el capital y los aportes del saldo al
 *   inicio del E.E.P.N.
 * - Préstamos: lo recibido suma y lo devuelto resta. Con un balance de sumas y saldos la app no ve
 *   los movimientos: los carga el contador, con la variación del saldo como referencia.
 * - El RECPAM no se propone: es la diferencia que calcula la app para que el estado cierre.
 */

import { restar, sumar, sumarPor } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'
import { normalizarConcepto } from './calculo'
import type { OrigenLineaFlujo } from './types'

const pesos = (n: number) => formatCurrency(n, { decimales: 'todos' })

// ─── Gastos del Anexo III ────────────────────────────────────────────────────

export type TipoGasto = 'PROVEEDORES' | 'PERSONAL' | 'IMPUESTOS' | 'NO_ES_PAGO'

export const TIPO_GASTO_LABELS: Record<TipoGasto, string> = {
  PROVEEDORES: 'Proveedores',
  PERSONAL: 'Personal y cargas sociales',
  IMPUESTOS: 'Impuestos',
  NO_ES_PAGO: 'No es un pago (amortización, previsión)',
}

const NO_ES_PAGO = /amortiz|depreciac|previsi|incobrab|desvaloriz/
const PERSONAL =
  /sueldo|jornal|cargas? social|contribuciones? patronal|aportes? patronal|aguinaldo|\bsac\b|vacacion|indemniz|sindicat|\bart\b/
const IMPUESTOS =
  /impuesto|\bimp\b|ingresos brutos|\biibb\b|\btasas?\b|sellos|\bafip\b|\barca\b|inmobiliario|automotor|multa/

/** Lo que sugiere la app por el nombre de la cuenta. El contador lo puede cambiar. */
export function sugerirTipoGasto(nombreCuenta: string): TipoGasto {
  const n = normalizarConcepto(nombreCuenta)
  if (NO_ES_PAGO.test(n)) return 'NO_ES_PAGO'
  if (PERSONAL.test(n)) return 'PERSONAL'
  if (IMPUESTOS.test(n)) return 'IMPUESTOS'
  return 'PROVEEDORES'
}

// ─── Variaciones de activos y pasivos corrientes ─────────────────────────────

/** Rubros que por defecto no entran en las variaciones, y por qué. */
const EXCLUIDOS_POR_CODIGO: Record<string, string> = {
  'ACT-CTE-02': 'Inversiones: van en las actividades de inversión.',
  'ACT-CTE-09': 'Bienes de cambio: su variación ya está en las compras del Anexo II.',
  'ACT-CTE-10': 'Inversiones: van en las actividades de inversión.',
  'PAS-CTE-02': 'Préstamos: van en las actividades de financiación.',
}

/** Códigos de los préstamos (corrientes y no corrientes): su variación es la referencia. */
export const CODIGOS_PRESTAMOS = ['PAS-CTE-02', 'PAS-NCTE-02']

export type RubroVariacion = {
  id: string
  nombre: string
  lado: 'ACTIVO' | 'PASIVO'
  actual: number
  /** El anterior ya ajustado (la columna anterior del balance). */
  anterior: number
  /** null = entra por defecto; si no, por qué queda afuera. */
  motivoExcluido: string | null
}

/** Qué rubros entran por defecto: afuera el efectivo y los de EXCLUIDOS_POR_CODIGO. */
export function motivoExclusion(codigo: string, esEfectivo: boolean): string | null {
  if (esEfectivo) return 'Caja y bancos: es el efectivo.'
  return EXCLUIDOS_POR_CODIGO[codigo] ?? null
}

// ─── Insumos, elecciones y propuesta ─────────────────────────────────────────

export type GastoDelAnexo = { cuentaId: string; nombre: string; seccion: string; importe: number }

/** Lo que la app ya tiene del balance (todo del ejercicio actual, salvo el anterior ajustado). */
export type InsumosPropuesta = {
  /** Estado de Resultados: ventas netas. */
  ingresos: number
  /** Anexo II: compras del ejercicio (null: el balance no tiene Anexo II). */
  compras: number | null
  /** Anexo III, cuenta por cuenta. */
  gastos: GastoDelAnexo[]
  /** Activo y pasivo corrientes del Estado de Situación Patrimonial. */
  rubros: RubroVariacion[]
  /** Anexo I, valor de origen (null: sin bienes de uso). */
  bienesDeUso: { altas: number; bajas: number } | null
  /** Primer ejercicio: capital y aportes del saldo al inicio (null: no es el primero). */
  aportes: number | null
  /** Para que el contador cargue lo que la app no puede ver. */
  referencias: {
    prestamos: { actual: number; anterior: number }
    /** Impuesto a las ganancias devengado (Estado de Resultados). */
    impuestoGanancias: number
  }
}

/** Lo que decide el contador en la propuesta. */
export type EleccionesPropuesta = {
  /** Por cuenta del Anexo III; lo que falta usa la sugerencia. */
  tiposGasto: Record<string, TipoGasto>
  /** Rubros que cambian lo de por defecto: true = entra, false = queda afuera. */
  rubros: Record<string, boolean>
  /** Impuesto a las ganancias efectivamente pagado (null: no lo cargó). */
  gananciasPagado: number | null
  prestamosRecibidos: number | null
  prestamosCancelados: number | null
}

export const SIN_ELECCIONES: EleccionesPropuesta = {
  tiposGasto: {},
  rubros: {},
  gananciasPagado: null,
  prestamosRecibidos: null,
  prestamosCancelados: null,
}

export type LineaPropuesta = {
  origen: OrigenLineaFlujo
  /** Positivo = ingreso de efectivo, negativo = egreso. */
  importe: number
  /** De dónde sale, en palabras, con los importes completos. */
  detalle: string[]
}

export type Propuesta = {
  lineas: LineaPropuesta[]
  /** Lo que falta o conviene mirar (queda en el RECPAM hasta que se cargue). */
  avisos: string[]
}

export function tipoDeGasto(g: GastoDelAnexo, e: EleccionesPropuesta): TipoGasto {
  return e.tiposGasto[g.cuentaId] ?? sugerirTipoGasto(g.nombre)
}

export function rubroIncluido(r: RubroVariacion, e: EleccionesPropuesta): boolean {
  return e.rubros[r.id] ?? r.motivoExcluido === null
}

const negar = (n: number) => restar(0, n)

/** La propuesta con lo que tiene el balance y lo que eligió el contador. */
export function proponerFlujo(insumos: InsumosPropuesta, e: EleccionesPropuesta): Propuesta {
  const lineas: LineaPropuesta[] = []
  const avisos: string[] = []
  const linea = (origen: OrigenLineaFlujo, importe: number, detalle: string[]) =>
    lineas.push({ origen, importe, detalle })

  // ── Cobros ─────────────────────────────────────────────────────────────────
  linea('COBROS_VENTAS', insumos.ingresos, [
    `Ingresos del Estado de Resultados: ${pesos(insumos.ingresos)}.`,
  ])

  // ── Pagos: gastos del Anexo III por tipo ───────────────────────────────────
  const porTipo = (t: TipoGasto) =>
    sumarPor(
      insumos.gastos.filter((g) => tipoDeGasto(g, e) === t),
      (g) => g.importe,
    )
  const totalGastos = sumarPor(insumos.gastos, (g) => g.importe)
  const personal = porTipo('PERSONAL')
  const impuestos = porTipo('IMPUESTOS')
  const noEsPago = porTipo('NO_ES_PAGO')
  const compras = insumos.compras ?? 0
  if (insumos.compras === null) {
    avisos.push('El balance no tiene Anexo II (costo de ventas): no hay compras que sumar.')
  }
  linea(
    'PAGOS_PROVEEDORES',
    negar(restar(sumar(compras, totalGastos), personal, impuestos, noEsPago)),
    [
      `Compras del ejercicio (Anexo II): ${pesos(compras)}.`,
      `Más el total de gastos del Anexo III: ${pesos(totalGastos)}.`,
      `Menos personal y cargas sociales: ${pesos(personal)}.`,
      `Menos impuestos: ${pesos(impuestos)}.`,
      `Menos lo que no es un pago (amortizaciones, previsiones): ${pesos(noEsPago)}.`,
    ],
  )
  linea('PAGOS_PERSONAL', negar(personal), [
    `Gastos de personal y cargas sociales del Anexo III: ${pesos(personal)}.`,
  ])
  linea('PAGOS_IMPUESTOS', negar(impuestos), [`Impuestos del Anexo III: ${pesos(impuestos)}.`])

  // ── Impuesto a las ganancias ───────────────────────────────────────────────
  const devengado = insumos.referencias.impuestoGanancias
  const ajusteGanancias = e.gananciasPagado === null ? 0 : restar(devengado, e.gananciasPagado)
  if (e.gananciasPagado !== null) {
    linea('PAGOS_GANANCIAS', negar(e.gananciasPagado), [
      `Lo pagado en el ejercicio, que cargó el contador: ${pesos(e.gananciasPagado)}.`,
      `Devengado en el Estado de Resultados: ${pesos(devengado)}.`,
    ])
  } else if (devengado !== 0) {
    avisos.push(
      `Falta lo pagado de impuesto a las ganancias (el devengado es ${pesos(devengado)}). Mientras no lo cargues, queda en el RECPAM.`,
    )
  }

  // ── Variaciones de activos y pasivos corrientes ────────────────────────────
  const variacion = (lado: RubroVariacion['lado']) => {
    const rubros = insumos.rubros.filter((r) => r.lado === lado && rubroIncluido(r, e))
    return {
      total: sumarPor(rubros, (r) => restar(r.actual, r.anterior)),
      detalle: rubros
        .filter((r) => restar(r.actual, r.anterior) !== 0)
        .map(
          (r) =>
            `${r.nombre}: ${pesos(r.actual)} contra ${pesos(r.anterior)} (variación ${pesos(restar(r.actual, r.anterior))}).`,
        ),
    }
  }
  const activos = variacion('ACTIVO')
  linea('VARIACION_ACTIVOS', negar(activos.total), [
    'Activo corriente, actual contra el anterior ajustado: si aumenta, resta; si baja, suma.',
    ...activos.detalle,
  ])
  const pasivos = variacion('PASIVO')
  linea('VARIACION_PASIVOS', restar(pasivos.total, ajusteGanancias), [
    'Pasivo corriente, actual contra el anterior ajustado: si aumenta, suma; si baja, resta.',
    ...pasivos.detalle,
    ...(ajusteGanancias !== 0
      ? [
          `Menos la variación del impuesto a las ganancias (devengado menos lo pagado): ${pesos(ajusteGanancias)}, que ya está en su línea.`,
        ]
      : []),
  ])

  // ── Inversión: bienes de uso ───────────────────────────────────────────────
  if (insumos.bienesDeUso) {
    const { altas, bajas } = insumos.bienesDeUso
    linea('PAGOS_BIENES_USO', negar(altas), [
      `Altas del Anexo I (valor de origen): ${pesos(altas)}.`,
    ])
    linea('COBROS_BIENES_USO', bajas, [`Bajas del Anexo I (valor de origen): ${pesos(bajas)}.`])
  }

  // ── Financiación ───────────────────────────────────────────────────────────
  if (insumos.aportes !== null) {
    linea('APORTES', insumos.aportes, [
      `Primer ejercicio: capital y aportes del saldo al inicio del E.E.P.N.: ${pesos(insumos.aportes)}.`,
    ])
  }
  const { prestamos } = insumos.referencias
  if (e.prestamosRecibidos !== null) {
    linea('PRESTAMOS_RECIBIDOS', e.prestamosRecibidos, [
      `Lo recibido en el ejercicio, que cargó el contador: ${pesos(e.prestamosRecibidos)}.`,
    ])
  }
  if (e.prestamosCancelados !== null) {
    linea('PRESTAMOS_CANCELADOS', negar(e.prestamosCancelados), [
      `Lo devuelto en el ejercicio, que cargó el contador: ${pesos(e.prestamosCancelados)}.`,
    ])
  }
  const variacionPrestamos = restar(prestamos.actual, prestamos.anterior)
  if (e.prestamosRecibidos === null && e.prestamosCancelados === null && variacionPrestamos !== 0) {
    avisos.push(
      `Los préstamos pasaron de ${pesos(prestamos.anterior)} a ${pesos(prestamos.actual)}. Cargá lo recibido y lo devuelto en el ejercicio; mientras tanto, queda en el RECPAM.`,
    )
  }

  return { lineas, avisos }
}

/**
 * Las líneas que se crean o se actualizan: las que tienen importe, más las que ya existen (para
 * ponerlas al día, aunque ahora den cero).
 */
export function lineasParaAplicar(
  propuesta: Propuesta,
  existentes: ReadonlySet<OrigenLineaFlujo>,
): LineaPropuesta[] {
  return propuesta.lineas.filter((l) => l.importe !== 0 || existentes.has(l.origen))
}
