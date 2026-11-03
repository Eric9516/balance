import type { LineaNotaEERR } from './lineasDeNotas'
// ─── Fila individual de cuenta (dentro de un rubro) ──────────────────────────

export type FilaCuenta = {
  id: string
  codigo: string
  nombre: string
  displayValue: number
}

// ─── Rubro agregado con cuentas ───────────────────────────────────────────────

export type RubroFila = {
  id: string
  codigo: string
  nombre: string
  estadoDestino: 'SSP' | 'EERR' | 'PN'
  seccionSSP: string | null
  seccionEERR: string | null
  naturalezaEsperada: 'DEUDORA' | 'ACREEDORA'
  orden: number
  displayValue: number
  displayValueAnt: number // valor del ejercicio anterior (mismo signo)
  notaNumero: number | null // número de nota asociada para mostrar "(Nota X)"
  cuentas: FilaCuenta[]
  /**
   * Carga manual: el anterior del rubro se carga en su detalle (la nota de composición, cuenta por
   * cuenta, o el Anexo I, por categoría) y no se escribe en el estado.
   */
  anteriorDesdeDetalle?: AnteriorDesdeDetalle
  /**
   * Una nota ubicada como fila (solo tiene importe anterior). `debajoDe` es la fila que queda arriba
   * (null: al principio de la sección). Ver domain/lineasDeNotas.
   */
  notaFila?: { notaId: string; debajoDe: string | null }
}

export type AnteriorDesdeDetalle = {
  /** Dónde se carga: la nota de composición del rubro o el Anexo I (bienes de uso). */
  fuente: 'NOTA' | 'ANEXO_I'
  /**
   * CARGADO: el anterior es el total del detalle. ESCRITO_ANTES: el detalle todavía no tiene el
   * anterior y se muestra el importe que se había escrito en el estado (antes de esta regla).
   * PENDIENTE: ni una cosa ni la otra (o las notas todavía no se generaron).
   */
  estado: 'CARGADO' | 'ESCRITO_ANTES' | 'PENDIENTE'
  /** null si las notas todavía no se generaron. */
  notaId: string | null
  notaNumero: number | null
  notaTitulo: string | null
  /** Filas de la nota con su importe anterior, para mostrarlas debajo del rubro. */
  filas: { concepto: string; importeAnterior: number }[]
}

// ─── Datos completos para los estados ────────────────────────────────────────

// Una sección de gasto del Anexo III que aparece como línea en el EERR
export type GastoSeccionEERR = {
  key: string // identificador único (ej: 'grupo:abc123')
  nombre: string // nombre de la sección para mostrar
  total: number
  totalAnt: number
}

export type EERRData = {
  // Líneas del EERR (valores siempre positivos — el signo lo aplica el componente)
  ingresos: number
  ingresosAnt: number
  notaIngresosNum: number | null

  costoVentas: number // de Anexo II si existe, sino de cuentas
  costoVentasAnt: number
  notaCostoVentasNum: number | null
  usaAnexoCosto: boolean // true = viene del Anexo II

  seccionesGasto: GastoSeccionEERR[] // cada sección del Anexo III como línea EERR
  usaAnexoGastos: boolean // true = viene del Anexo III dinámico

  resultadosFinancieros: number
  resultadosFinancierosAnt: number
  rfCuentas: FilaCuenta[]

  impuestoGanancias: number
  impuestoGananciasAnt: number
  igCuentas: FilaCuenta[]

  /** Notas ubicadas como filas del estado (solo tienen importe en la columna anterior). */
  lineasNota?: LineaNotaEERR[]

  // Subtotales calculados
  utilidadBruta: number
  utilidadBrutaAnt: number
  resultadoAntesIG: number
  resultadoAntesIGAnt: number
  utilidadEjercicio: number
  utilidadEjercicioAnt: number
}

export type EstadosData = {
  sspRubros: RubroFila[]
  /**
   * Si el anterior se ajustó: los rubros con su anterior sin ajustar. La columna del ejercicio actual
   * nunca se ajusta, así que lo que arrastra del anterior (el efectivo al inicio del flujo) sale de acá.
   */
  sspRubrosSinAjustar?: RubroFila[]
  eerrRubros: RubroFila[]
  eerr: EERRData
  patrimonioNetoFinal: number | null
  patrimonioNetoFinalAnt: number | null
  sinClasificar: number
  totalCuentas: number
  hayEjercicioAnterior: boolean
}
