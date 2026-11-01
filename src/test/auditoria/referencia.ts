/**
 * Balances de referencia de la auditoría (`pnpm auditoria`). Empresas ficticias de Córdoba con
 * todos los resultados calculados de antemano, FUERA de la app: si la app calcula mal, la auditoría
 * lo ve en vez de copiar el error. Importes en pesos; saldo > 0 deudor, < 0 acreedor.
 *
 * Tres escenarios del ejercicio anterior:
 *  A. Servicios Serranos S.A.S. — primer balance (2025), sin ejercicio anterior.
 *  B. Distribuidora Ferretera del Centro S.A.S. — 2025 con el anterior (2024) cargado a mano y
 *     primera aplicación de la RT 54 (ajuste por provisión de vacaciones, −150.000 en RNA).
 *  C. La misma distribuidora — 2026 vinculado al 2025, coeficiente 1,30. Aparecen cuentas que
 *     disparan anexos y notas nuevas (plazo fijo, software, previsión), se cancela el préstamo (rubro
 *     solo del anterior) y desaparece un gasto (comisiones a vendedores).
 */

export type Cuenta = [codigo: string, nombre: string, rubro: string, saldo: number]

export type CategoriaBDU = {
  categoria: string
  costoInicio: number
  altas: number
  bajas: number
  depInicio: number
  depEjercicio: number
  depBajas: number
  /** Ajuste por inflación del valor de origen y de la amortización al comienzo (vinculado). */
  ajusteCosto?: number
  ajusteDep?: number
  /** Carga manual: neto residual al cierre del ejercicio anterior. */
  netoAnterior?: number
}

export type MovimientoPN = {
  tipo: string
  capitalSuscripto?: number
  ajusteCapital?: number
  reservaLegal?: number
  rdosNoAsignados?: number
  totalAnterior?: number
}

export type ItemFlujo = {
  seccion: 'ACTIVIDADES_OPERATIVAS' | 'ACTIVIDADES_INVERSION' | 'ACTIVIDADES_FINANCIAMIENTO'
  concepto: string
  importe: number
  importeAnterior?: number
}

/** Lo que un contador cargaría del ejercicio anterior a mano (modo MANUAL). */
export type AnteriorManual = {
  /** Saldo del ejercicio anterior de cada cuenta que sigue existiendo (por nombre). */
  porCuenta: Record<string, number>
  /** Cuentas que solo existieron el año anterior: van como fila extra en la nota del rubro. */
  soloAnterior: { rubro: string; nombre: string; valor: number }[]
  /** Gastos del año anterior. `seccion` para los que solo existieron ese año o si la fila
   *  está en varias secciones (un importe por sección). */
  gastos: { nombre: string; valor: number; seccion?: string }[]
  eerr: { ingresos: number; costoVentas: number; resultadosFinancieros: number; impuesto: number }
  costoVentas: {
    existenciaInicial: number
    compras: number
    gastosFabricacion: number
    existenciaFinal: number
  }
  flujo: { efectivoInicio: number }
}

export type Esperado = {
  activo: number
  pasivo: number
  patrimonioNeto: number
  ingresos: number
  costoVentas: number
  gastos: Record<string, number>
  resultadosFinancieros: number
  impuesto: number
  resultado: number
  /** Total por rubro del SSP (código de rubro → importe). */
  rubros: Record<string, number>
  efectivoCierre: number
  bienesDeUsoNeto: number
  amortizacionEjercicio: number
  costoVentasAnexo?: {
    existenciaInicial: number
    compras: number
    existenciaFinal: number
    costo: number
  }
  /** Documentos que la app tiene que sugerir (anexos y notas por regla). */
  documentosSugeridos: string[]
  /** Filas del Anexo III que solo existieron el año anterior, con su importe anterior. */
  gastosSoloAnterior?: { nombre: string; valor: number }[]
  anterior?: {
    activo: number
    pasivo: number
    patrimonioNeto: number
    resultado: number
    rubros: Record<string, number>
    gastos: Record<string, number>
    bienesDeUsoNeto: number
  }
}

