/**
 * Textos fijos del juego de estados contables impreso. Único lugar para revisarlos
 * o cambiarlos: encabezados, subtítulos, firmas, marca de agua y pendientes.
 * Las etiquetas de cada estado viven en el dominio de su módulo.
 */

import { formatFecha } from '@/lib/utils/dates'

const comparativo = (fechaCierreAnterior: Date | null) =>
  fechaCierreAnterior
    ? `, comparativo con el ejercicio anterior finalizado el ${formatFecha(fechaCierreAnterior)}`
    : ''

export const TEXTOS_DOCUMENTO = {
  encabezado: {
    estados: (fechaCierre: Date) => `Estados contables al ${formatFecha(fechaCierre)}`,
    ejercicio: (numero: number) => `Ejercicio económico N° ${numero}`,
    leyendaMoneda: 'Cifras expresadas en pesos, en moneda homogénea',
    separador: ' · ',
  },
  titulos: {
    ssp: 'Estado de Situación Patrimonial',
    eerr: 'Estado de Resultados',
    eepn: 'Estado de Evolución del Patrimonio Neto',
    flujo: 'Estado de Flujo de Efectivo',
    notas: 'Notas a los estados contables',
    informe: 'Informe del Auditor Independiente',
    memoria: 'Memoria',
  },
  subtitulos: {
    /** Estados "al cierre": SSP y Anexo I. */
    al: (fechaCierre: Date, fechaCierreAnterior: Date | null) =>
      `Al ${formatFecha(fechaCierre)}${comparativo(fechaCierreAnterior)}`,
    /** Estados "por el ejercicio": EERR, E.E.P.N., flujo, Anexos II y III, notas. */
    porElEjercicio: (fechaInicio: Date, fechaCierre: Date, fechaCierreAnterior: Date | null) =>
      `Por el ejercicio iniciado el ${formatFecha(fechaInicio)} y finalizado el ${formatFecha(fechaCierre)}${comparativo(fechaCierreAnterior)}`,
    flujoMetodo: ' (método directo)',
    sinComparativo:
      'Primer ejercicio de la sociedad: los estados se presentan sin información comparativa.',
  },
  columnas: {
    concepto: 'Concepto',
    actual: 'Ejercicio actual',
    anterior: 'Ejercicio anterior',
  },
  firmas: {
    representante: 'Representante legal',
    auditor: (fechaInforme: string) =>
      `Firmado a los efectos de su identificación con mi informe de fecha ${fechaInforme}`,
    sinFecha: '....../....../......',
  },
  borrador: {
    marca: 'BORRADOR',
    titulo: 'Documento en borrador',
    detalle:
      'La compuerta de autorización tiene condiciones pendientes. El documento sale con marca de agua hasta resolverlas:',
  },
  pendientes: {
    notaUno: 'Nota 1 — Bases de preparación de los estados contables',
    notaUnoDetalle: 'Pendiente: el texto de la Nota 1 se genera y edita en un paso posterior.',
    transicion: 'Nota de primera aplicación de la Resolución Técnica N° 54',
    informeDetalle: 'Pendiente: el informe del auditor se redacta en un paso posterior.',
    memoriaDetalle: 'Pendiente: la Memoria se redacta en un paso posterior.',
    anexoSinVista: (titulo: string) =>
      `${titulo}: aceptado en "Anexos y notas" pero todavía no tiene pantalla de carga, por eso no se imprime.`,
    anexoSinDatos: (titulo: string) =>
      `${titulo}: aceptado en "Anexos y notas" pero sin datos cargados, por eso no se imprime.`,
    sinAuditor: 'El ejercicio no tiene auditor asignado: el pie de firmas queda sin sus datos.',
    sinFechaInforme:
      'Falta la fecha del informe del auditor: la leyenda de las firmas queda con la fecha en blanco.',
    caratula: (campos: string[]) => `Carátula: faltan ${campos.join(', ')}.`,
  },
  ssp: {
    patrimonioNeto: 'Patrimonio Neto',
    verEEPN: '(según E.E.P.N.)',
    totalPasivoPN: 'TOTAL PASIVO + PATRIMONIO NETO',
    delPeriodoAnterior: 'Del período anterior',
    subtotal: (seccion: string) => `Subtotal ${seccion}`,
  },
  eepn: {
    rubros: 'Rubros',
    patrimonioNeto: 'Patrimonio neto',
    inicioModificado: 'Saldos al inicio modificados',
    distribucion: 'Distribución de resultados',
    cierre: 'Saldos al cierre del ejercicio',
  },
  anexos: {
    rubros: 'Rubros',
    totales: 'Totales',
    netoResidual: 'Neto residual',
    totalActual: 'Total ejercicio actual',
    totalAnterior: 'Total ejercicio anterior',
    soloAnterior: 'Del período anterior',
  },
  notas: {
    numero: (numero: number | null) => `Nota N° ${numero ?? '?'}`,
    criterio: 'Criterio de medición:',
    total: 'TOTAL',
    conciliacionPN: 'Conciliación del patrimonio neto al inicio',
    conciliacionResultado: 'Conciliación del resultado del ejercicio anterior',
    reclasificaciones: 'Reclasificaciones de exposición',
  },
} as const
