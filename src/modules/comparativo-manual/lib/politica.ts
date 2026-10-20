/**
 * Política del comparativo ("Ejercicio anterior") según el modo del ejercicio.
 *
 * Única puerta por la que entran valores del ejercicio anterior a estados, gastos y
 * costo de ventas:
 *  - VINCULADO    → se usan SOLO los valores derivados del ejercicio anterior. Las filas
 *                   de comparativo_manual (residuos de un modo previo) se IGNORAN.
 *  - MANUAL       → se aplican SOLO las filas manuales. Lo derivado no existe (invariante:
 *                   sin vínculo) y, si existiera, `seleccionarDerivado` lo descarta.
 *  - SIN_ANTERIOR / PENDIENTE → no hay columna comparativa.
 *
 * Puro: no toca la base.
 */

import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EstadosData } from '@/modules/estados/domain/types'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { ComparativoManualDTO } from '../domain/types'
import {
  applyComparativosToEstados,
  applyComparativosToGastos,
  buildCostoVentasAntFromComparativos,
} from './apply'

export type FuenteComparativo = 'DERIVADO' | 'MANUAL' | 'NINGUNO'

export function fuenteComparativo(modo: ModoAnteriorEfectivo): FuenteComparativo {
  if (modo === 'VINCULADO') return 'DERIVADO'
  if (modo === 'MANUAL') return 'MANUAL'
  return 'NINGUNO'
}

/** ¿Se muestra la columna "Ejercicio anterior"? */
export function mostrarColumnaAnterior(modo: ModoAnteriorEfectivo): boolean {
  return fuenteComparativo(modo) !== 'NINGUNO'
}

/** ¿La columna anterior se carga a mano? Solo en MANUAL. */
export function editarAnteriorManual(modo: ModoAnteriorEfectivo): boolean {
  return fuenteComparativo(modo) === 'MANUAL'
}

/** ¿Los valores derivados del anterior son fuente válida? Solo en VINCULADO. */
export function usarDerivadoDelAnterior(modo: ModoAnteriorEfectivo): boolean {
  return fuenteComparativo(modo) === 'DERIVADO'
}

/** Devuelve `derivado` solo en VINCULADO; en cualquier otro modo devuelve `vacio`. */
export function seleccionarDerivado<T>(modo: ModoAnteriorEfectivo, derivado: T, vacio: T): T {
  return usarDerivadoDelAnterior(modo) ? derivado : vacio
}

/** Devuelve las filas manuales solo en MANUAL; en cualquier otro modo, lista vacía. */
export function seleccionarManual(
  modo: ModoAnteriorEfectivo,
  comparativos: ComparativoManualDTO[],
): ComparativoManualDTO[] {
  return editarAnteriorManual(modo) ? comparativos : []
}

// ─── Estados (SSP + EERR) ────────────────────────────────────────────────────

export function resolverEstados(
  raw: EstadosData,
  modo: ModoAnteriorEfectivo,
  comparativos: ComparativoManualDTO[],
): EstadosData {
  switch (fuenteComparativo(modo)) {
    case 'DERIVADO':
      return { ...raw, hayEjercicioAnterior: true }
    case 'MANUAL':
      return {
        ...applyComparativosToEstados(raw, seleccionarManual(modo, comparativos), 'RUBRO'),
        hayEjercicioAnterior: true,
      }
    case 'NINGUNO':
      return { ...raw, hayEjercicioAnterior: false }
  }
}

// ─── Anexo III: gastos ───────────────────────────────────────────────────────

export function resolverGastos(
  raw: GastosSecciones,
  modo: ModoAnteriorEfectivo,
  comparativos: ComparativoManualDTO[],
): GastosSecciones {
  if (fuenteComparativo(modo) !== 'MANUAL') return raw
  const manual = seleccionarManual(modo, comparativos)
  return {
    // Los totales por sección ('GASTOS') van al Estado de Resultados.
    ...applyComparativosToGastos(raw, manual),
    // La columna "Total ejercicio anterior" del anexo, fila por fila ('GASTOS_FILA').
    anteriorManualPorFila: manual
      .filter((c) => c.modulo === 'GASTOS_FILA')
      .map((c) => ({
        clave: c.clave,
        nombre: c.label,
        valor: c.valor,
        soloAnterior: c.esHuerfano,
      })),
  }
}

// ─── Anexo II: costo de ventas (comparativo) ─────────────────────────────────

export function resolverCostoVentasAnterior(
  derivado: CostoVentasDTO | null,
  modo: ModoAnteriorEfectivo,
  comparativos: ComparativoManualDTO[],
  ejercicioId: string,
): CostoVentasDTO | null {
  switch (fuenteComparativo(modo)) {
    case 'DERIVADO':
      return derivado
    case 'MANUAL':
      return buildCostoVentasAntFromComparativos(ejercicioId, seleccionarManual(modo, comparativos))
    case 'NINGUNO':
      return null
  }
}