export type Escenario = {
  id: 'A' | 'B' | 'C'
  titulo: string
  sociedad: { razonSocial: string; cuitBase: string; actividad: string; inscripcion: string }
  ejercicio: {
    numero: string
    inicio: string
    cierre: string
    modo: 'SIN_ANTERIOR' | 'MANUAL' | 'VINCULADO'
    indiceAnterior: string
    indiceActual: string
    adopcionRT54: 'PRIMERA_ADOPCION' | 'APLICACION_CONTINUADA'
  }
  cuentas: Cuenta[]
  documentos: { aceptar: string[]; descartar: string[] }
  bienesDeUso: CategoriaBDU[]
  costoVentas?: {
    existenciaInicial: number
    compras: number
    gastosFabricacion: number
    existenciaFinal: number
  }
  pn: MovimientoPN[]
  flujo: ItemFlujo[]
  transicion?: { concepto: string; importePN: number }
  anteriorManual?: AnteriorManual
  esperado: Esperado
}

const ADM = 'legacy:GASTOS_ADM'
const COM = 'legacy:GASTOS_COM'
const BAN = 'legacy:GASTOS_BANCARIOS'
const IIC = 'legacy:IMPUESTOS_CONTRIBUCIONES'

// ─── A. Primer balance ────────────────────────────────────────────────────────

