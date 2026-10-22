/**
 * Política del comparativo ("Ejercicio anterior") según el modo del ejercicio.
 *
 * Única puerta por la que entran valores del ejercicio anterior a estados, gastos y
 * costo de ventas:
 *  - VINCULADO    → se usan SOLO los valores derivados del ejercicio anterior. Las filas
 *                   de comparativo_manual (residuos de un modo previo) se IGNORAN.
 *  - MANUAL       → se aplican SOLO las filas manuales. Lo derivado no existe (invariante:
 *                   sin vínculo) y, si existiera, `seleccionarDerivado` lo descarta. El
 *                   anterior de un rubro del SSP que lleva nota con detalle sale de la nota.
 *  - SIN_ANTERIOR / PENDIENTE → no hay columna comparativa.
 *
 * Puro: no toca la base.
 */

import { anteriorPorSeccionDesdeFilas, filasAnexoGastos } from '@/modules/gastos/domain/filasAnexo'
import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EstadosData } from '@/modules/estados/domain/types'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { NotaDTO } from '@/modules/notas/domain/types'
import type { ComparativoManualDTO } from '../domain/types'
import {
  aplicarAnteriorDesdeNotas,
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
  /**
   * Rubros cuyo anterior se carga en su nota con detalle, con esa nota (null si las notas todavía
   * no se generaron). Solo se usa en MANUAL (ver aplicarAnteriorDesdeNotas).
   */
  anteriorEnNotas: Map<string, NotaDTO | null> = new Map(),
): EstadosData {
  switch (fuenteComparativo(modo)) {
    case 'DERIVADO':
      return { ...raw, hayEjercicioAnterior: true }
    case 'MANUAL':
      return {
        // Los gastos del anterior NO se aplican acá: llegan ya resueltos en el Anexo III
        // (resolverGastos, totales por sección calculados desde las filas) a través de
        // buildEstadosData. Aplicarlos de nuevo los pisaría con importes cargados a mano.
        // El anterior de los rubros del SSP que llevan nota con detalle sale de la nota.
        ...aplicarAnteriorDesdeNotas(
          applyComparativosToEstados(
            raw,
            seleccionarManual(modo, comparativos).filter(
              (c) => c.modulo !== 'GASTOS' && c.modulo !== 'GASTOS_FILA',
            ),
            'RUBRO',
          ),
          anteriorEnNotas,
          new Set(
            comparativos.filter((c) => c.modulo === 'SSP' && c.valor !== 0).map((c) => c.clave),
          ),
        ),
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
  // El ejercicio anterior se carga una sola vez, fila por fila ('GASTOS_FILA').
  const anteriorManualPorFila = manual
    .filter((c) => c.modulo === 'GASTOS_FILA')
    .map((c) => ({ clave: c.clave, nombre: c.label, valor: c.valor, soloAnterior: c.esHuerfano }))
  // Columnas que solo existieron en el anterior ('GASTOS' huérfanas). Sus importes cargados a
  // mano ya no cuentan: todo total por sección se calcula desde las filas.
  const conHuerfanas = applyComparativosToGastos(raw, manual)
  const porSeccion = anteriorPorSeccionDesdeFilas(
    filasAnexoGastos(conHuerfanas.secciones, anteriorManualPorFila),
  )
  return {
    ...conHuerfanas,
    secciones: conHuerfanas.secciones.map((s) => ({
      ...s,
      totalAnterior: porSeccion.get(s.key) ?? 0,
    })),
    anteriorManualPorFila,
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
