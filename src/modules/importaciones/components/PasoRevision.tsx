import { AlertCircle, CheckCircle2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { EditableRow } from '../lib/excelParsing'
import { importesDeFila } from '../domain/importacion'
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
          <h2 className="text-base font-semibold text-slate-900">Revisar y editar datos</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {denominacion} — {filasEditadas.length} filas encontradas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cuadre indicator */}
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
                ? `Cuadre OK — ${formatCurrency(totalDeudor, { decimales: 2 })}`
                : `Descuadre ${formatCurrency(Math.abs(totalDeudor - totalAcreedor), { decimales: 2 })}`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabla editable */}
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
                <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Debe
                </th>
                <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Haber
                </th>
                <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-slate-300">
                  Saldo
                </th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filasEditadas.map((fila) => (
                <RowEditable key={fila._key} fila={fila} onUpdate={onUpdate} onDelete={onDelete} />
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
                  {cuadrado
                    ? '✓'
                    : `Δ ${formatCurrency(Math.abs(totalDeudor - totalAcreedor), { decimales: 2 })}`}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Filas descartadas (saldo = 0) */}
      {filasDescartadas.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={onToggleMostrarDescartadas}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {filasDescartadas.length}{' '}
              {filasDescartadas.length === 1 ? 'fila descartada' : 'filas descartadas'} (saldo = 0)
            </span>
            <span className="text-xs text-slate-400">
              {mostrarDescartadas ? '▲ Ocultar' : '▼ Ver'}
            </span>
          </button>

          {mostrarDescartadas && (
            <div>
              <div
                className="overflow-y-auto border-t border-slate-100"
                style={{ maxHeight: '30vh' }}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={
                            seleccionDescartadas.size === filasDescartadas.length &&
                            filasDescartadas.length > 0
                          }
                          onChange={onToggleTodasDescartadas}
                          className="cursor-pointer rounded border-slate-300 accent-blue-600"
                        />
                      </th>
                      <th className="w-28 px-3 py-2 text-left font-semibold text-slate-500">
                        Código
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Nombre</th>
                      <th className="w-32 px-3 py-2 text-right font-semibold text-slate-500">
                        Debe
                      </th>
                      <th className="w-32 px-3 py-2 text-right font-semibold text-slate-500">
                        Haber
                      </th>
                      <th className="w-32 px-3 py-2 text-right font-semibold text-slate-500">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasDescartadas.map((f) => {
                      const { saldoDeudor, saldoAcreedor, saldoFinal: saldo } = importesDeFila(f)
                      return (
                        <tr
                          key={f._key}
                          className={cn(
                            'cursor-pointer border-b border-slate-100 last:border-0',
                            seleccionDescartadas.has(f._key) ? 'bg-blue-50' : 'hover:bg-slate-50',
                          )}
                          onClick={() => onToggleSeleccionDescartada(f._key)}
                        >
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={seleccionDescartadas.has(f._key)}
                              onChange={() => onToggleSeleccionDescartada(f._key)}
                              className="cursor-pointer rounded border-slate-300 accent-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-mono text-slate-400">{f.codigo}</td>
                          <td className="px-3 py-1.5 text-slate-600">{f.nombre}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                            {saldoDeudor > 0 ? formatCurrency(saldoDeudor, { decimales: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                            {saldoAcreedor > 0
                              ? formatCurrency(saldoAcreedor, { decimales: 2 })
                              : '—'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-1.5 text-right font-mono font-medium',
                              saldo < 0 ? 'text-red-500' : 'text-slate-500',
                            )}
                          >
                            {formatCurrency(saldo, { decimales: 2 })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {seleccionDescartadas.size > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="text-xs text-slate-500">
                    {seleccionDescartadas.size}{' '}
                    {seleccionDescartadas.size === 1 ? 'fila seleccionada' : 'filas seleccionadas'}
                  </span>
                  <button
                    type="button"
                    onClick={onIncluirDescartadas}
                    className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
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
          <Button type="button" variant="secondary" onClick={onVolverMapeo} disabled={isPending}>
            ← Volver al mapeo
          </Button>
          <button
            type="button"
            onClick={onAgregarFila}
            className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
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
          {isPending ? 'Importando...' : `Confirmar importación (${filasEditadas.length} filas)`}
        </Button>
      </div>
    </div>
  )
}