export const ESCENARIO_A: Escenario = {
  id: 'A',
  titulo: 'Servicios Serranos S.A.S. — primer balance 2025 (sin ejercicio anterior)',
  sociedad: {
    razonSocial: 'Servicios Serranos S.A.S.',
    cuitBase: '3071234501',
    actividad: 'Servicios de consultoría',
    inscripcion: '2024-11-15',
  },
  ejercicio: {
    numero: '1',
    inicio: '2025-01-01',
    cierre: '2025-12-31',
    modo: 'SIN_ANTERIOR',
    indiceAnterior: '100',
    indiceActual: '100',
    adopcionRT54: 'APLICACION_CONTINUADA', // sociedad nueva: no hay transición
  },
  cuentas: [
    ['1.1.01', 'Caja', 'ACT-CTE-01', 150_000],
    ['1.1.02', 'Banco Bancor c/c', 'ACT-CTE-01', 2_305_500],
    ['1.2.01', 'Deudores por servicios', 'ACT-CTE-03', 800_000],
    ['1.3.01', 'Retenciones IIBB sufridas', 'ACT-CTE-05', 45_000.5],
    ['1.5.01', 'Equipos de computación (v.o.)', 'ACT-NCTE-09', 1_200_000],
    ['1.5.02', 'Amort. acum. equipos de computación', 'ACT-NCTE-09', -240_000],
    ['2.1.01', 'Proveedores', 'PAS-CTE-01', -300_000],
    ['2.3.01', 'IVA a pagar', 'PAS-CTE-03', -120_000],
    ['2.3.02', 'IIBB a pagar', 'PAS-CTE-03', -35_000],
    ['2.3.03', 'Impuesto a las ganancias a pagar', 'PAS-CTE-03', -400_000],
    ['2.4.01', 'Sueldos a pagar', 'PAS-CTE-04', -400_000],
    ['2.4.02', 'Cargas sociales a pagar', 'PAS-CTE-04', -180_000],
    ['3.1.01', 'Capital social', 'PN-01', -1_000_000],
    ['4.1.01', 'Ingresos por servicios', 'EERR-ING-01', -6_000_000],
    ['5.1.01', 'Sueldos y jornales', 'EERR-GADM-01', 2_400_000],
    ['5.1.02', 'Honorarios profesionales', 'EERR-GADM-01', 600_000],
    ['5.1.03', 'Amortizaciones bienes de uso', 'EERR-GADM-01', 240_000],
    ['5.2.01', 'Publicidad', 'EERR-GCOM-01', 300_000],
    ['5.3.01', 'Comisiones bancarias', 'EERR-GBAN-01', 54_499.5],
    ['5.4.01', 'Ingresos brutos', 'EERR-IICC-01', 180_000],
    ['5.5.01', 'Impuesto a las ganancias', 'EERR-IMP-01', 400_000],
  ],
  documentos: {
    aceptar: ['ANEXO_BIENES_USO', 'ANEXO_GASTOS', 'NOTA_DEUDAS_FISCALES', 'NOTA_DEUDAS_LABORALES'],
    descartar: [],
  },
  bienesDeUso: [
    {
      categoria: 'Equipos de computación',
      costoInicio: 0,
      altas: 1_200_000,
      bajas: 0,
      depInicio: 0,
      depEjercicio: 240_000,
      depBajas: 0,
    },
  ],
  // Primer ejercicio: no hay fila para la suscripción de capital; el contador la pone al inicio.
  pn: [{ tipo: 'SALDO_INICIO', capitalSuscripto: 1_000_000 }],
  flujo: [
    { seccion: 'ACTIVIDADES_OPERATIVAS', concepto: 'Cobros por servicios', importe: 5_200_000 },
    {
      seccion: 'ACTIVIDADES_OPERATIVAS',
      concepto: 'Pagos de gastos e impuestos',
      importe: -2_544_500,
    },
    {
      seccion: 'ACTIVIDADES_INVERSION',
      concepto: 'Compra de equipos de computación',
      importe: -1_200_000,
    },
    { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Aporte de capital', importe: 1_000_000 },
  ],
  esperado: {
    activo: 4_260_500.5,
    pasivo: 1_435_000,
    patrimonioNeto: 2_825_500.5,
    ingresos: 6_000_000,
    costoVentas: 0,
    gastos: { [ADM]: 3_240_000, [COM]: 300_000, [BAN]: 54_499.5, [IIC]: 180_000 },
    resultadosFinancieros: 0,
    impuesto: 400_000,
    resultado: 1_825_500.5,
    rubros: {
      'ACT-CTE-01': 2_455_500,
      'ACT-CTE-03': 800_000,
      'ACT-CTE-05': 45_000.5,
      'ACT-NCTE-09': 960_000,
      'PAS-CTE-01': 300_000,
      'PAS-CTE-03': 555_000,
      'PAS-CTE-04': 580_000,
    },
    efectivoCierre: 2_455_500,
    bienesDeUsoNeto: 960_000,
    amortizacionEjercicio: 240_000,
    documentosSugeridos: [
      'ANEXO_BIENES_USO',
      'ANEXO_GASTOS',
      'NOTA_DEUDAS_FISCALES',
      'NOTA_DEUDAS_LABORALES',
    ],
  },
}

// ─── B. 2025 con el anterior (2024) cargado a mano ────────────────────────────

export const ESCENARIO_B: Escenario = {
  id: 'B',
  titulo:
    'Distribuidora Ferretera del Centro S.A.S. — 2025 con el 2024 cargado a mano (primera aplicación RT 54)',
  sociedad: {
    razonSocial: 'Distribuidora Ferretera del Centro S.A.S.',
    cuitBase: '3071234502',
    actividad: 'Venta al por mayor de artículos de ferretería',
    inscripcion: '2018-03-01',
  },
  ejercicio: {
    numero: '3',
    inicio: '2025-01-01',
    cierre: '2025-12-31',
    modo: 'MANUAL',
    indiceAnterior: '100',
    indiceActual: '100',
    adopcionRT54: 'PRIMERA_ADOPCION',
  },
  cuentas: [
    ['1.1.01', 'Caja', 'ACT-CTE-01', 250_000],
    ['1.1.02', 'Banco Bancor c/c', 'ACT-CTE-01', 394_749.25],
    ['1.1.03', 'Banco Galicia c/c', 'ACT-CTE-01', 620_000],
    ['1.2.01', 'Deudores por ventas', 'ACT-CTE-03', 3_400_000],
    ['1.2.02', 'Documentos a cobrar', 'ACT-CTE-03', 900_000],
    ['1.3.01', 'Retenciones IIBB sufridas', 'ACT-CTE-05', 185_250.75],
    ['1.3.02', 'Anticipos impuesto a las ganancias', 'ACT-CTE-05', 300_000],
    ['1.4.01', 'Mercaderías de reventa', 'ACT-CTE-09', 4_800_000],
    ['1.5.01', 'Rodados (v.o.)', 'ACT-NCTE-09', 6_000_000],
    ['1.5.02', 'Amort. acum. rodados', 'ACT-NCTE-09', -2_400_000],
    ['1.5.03', 'Muebles y útiles (v.o.)', 'ACT-NCTE-09', 1_500_000],
    ['1.5.04', 'Amort. acum. muebles y útiles', 'ACT-NCTE-09', -600_000],
    ['2.1.01', 'Proveedores', 'PAS-CTE-01', -3_100_000],
    ['2.2.01', 'Préstamo Banco Bancor', 'PAS-CTE-02', -1_800_000],
    ['2.3.01', 'IVA a pagar', 'PAS-CTE-03', -420_000],
    ['2.3.02', 'IIBB a pagar', 'PAS-CTE-03', -95_000],
    ['2.3.03', 'Impuesto a las ganancias a pagar', 'PAS-CTE-03', -950_000],
    ['2.4.01', 'Sueldos a pagar', 'PAS-CTE-04', -550_000],
    ['2.4.02', 'Cargas sociales a pagar', 'PAS-CTE-04', -310_000],
    ['2.4.03', 'Provisión vacaciones', 'PAS-CTE-04', -150_000],
    ['3.1.01', 'Capital social', 'PN-01', -2_000_000],
    ['3.2.01', 'Reserva legal', 'PN-03', -200_000],
    ['3.3.01', 'Resultados no asignados', 'PN-04', -4_000_000],
    ['4.1.01', 'Ventas', 'EERR-ING-01', -32_000_000],
    ['5.1.01', 'Costo de mercaderías vendidas', 'EERR-CST-01', 18_000_000],
    ['5.2.01', 'Sueldos y jornales', 'EERR-GADM-01', 3_600_000],
    ['5.2.02', 'Cargas sociales', 'EERR-GADM-01', 1_080_000],
    ['5.2.03', 'Amortizaciones bienes de uso', 'EERR-GADM-01', 900_000],
    ['5.2.04', 'Honorarios profesionales', 'EERR-GADM-01', 720_000],
    // Mismo nombre en dos secciones: la fila del anexo queda en dos columnas.
    ['5.3.01', 'Sueldos y jornales', 'EERR-GCOM-01', 1_400_000],
    ['5.3.02', 'Fletes y acarreos', 'EERR-GCOM-01', 1_250_000],
    ['5.3.03', 'Comisiones a vendedores', 'EERR-GCOM-01', 900_000],
    ['5.4.01', 'Comisiones bancarias', 'EERR-GBAN-01', 145_000],
    ['5.5.01', 'Ingresos brutos', 'EERR-IICC-01', 900_000],
    ['5.6.01', 'Intereses préstamo bancario', 'EERR-RFIN-01', 380_000],
    ['5.7.01', 'Impuesto a las ganancias', 'EERR-IMP-01', 950_000],
  ],
  documentos: {
    aceptar: [
      'ANEXO_BIENES_USO',
      'ANEXO_COSTO_VENTAS',
      'ANEXO_GASTOS',
      'NOTA_BIENES_CAMBIO',
      'NOTA_DEUDAS_FISCALES',
      'NOTA_DEUDAS_LABORALES',
      'NOTA_TRANSICION_RT54',
    ],
    descartar: [],
  },
  bienesDeUso: [
    {
      categoria: 'Rodados',
      costoInicio: 6_000_000,
      altas: 0,
      bajas: 0,
      depInicio: 1_800_000,
      depEjercicio: 600_000,
      depBajas: 0,
      netoAnterior: 4_200_000,
    },
    {
      categoria: 'Muebles y útiles',
      costoInicio: 1_200_000,
      altas: 300_000,
      bajas: 0,
      depInicio: 300_000,
      depEjercicio: 300_000,
      depBajas: 0,
      netoAnterior: 900_000,
    },
    // Vendidos en 2025: existían en 2024 con neto 80.000.
    {
      categoria: 'Equipos de computación',
      costoInicio: 400_000,
      altas: 0,
      bajas: 400_000,
      depInicio: 320_000,
      depEjercicio: 0,
      depBajas: 320_000,
      netoAnterior: 80_000,
    },
  ],
  costoVentas: {
    existenciaInicial: 4_200_000,
    compras: 18_600_000,
    gastosFabricacion: 0,
    existenciaFinal: 4_800_000,
  },
  pn: [
    {
      tipo: 'SALDO_INICIO',
      capitalSuscripto: 2_000_000,
      reservaLegal: 120_000,
      rdosNoAsignados: 5_730_000,
      totalAnterior: 7_900_000,
    },
    { tipo: 'MODIFICACION_INICIO', rdosNoAsignados: -150_000 },
    { tipo: 'DISTRIB_DIVIDENDOS', rdosNoAsignados: -1_500_000, totalAnterior: -80_000 },
    { tipo: 'DISTRIB_RESERVA_LEGAL', reservaLegal: 80_000, rdosNoAsignados: -80_000 },
    { tipo: 'RESULTADO_EJERCICIO', totalAnterior: 30_000 },
  ],
  flujo: [
    {
      seccion: 'ACTIVIDADES_OPERATIVAS',
      concepto: 'Cobros a clientes',
      importe: 31_000_000,
      importeAnterior: 25_580_000,
    },
    {
      seccion: 'ACTIVIDADES_OPERATIVAS',
      concepto: 'Pagos a proveedores y empleados',
      importe: -27_735_250.75,
      importeAnterior: -24_300_000,
    },
    {
      seccion: 'ACTIVIDADES_OPERATIVAS',
      concepto: 'Pagos de impuestos',
      importe: -1_200_000,
      importeAnterior: -800_000,
    },
    { seccion: 'ACTIVIDADES_INVERSION', concepto: 'Compra de muebles y útiles', importe: -300_000 },
    {
      seccion: 'ACTIVIDADES_INVERSION',
      concepto: 'Venta de equipos de computación',
      importe: 80_000,
    },
    { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Pago de préstamo', importe: -600_000 },
    { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Pago de intereses', importe: -380_000 },
    {
      seccion: 'ACTIVIDADES_FINANCIAMIENTO',
      concepto: 'Dividendos pagados',
      importe: -1_500_000,
      importeAnterior: -80_000,
    },
  ],
  transicion: {
    concepto: 'Reconocimiento de la provisión para vacaciones devengadas',
    importePN: -150_000,
  },
  anteriorManual: {
    porCuenta: {
      Caja: 200_000,
      'Banco Bancor c/c': 1_200_000,
      'Banco Galicia c/c': 500_000,
      'Deudores por ventas': 2_800_000,
      'Documentos a cobrar': 500_000,
      'Retenciones IIBB sufridas': 150_000,
      'Anticipos impuesto a las ganancias': 30_000,
      'Mercaderías de reventa': 4_200_000,
      Proveedores: 2_700_000,
      'Préstamo Banco Bancor': 2_400_000,
      'IVA a pagar': 380_000,
      'IIBB a pagar': 100_000,
      'Impuesto a las ganancias a pagar': 500_000,
      'Sueldos a pagar': 550_000,
      'Cargas sociales a pagar': 310_000,
      'Provisión vacaciones': 0,
      Ventas: 26_000_000,
      'Costo de mercaderías vendidas': 15_600_000,
    },
    soloAnterior: [{ rubro: 'ACT-CTE-05', nombre: 'Saldo a favor IVA', valor: 30_000 }],
    gastos: [
      { nombre: 'Sueldos y jornales', valor: 3_000_000, seccion: ADM },
      { nombre: 'Sueldos y jornales', valor: 1_100_000, seccion: COM },
      { nombre: 'Cargas sociales', valor: 900_000 },
      { nombre: 'Amortizaciones bienes de uso', valor: 820_000 },
      { nombre: 'Honorarios profesionales', valor: 600_000 },
      { nombre: 'Fletes y acarreos', valor: 1_000_000 },
      { nombre: 'Comisiones a vendedores', valor: 700_000 },
      { nombre: 'Publicidad', valor: 350_000, seccion: COM }, // solo existió en 2024
      { nombre: 'Comisiones bancarias', valor: 120_000 },
      { nombre: 'Ingresos brutos', valor: 780_000 },
    ],
    eerr: {
      ingresos: 26_000_000,
      costoVentas: 15_600_000,
      resultadosFinancieros: -300_000,
      impuesto: 700_000,
    },
    costoVentas: {
      existenciaInicial: 3_800_000,
      compras: 16_000_000,
      gastosFabricacion: 0,
      existenciaFinal: 4_200_000,
    },
    flujo: { efectivoInicio: 1_500_000 },
  },
  esperado: {
    activo: 15_350_000,
    pasivo: 7_375_000,
    patrimonioNeto: 7_975_000,
    ingresos: 32_000_000,
    costoVentas: 18_000_000,
    gastos: { [ADM]: 6_300_000, [COM]: 3_550_000, [BAN]: 145_000, [IIC]: 900_000 },
    resultadosFinancieros: -380_000,
    impuesto: 950_000,
    resultado: 1_775_000,
    rubros: {
      'ACT-CTE-01': 1_264_749.25,
      'ACT-CTE-03': 4_300_000,
      'ACT-CTE-05': 485_250.75,
      'ACT-CTE-09': 4_800_000,
      'ACT-NCTE-09': 4_500_000,
      'PAS-CTE-01': 3_100_000,
      'PAS-CTE-02': 1_800_000,
      'PAS-CTE-03': 1_465_000,
      'PAS-CTE-04': 1_010_000,
    },
    efectivoCierre: 1_264_749.25,
    bienesDeUsoNeto: 4_500_000,
    amortizacionEjercicio: 900_000,
    costoVentasAnexo: {
      existenciaInicial: 4_200_000,
      compras: 18_600_000,
      existenciaFinal: 4_800_000,
      costo: 18_000_000,
    },
    documentosSugeridos: [
      'ANEXO_BIENES_USO',
      'ANEXO_COSTO_VENTAS',
      'ANEXO_GASTOS',
      'NOTA_BIENES_CAMBIO',
      'NOTA_DEUDAS_FISCALES',
      'NOTA_DEUDAS_LABORALES',
      'NOTA_TRANSICION_RT54',
    ],
    gastosSoloAnterior: [{ nombre: 'Publicidad', valor: 350_000 }],
    anterior: {
      activo: 14_790_000,
      pasivo: 6_940_000,
      patrimonioNeto: 7_850_000,
      resultado: 30_000,
      rubros: {
        'ACT-CTE-01': 1_900_000,
        'ACT-CTE-03': 3_300_000,
        'ACT-CTE-05': 210_000,
        'ACT-CTE-09': 4_200_000,
        'ACT-NCTE-09': 5_180_000,
        'PAS-CTE-01': 2_700_000,
        'PAS-CTE-02': 2_400_000,
        'PAS-CTE-03': 980_000,
        'PAS-CTE-04': 860_000,
      },
      gastos: { [ADM]: 5_320_000, [COM]: 3_150_000, [BAN]: 120_000, [IIC]: 780_000 },
      bienesDeUsoNeto: 5_180_000,
    },
  },
}

// ─── C. 2026 vinculado al 2025, coeficiente 1,30 ───────────────────────────────

export const ESCENARIO_C: Escenario = {
  id: 'C',
  titulo: 'Distribuidora Ferretera del Centro S.A.S. — 2026 vinculado al 2025 (coeficiente 1,30)',
  sociedad: ESCENARIO_B.sociedad,
  ejercicio: {
    numero: '4',
    inicio: '2026-01-01',
    cierre: '2026-12-31',
    modo: 'VINCULADO',
    indiceAnterior: '100',
    indiceActual: '130',
    adopcionRT54: 'APLICACION_CONTINUADA',
  },
  cuentas: [
    ['1.1.01', 'Caja', 'ACT-CTE-01', 300_000],
    ['1.1.02', 'Banco Bancor c/c', 'ACT-CTE-01', 167_500],
    ['1.1.03', 'Banco Galicia c/c', 'ACT-CTE-01', 900_000],
    ['1.1.04', 'Plazo fijo Banco Galicia', 'ACT-CTE-02', 1_000_000],
    ['1.2.01', 'Deudores por ventas', 'ACT-CTE-03', 4_000_000],
    ['1.3.01', 'Retenciones IIBB sufridas', 'ACT-CTE-05', 260_000],
    ['1.3.02', 'Anticipos impuesto a las ganancias', 'ACT-CTE-05', 400_000],
    ['1.4.01', 'Mercaderías de reventa', 'ACT-CTE-09', 5_500_000],
    ['1.5.01', 'Rodados (v.o.)', 'ACT-NCTE-09', 7_800_000],
    ['1.5.02', 'Amort. acum. rodados', 'ACT-NCTE-09', -3_900_000],
    ['1.5.03', 'Muebles y útiles (v.o.)', 'ACT-NCTE-09', 1_950_000],
    ['1.5.04', 'Amort. acum. muebles y útiles', 'ACT-NCTE-09', -1_170_000],
    ['1.6.01', 'Software de gestión', 'ACT-NCTE-12', 600_000],
    ['2.1.01', 'Proveedores', 'PAS-CTE-01', -3_900_000],
    ['2.3.01', 'IVA a pagar', 'PAS-CTE-03', -520_000],
    ['2.3.02', 'IIBB a pagar', 'PAS-CTE-03', -120_000],
    ['2.3.03', 'Impuesto a las ganancias a pagar', 'PAS-CTE-03', -1_200_000],
    ['2.4.01', 'Sueldos a pagar', 'PAS-CTE-04', -800_000],
    ['2.4.02', 'Cargas sociales a pagar', 'PAS-CTE-04', -400_000],
    ['2.4.03', 'Provisión vacaciones', 'PAS-CTE-04', -200_000],
    ['2.5.01', 'Previsión para juicios laborales', 'PAS-CTE-09', -250_000],
    ['3.1.01', 'Capital social', 'PN-01', -2_000_000],
    ['3.1.02', 'Ajuste de capital', 'PN-02', -600_000],
    ['3.2.01', 'Reserva legal', 'PN-03', -360_000],
    ['3.3.01', 'Resultados no asignados', 'PN-04', -5_407_500],
    ['4.1.01', 'Ventas', 'EERR-ING-01', -38_000_000],
    ['5.1.01', 'Costo de mercaderías vendidas', 'EERR-CST-01', 22_000_000],
    ['5.2.01', 'Sueldos y jornales', 'EERR-GADM-01', 4_600_000],
    ['5.2.02', 'Cargas sociales', 'EERR-GADM-01', 1_380_000],
    ['5.2.03', 'Amortizaciones bienes de uso', 'EERR-GADM-01', 1_170_000],
    ['5.2.04', 'Honorarios profesionales', 'EERR-GADM-01', 900_000],
    ['5.2.05', 'Cargo previsión juicios', 'EERR-GADM-01', 250_000],
    ['5.3.01', 'Sueldos y jornales', 'EERR-GCOM-01', 1_800_000],
    ['5.3.02', 'Fletes y acarreos', 'EERR-GCOM-01', 1_500_000],
    ['5.4.01', 'Comisiones bancarias', 'EERR-GBAN-01', 170_000],
    ['5.5.01', 'Ingresos brutos', 'EERR-IICC-01', 1_100_000],
    ['5.6.02', 'Intereses ganados plazo fijo', 'EERR-RFIN-01', -120_000],
    ['5.7.01', 'Impuesto a las ganancias', 'EERR-IMP-01', 1_200_000],
  ],
  documentos: {
    aceptar: [
      'ANEXO_BIENES_USO',
      'ANEXO_COSTO_VENTAS',
      'ANEXO_GASTOS',
      'NOTA_BIENES_CAMBIO',
      'NOTA_DEUDAS_FISCALES',
      'NOTA_DEUDAS_LABORALES',
      'NOTA_INTANGIBLES',
      'NOTA_INVERSIONES',
    ],
    // Se descarta a propósito: tiene que desaparecer de las notas y del documento.
    descartar: ['NOTA_PREVISIONES'],
  },
  bienesDeUso: [
    // Al comienzo, el cierre del 2025 (lo trae la app); el ajuste por inflación lo tipea el contador.
    {
      categoria: 'Rodados',
      costoInicio: 6_000_000,
      ajusteCosto: 1_800_000,
      altas: 0,
      bajas: 0,
      depInicio: 2_400_000,
      ajusteDep: 720_000,
      depEjercicio: 780_000,
      depBajas: 0,
    },
    {
      categoria: 'Muebles y útiles',
      costoInicio: 1_500_000,
      ajusteCosto: 450_000,
      altas: 0,
      bajas: 0,
      depInicio: 600_000,
      ajusteDep: 180_000,
      depEjercicio: 390_000,
      depBajas: 0,
    },
  ],
  costoVentas: {
    existenciaInicial: 4_800_000,
    compras: 22_700_000,
    gastosFabricacion: 0,
    existenciaFinal: 5_500_000,
  },
  pn: [
    {
      tipo: 'AJUSTE_INFLACION',
      ajusteCapital: 600_000,
      reservaLegal: 60_000,
      rdosNoAsignados: 1_732_500,
    },
    { tipo: 'DISTRIB_DIVIDENDOS', rdosNoAsignados: -2_000_000 },
    { tipo: 'DISTRIB_RESERVA_LEGAL', reservaLegal: 100_000, rdosNoAsignados: -100_000 },
  ],
  flujo: [
    { seccion: 'ACTIVIDADES_OPERATIVAS', concepto: 'Cobros a clientes', importe: 37_500_000 },
    {
      seccion: 'ACTIVIDADES_OPERATIVAS',
      concepto: 'Pagos a proveedores y empleados',
      importe: -31_457_249.25,
    },
    {
      seccion: 'ACTIVIDADES_INVERSION',
      concepto: 'Constitución de plazo fijo',
      importe: -1_000_000,
    },
    { seccion: 'ACTIVIDADES_INVERSION', concepto: 'Compra de software', importe: -600_000 },
    {
      seccion: 'ACTIVIDADES_FINANCIAMIENTO',
      concepto: 'Cancelación de préstamo',
      importe: -2_340_000,
    },
    { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Dividendos pagados', importe: -2_000_000 },
  ],
  esperado: {
    activo: 17_807_500,
    pasivo: 7_390_000,
    patrimonioNeto: 10_417_500,
    ingresos: 38_000_000,
    costoVentas: 22_000_000,
    gastos: { [ADM]: 8_300_000, [COM]: 3_300_000, [BAN]: 170_000, [IIC]: 1_100_000 },
    resultadosFinancieros: 120_000,
    impuesto: 1_200_000,
    resultado: 2_050_000,
    rubros: {
      'ACT-CTE-01': 1_367_500,
      'ACT-CTE-02': 1_000_000,
      'ACT-CTE-03': 4_000_000,
      'ACT-CTE-05': 660_000,
      'ACT-CTE-09': 5_500_000,
      'ACT-NCTE-09': 4_680_000,
      'ACT-NCTE-12': 600_000,
      'PAS-CTE-01': 3_900_000,
      'PAS-CTE-03': 1_840_000,
      'PAS-CTE-04': 1_400_000,
      'PAS-CTE-09': 250_000,
    },
    efectivoCierre: 1_367_500,
    bienesDeUsoNeto: 4_680_000,
    amortizacionEjercicio: 1_170_000,
    costoVentasAnexo: {
      existenciaInicial: 4_800_000,
      compras: 22_700_000,
      existenciaFinal: 5_500_000,
      costo: 22_000_000,
    },
    documentosSugeridos: [
      'ANEXO_BIENES_USO',
      'ANEXO_COSTO_VENTAS',
      'ANEXO_GASTOS',
      'NOTA_BIENES_CAMBIO',
      'NOTA_DEUDAS_FISCALES',
      'NOTA_DEUDAS_LABORALES',
      'NOTA_INTANGIBLES',
      'NOTA_INVERSIONES',
      'NOTA_PREVISIONES',
    ],
    gastosSoloAnterior: [{ nombre: 'Comisiones a vendedores', valor: 1_170_000 }],
    // El 2025 reexpresado con el coeficiente 1,30.
    anterior: {
      activo: 19_955_000,
      pasivo: 9_587_500,
      patrimonioNeto: 10_367_500,
      resultado: 2_307_500,
      rubros: {
        'ACT-CTE-01': 1_644_174.025,
        'ACT-CTE-03': 5_590_000,
        'ACT-CTE-05': 630_825.975,
        'ACT-CTE-09': 6_240_000,
        'ACT-NCTE-09': 5_850_000,
        'PAS-CTE-01': 4_030_000,
        'PAS-CTE-02': 2_340_000, // préstamo cancelado: rubro solo del anterior
        'PAS-CTE-03': 1_904_500,
        'PAS-CTE-04': 1_313_000,
      },
      gastos: { [ADM]: 8_190_000, [COM]: 4_615_000, [BAN]: 188_500, [IIC]: 1_170_000 },
      bienesDeUsoNeto: 5_850_000,
    },
  },
}

export const ESCENARIOS = [ESCENARIO_A, ESCENARIO_B, ESCENARIO_C]
