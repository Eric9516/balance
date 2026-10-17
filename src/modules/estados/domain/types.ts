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
  eerrRubros: RubroFila[]
  eerr: EERRData
  patrimonioNetoFinal: number | null
  patrimonioNetoFinalAnt: number | null
  sinClasificar: number
  totalCuentas: number
  hayEjercicioAnterior: boolean
}
