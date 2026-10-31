import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type Decimal from 'decimal.js'
import { cocienteExacto, dividir, multiplicar, sumarPor } from '@/lib/importe'

type IndicesDelEjercicio = {
  indiceInflacionAnterior: number | null
  indiceInflacionActual: number | null
}

/** Coeficiente para MOSTRAR. Para calcular se usa `reexpresar`, con los dos índices. */
export function getCoeficienteComparativo(ejercicio: IndicesDelEjercicio): number {
  const { actual, anterior } = getIndicesReexpresion(ejercicio)
  return dividir(actual, anterior)
}

/** Los dos índices con los que se lleva un importe del anterior a moneda de cierre. */
export type IndicesReexpresion = { actual: number; anterior: number }

export const SIN_REEXPRESION: IndicesReexpresion = { actual: 1, anterior: 1 }

export function getIndicesReexpresion(ejercicio: IndicesDelEjercicio): IndicesReexpresion {
  const anterior = ejercicio.indiceInflacionAnterior
  const actual = ejercicio.indiceInflacionActual
  if (!anterior || !actual) return SIN_REEXPRESION
  return { actual, anterior }
}

const sinCambio = (indices: IndicesReexpresion) => indices.actual === indices.anterior

// El cociente se calcula una vez por juego de índices: un balance reexpresa miles de importes.
const factores = new WeakMap<IndicesReexpresion, Decimal>()

function factorDe(indices: IndicesReexpresion): Decimal {
  let factor = factores.get(indices)
  if (!factor) {
    factor = cocienteExacto(indices.actual, indices.anterior)
    factores.set(indices, factor)
  }
  return factor
}

/**
 * importe × índice actual ÷ índice anterior, con el cociente de 34 dígitos: nunca pasa por el
 * coeficiente en `number`, que deja un centavo de menos en resultados que caen justo en centavos.
 */
export function reexpresar(valor: number, indices: IndicesReexpresion): number {
  if (valor === 0 || sinCambio(indices)) return valor
  return multiplicar(valor, factorDe(indices))
}

export function ajustarCuentas(
  cuentas: CuentaContableDTO[],
  indices: IndicesReexpresion,
): CuentaContableDTO[] {
  if (sinCambio(indices)) return cuentas
  return cuentas.map((c) => ({
    ...c,
    saldoDeudor: reexpresar(c.saldoDeudor, indices),
    saldoAcreedor: reexpresar(c.saldoAcreedor, indices),
    saldoFinal: reexpresar(c.saldoFinal, indices),
  }))
}

export function ajustarCostoVentas(
  dto: CostoVentasDTO | null,
  indices: IndicesReexpresion,
): CostoVentasDTO | null {
  if (!dto || sinCambio(indices)) return dto
  return {
    ...dto,
    existenciaInicial: reexpresar(dto.existenciaInicial, indices),
    compras: reexpresar(dto.compras, indices),
    gastosFabricacion: reexpresar(dto.gastosFabricacion, indices),
    existenciaFinal: reexpresar(dto.existenciaFinal, indices),
  }
}

/** Columna "Ejercicio anterior" del Anexo III (y de los gastos del EERR) en moneda de cierre. */
export function ajustarGastos(
  gastos: GastosSecciones,
  indices: IndicesReexpresion,
): GastosSecciones {
  if (sinCambio(indices)) return gastos
  return {
    ...gastos,
    secciones: gastos.secciones.map((s) => {
      const filas = s.filas.map((f) => ({
        ...f,
        importeAnterior: reexpresar(f.importeAnterior, indices),
      }))
      return { ...s, filas, totalAnterior: sumarPor(filas, (f) => f.importeAnterior) }
    }),
  }
}
