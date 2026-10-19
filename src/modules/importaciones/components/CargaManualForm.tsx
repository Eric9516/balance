'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { confirmarImportacionManual } from '../actions/importacion.actions'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { importesDeFila, validarCuadre } from '../domain/importacion'
import type { EditableRow } from '../lib/excelParsing'
import { RowEditable } from './RowEditable'
import { restar } from '@/lib/importe'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let keyCounter = 0
function emptyFila(): EditableRow {
  return { _key: `m-${++keyCounter}`, codigo: '', nombre: '', saldoDeudor: '', saldoAcreedor: '' }
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  ejercicioId: string
  sociedadId: string
  denominacion: string
  tieneCuentas: boolean
}

export function CargaManualForm({ ejercicioId, sociedadId, denominacion, tieneCuentas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filas, setFilas] = useState<EditableRow[]>(() => [emptyFila()])

  // Mismo cálculo de cuadre que valida el servidor (Decimal, tolerancia de centavos).
  const { totalDeudor, totalAcreedor, cuadrado } = useMemo(
    () => validarCuadre(filas.map(importesDeFila)),
    [filas],
  )

  const handleUpdate = useCallback(
    (key: string, field: keyof Omit<EditableRow, '_key'>, value: string) => {
      setFilas((rows) => rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
    },
    [],
  )

  const handleDelete = useCallback((key: string) => {
    setFilas((rows) => rows.filter((r) => r._key !== key))
  }, [])

  function handleAgregar() {
    setFilas((rows) => [...rows, emptyFila()])
  }

  function handleConfirmar() {
    if (filas.length === 0) return
    startTransition(async () => {
      const result = await confirmarImportacionManual(
        ejercicioId,
        sociedadId,
        filas.map(({ codigo, nombre, saldoDeudor, saldoAcreedor }) => ({
          codigo,
          nombre,
          saldoDeudor,
          saldoAcreedor,
        })),
      )

      if (!result.ok) {
        toastError(result.error)
        return
      }

      const { importadas, errores } = result.data
      toastSuccess(
        errores > 0
          ? `${importadas} cuentas cargadas (${errores} filas inválidas omitidas)`
          : `${importadas} cuentas cargadas correctamente`,
      )
      router.push(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    })
  }

  return (
    <div className="w-full max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Carga manual de cuentas</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {denominacion} — Ingresá cada cuenta con código, nombre, debe y haber.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cuadre */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs',
              cuadrado
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            {cuadrado ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>
              {cuadrado
                ? `Cuadre OK — ${formatCurrency(totalDeudor)}`
                : `Descuadre ${formatCurrency(Math.abs(restar(totalDeudor, totalAcreedor)))}`}
            </span>
          </div>
        </div>
      </div>

      {/* Advertencia reimportación */}
      {tieneCuentas && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            Este ejercicio ya tiene cuentas cargadas. Al confirmar se reemplazarán todas y se
            perderá la clasificación existente.
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-y-auto" style={{ maxHeight: '62vh' }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-800">
                <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold text-slate-300">
                  Código
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300">
                  Nombre
                </th>
                <th className="w-36 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Debe
                </th>
                <th className="w-36 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Haber
                </th>
                <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Saldo
                </th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <RowEditable
                  key={fila._key}
                  fila={fila}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  placeholders
                />
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500">
                  {filas.length} {filas.length === 1 ? 'cuenta' : 'cuentas'}
                </td>
                <td />
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700">
                  {formatCurrency(totalDeudor)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700">
                  {formatCurrency(totalAcreedor)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right font-mono text-xs font-semibold',
                    cuadrado ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {cuadrado
                    ? '✓'
                    : `Δ ${formatCurrency(Math.abs(restar(totalDeudor, totalAcreedor)))}`}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              router.push(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
            }
            disabled={isPending}
          >
            Cancelar
          </Button>
          <button
            type="button"
            onClick={handleAgregar}
            className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar fila
          </button>
        </div>
        <Button
          type="button"
          disabled={filas.length === 0 || !cuadrado || isPending}
          onClick={handleConfirmar}
        >
          {isPending
            ? 'Guardando...'
            : `Confirmar carga (${filas.length} ${filas.length === 1 ? 'cuenta' : 'cuentas'})`}
        </Button>
      </div>
    </div>
  )
}
