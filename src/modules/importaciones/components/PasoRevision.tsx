import { AlertCircle, CheckCircle2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { EditableRow } from '../lib/excelParsing'
import { RowEditable } from './RowEditable'

export function PasoRevision({
  denominacion,
  filasEditadas,
  filasDescartadas,
  seleccionDescartadas,
  mostrarDescartadas,
  totalDeudor,
  totalAcreedor,
  cuadrado,
  isPending,
  onUpdate,
  onDelete,
  onIncluirDescartadas,
  onToggleSeleccionDescartada,
  onToggleTodasDescartadas,
  onToggleMostrarDescartadas,
  onAgregarFila,
  onVolverMapeo,
  onConfirmar,
}: {
  denominacion: string
  filasEditadas: EditableRow[]
  filasDescartadas: EditableRow[]
  seleccionDescartadas: Set<string>
  mostrarDescartadas: boolean
  totalDeudor: number
  totalAcreedor: number
  cuadrado: boolean
  isPending: boolean
  onUpdate: (key: string, field: keyof Omit<EditableRow, '_key'>, value: string) => void
  onDelete: (key: string) => void
  onIncluirDescartadas: () => void
  onToggleSeleccionDescartada: (key: string) => void
  onToggleTodasDescartadas: () => void
  onToggleMostrarDescartadas: () => void
  onAgregarFila: () => void
  onVolverMapeo: () => void
  onConfirmar: () => void
}) {
  return (
    <div className="w-full max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Revisar y editar datos
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {denominacion} — {filasEditadas.length} filas encontradas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cuadre indicator */}
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
                ? `Cuadre OK — ${formatCurrency(totalDeudor, { decimales: 2 })}`
                : `Descuadre ${formatCurrency(Math.abs(totalDeudor - totalAcreedor), { decimales: 2 })}`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabla editable */}
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
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-32">
                  Debe
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-32">
                  Haber
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-300 w-32">
                  Saldo
                </th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {filasEditadas.map((fila) => (
                <RowEditable
                  key={fila._key}
                  fila={fila}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500">
                  {filasEditadas.length} filas
                </td>
                <td />
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700">
                  {formatCurrency(totalDeudor, { decimales: 2 })}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-700">
                  {formatCurrency(totalAcreedor, { decimales: 2 })}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right font-mono text-xs font-semibold',
                    cuadrado ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {cuadrado ? '✓' : `Δ ${formatCurrency(Math.abs(totalDeudor - totalAcreedor), { decimales: 2 })}`}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Filas descartadas (saldo = 0) */}
      {filasDescartadas.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={onToggleMostrarDescartadas}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {filasDescartadas.length} {filasDescartadas.length === 1 ? 'fila descartada' : 'filas descartadas'} (saldo = 0)
            </span>
            <span className="text-xs text-slate-400">{mostrarDescartadas ? '▲ Ocultar' : '▼ Ver'}</span>
          </button>

          {mostrarDescartadas && (
            <div>
              <div className="overflow-y-auto border-t border-slate-100" style={{ maxHeight: '30vh' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={seleccionDescartadas.size === filasDescartadas.length && filasDescartadas.length > 0}
                          onChange={onToggleTodasDescartadas}
                          className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold w-28">Código</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Nombre</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold w-32">Debe</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold w-32">Haber</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold w-32">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasDescartadas.map(f => {
                      const saldo = (parseFloat(f.saldoDeudor) || 0) - (parseFloat(f.saldoAcreedor) || 0)
                      return (
                      <tr
                        key={f._key}
                        className={cn(
                          'border-b border-slate-100 last:border-0 cursor-pointer',
                          seleccionDescartadas.has(f._key) ? 'bg-blue-50' : 'hover:bg-slate-50'
                        )}
                        onClick={() => onToggleSeleccionDescartada(f._key)}
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={seleccionDescartadas.has(f._key)}
                            onChange={() => onToggleSeleccionDescartada(f._key)}
                            className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-400">{f.codigo}</td>
                        <td className="px-3 py-1.5 text-slate-600">{f.nombre}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                          {parseFloat(f.saldoDeudor) > 0 ? formatCurrency(parseFloat(f.saldoDeudor), { decimales: 2 }) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                          {parseFloat(f.saldoAcreedor) > 0 ? formatCurrency(parseFloat(f.saldoAcreedor), { decimales: 2 }) : '—'}
                        </td>
                        <td className={cn('px-3 py-1.5 text-right font-mono font-medium', saldo < 0 ? 'text-red-500' : 'text-slate-500')}>
                          {formatCurrency(saldo, { decimales: 2 })}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {seleccionDescartadas.size > 0 && (
                <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between bg-slate-50">
                  <span className="text-xs text-slate-500">
                    {seleccionDescartadas.size} {seleccionDescartadas.size === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
                  </span>
                  <button
                    type="button"
                    onClick={onIncluirDescartadas}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    + Incluir en la importación
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onVolverMapeo}
            disabled={isPending}
          >
            ← Volver al mapeo
          </Button>
          <button
            type="button"
            onClick={onAgregarFila}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar fila
          </button>
        </div>
        <Button
          type="button"
          disabled={filasEditadas.length === 0 || !cuadrado || isPending}
          onClick={onConfirmar}
        >
          {isPending
            ? 'Importando...'
            : `Confirmar importación (${filasEditadas.length} filas)`}
        </Button>
      </div>
    </div>
  )
}
