'use client'

import React, { useState, useTransition, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { confirmarImportacionManual } from '../actions/importacion.actions'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilaManual = {
  _key: string
  codigo: string
  nombre: string
  saldoDeudor: string
  saldoAcreedor: string
}

// ─── Row (memoized) ───────────────────────────────────────────────────────────

const RowManual = React.memo(function RowManual({
  fila,
  onUpdate,
  onDelete,
}: {
  fila: FilaManual
  onUpdate: (key: string, field: keyof Omit<FilaManual, '_key'>, value: string) => void
  onDelete: (key: string) => void
}) {
  const debe = parseFloat(fila.saldoDeudor) || 0
  const haber = parseFloat(fila.saldoAcreedor) || 0
  const saldo = debe - haber

  const cellCls =
    'w-full border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 focus:outline-none bg-transparent focus:bg-white transition-colors'

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/40">
      <td className="px-2 py-1 w-28">
        <input
          type="text"
          value={fila.codigo}
          placeholder="1.1.01"
          onChange={(e) => onUpdate(fila._key, 'codigo', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-slate-600')}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={fila.nombre}
          placeholder="Nombre de la cuenta"
          onChange={(e) => onUpdate(fila._key, 'nombre', e.target.value)}
          className={cn(cellCls, 'text-xs text-slate-800')}
        />
      </td>
      <td className="px-2 py-1 w-36">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fila.saldoDeudor}
          onChange={(e) => onUpdate(fila._key, 'saldoDeudor', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-right text-slate-600')}
        />
      </td>
      <td className="px-2 py-1 w-36">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fila.saldoAcreedor}
          onChange={(e) => onUpdate(fila._key, 'saldoAcreedor', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-right text-slate-600')}
        />
      </td>
      <td
        className={cn(
          'px-3 py-1 w-32 text-right font-mono text-xs font-medium',
          saldo < 0 ? 'text-red-600' : 'text-slate-700',
        )}
      >
        {formatCurrency(saldo)}
      </td>
      <td className="px-2 py-1 w-10 text-center">
        <button
          type="button"
          onClick={() => onDelete(fila._key)}
          className="text-slate-300 hover:text-red-500 transition-colors"
          title="Eliminar fila"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

let keyCounter = 0
function newKey() { return `m-${++keyCounter}` }
function emptyFila(): FilaManual {
  return { _key: newKey(), codigo: '', nombre: '', saldoDeudor: '0', saldoAcreedor: '0' }
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
  const [filas, setFilas] = useState<FilaManual[]>(() => [emptyFila()])

  const totalDeudor = useMemo(
    () => filas.reduce((acc, r) => acc + (parseFloat(r.saldoDeudor) || 0), 0),
    [filas],
  )
  const totalAcreedor = useMemo(
    () => filas.reduce((acc, r) => acc + (parseFloat(r.saldoAcreedor) || 0), 0),
    [filas],
  )
  const cuadrado = Math.abs(totalDeudor - totalAcreedor) < 0.01

  const handleUpdate = useCallback(
    (key: string, field: keyof Omit<FilaManual, '_key'>, value: string) => {
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
          <p className="text-sm text-slate-500 mt-0.5">
            {denominacion} — Ingresá cada cuenta con código, nombre, debe y haber.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cuadre */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border',
              cuadrado
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700',
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
                : `Descuadre ${formatCurrency(Math.abs(totalDeudor - totalAcreedor))}`}
            </span>
          </div>
        </div>
      </div>

      {/* Advertencia reimportación */}
      {tieneCuentas && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Este ejercicio ya tiene cuentas cargadas. Al confirmar se reemplazarán todas y se
            perderá la clasificación existente.
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white mb-4">
        <div className="overflow-y-auto" style={{ maxHeight: '62vh' }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-slate-800">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 w-28">
                  Código
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300">
                  Nombre
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-36">
                  Debe
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-36">
                  Haber
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-32">
                  Saldo
                </th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <RowManual
                  key={fila._key}
                  fila={fila}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
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
                  {cuadrado ? '✓' : `Δ ${formatCurrency(Math.abs(totalDeudor - totalAcreedor))}`}
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
            onClick={() => router.push(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <button
            type="button"
            onClick={handleAgregar}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
