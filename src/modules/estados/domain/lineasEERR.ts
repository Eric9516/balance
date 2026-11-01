/**
 * Líneas del Estado de Resultados: etiquetas, signo de presentación y orden.
 * Los importes ya vienen calculados en EERRData (lib/aggregate.ts); acá solo se
 * decide cómo se exponen. Fuente única para la pantalla y el documento. Puro.
 */

import type { EERRData } from './types'

export const ETIQUETAS_EERR = {
  ingresos: 'Ingresos netos por ventas de bienes y servicios',
  costoVentas: 'Costo de los bienes vendidos y servicios',
  costoVentasAnexo: 'Costo de los bienes vendidos y servicios (Anexo II)',
  utilidadBruta: 'UTILIDAD BRUTA DE VENTAS',
  gastoAnexo: (nombre: string) => `${nombre} (Anexo III)`,
  resultadosFinancieros: 'Resultados financieros y por tenencia',
  resultadoAntesIG: 'RESULTADO ANTES DEL IMPUESTO A LAS GANANCIAS',
  impuestoGanancias: 'Impuesto a las ganancias',
  ganancia: 'GANANCIA DEL PERÍODO',
  perdida: 'PÉRDIDA DEL PERÍODO',
} as const

export type LineaEERR = {
  clave: string
  etiqueta: string
  tipo: 'linea' | 'subtotal' | 'final'
  valor: number
  valorAnt: number
  /** Se expone entre paréntesis (resta). */
  deduccion: boolean
  notaNumero: number | null
}

/** Etiqueta de la última línea según el signo del resultado del ejercicio actual. */
export function etiquetaResultado(resultado: number): string {
  return resultado >= 0 ? ETIQUETAS_EERR.ganancia : ETIQUETAS_EERR.perdida
}

/**
 * Líneas en el orden de exposición. La última línea toma la etiqueta del signo del
 * ejercicio actual y expone ambas columnas en ese sentido: con "Pérdida" una ganancia
 * del ejercicio anterior queda entre paréntesis, y viceversa.
 */
export function armarLineasEERR(eerr: EERRData): LineaEERR[] {
  const ganancia = eerr.utilidadEjercicio >= 0
  const sentido = ganancia ? 1 : -1
  const linea = (
    clave: string,
    etiqueta: string,
    valor: number,
    valorAnt: number,
    opts: { deduccion?: boolean; notaNumero?: number | null; tipo?: LineaEERR['tipo'] } = {},
  ): LineaEERR => ({
    clave,
    etiqueta,
    tipo: opts.tipo ?? 'linea',
    valor,
    valorAnt,
    deduccion: opts.deduccion ?? false,
    notaNumero: opts.notaNumero ?? null,
  })

  const lineas: LineaEERR[] = [
    linea('INGRESOS', ETIQUETAS_EERR.ingresos, eerr.ingresos, eerr.ingresosAnt, {
      notaNumero: eerr.notaIngresosNum,
    }),
    linea(
      'COSTO_VENTAS',
      eerr.usaAnexoCosto ? ETIQUETAS_EERR.costoVentasAnexo : ETIQUETAS_EERR.costoVentas,
      eerr.costoVentas,
      eerr.costoVentasAnt,
      { deduccion: true, notaNumero: eerr.notaCostoVentasNum },
    ),
    linea(
      'UTILIDAD_BRUTA',
      ETIQUETAS_EERR.utilidadBruta,
      eerr.utilidadBruta,
      eerr.utilidadBrutaAnt,
      {
        tipo: 'subtotal',
      },
    ),
    ...eerr.seccionesGasto.map((s) =>
      linea(s.key, ETIQUETAS_EERR.gastoAnexo(s.nombre), s.total, s.totalAnt, { deduccion: true }),
    ),
    linea(
      'RESULTADOS_FINANCIEROS',
      ETIQUETAS_EERR.resultadosFinancieros,
      eerr.resultadosFinancieros,
      eerr.resultadosFinancierosAnt,
    ),
    linea(
      'RESULTADO_ANTES_IG',
      ETIQUETAS_EERR.resultadoAntesIG,
      eerr.resultadoAntesIG,
      eerr.resultadoAntesIGAnt,
      { tipo: 'subtotal' },
    ),
    linea(
      'IMPUESTO_GANANCIAS',
      ETIQUETAS_EERR.impuestoGanancias,
      eerr.impuestoGanancias,
      eerr.impuestoGananciasAnt,
      { deduccion: true },
    ),
    linea(
      'RESULTADO_EJERCICIO',
      etiquetaResultado(eerr.utilidadEjercicio),
      eerr.utilidadEjercicio * sentido,
      eerr.utilidadEjercicioAnt * sentido,
      { tipo: 'final' },
    ),
  ]
  return lineas.flatMap((l) => [l, ...filasDeNotas(eerr, l.clave)])
}

/** Las notas ubicadas debajo de una línea. Solo tienen importe en la columna anterior. */
function filasDeNotas(eerr: EERRData, clave: string): LineaEERR[] {
  return (eerr.lineasNota ?? [])
    .filter((n) => n.debajoDe === clave)
    .map((n) => ({
      clave: `nota:${n.notaId}`,
      etiqueta: n.titulo,
      tipo: 'linea',
      valor: 0,
      valorAnt: n.totalAnt,
      deduccion: false,
      notaNumero: n.notaNumero,
    }))
}
