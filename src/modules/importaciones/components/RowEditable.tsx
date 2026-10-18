import React from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { importesDeFila } from '../domain/importacion'
import type { EditableRow } from '../lib/excelParsing'

const CELL =
  'w-full border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 focus:outline-none bg-transparent focus:bg-white transition-colors'

/**
 * Fila editable del balance de sumas y saldos (código, nombre, debe, haber, saldo).
 * Única para la carga manual y la revisión del Excel. Importes en formato AR ("1.234,56").
 */
export const RowEditable = React.memo(function RowEditable({
  fila,
  onUpdate,
  onDelete,
  placeholders = false,
}: {
  fila: EditableRow
  onUpdate: (key: string, field: keyof Omit<EditableRow, '_key'>, value: string) => void
  onDelete: (key: string) => void
  /** Muestra ejemplos en celdas vacías (carga manual desde cero). */
  placeholders?: boolean
}) {
  const { saldoFinal } = importesDeFila(fila)

  return (
    <tr className="border-b border-slate-100 hover:bg-acento-suave">
      <td className="w-28 px-2 py-1">
        <input
          type="text"
          value={fila.codigo}
          placeholder={placeholders ? '1.1.01' : undefined}
          aria-label="Código de cuenta"
          onChange={(e) => onUpdate(fila._key, 'codigo', e.target.value)}
          className={cn(CELL, 'font-mono text-xs text-slate-600')}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={fila.nombre}
          placeholder={placeholders ? 'Nombre de la cuenta' : undefined}
          aria-label="Nombre de la cuenta"
          onChange={(e) => onUpdate(fila._key, 'nombre', e.target.value)}
          className={cn(CELL, 'text-xs text-slate-800')}
        />
      </td>
      <td className="w-36 px-2 py-1">
        <input
          type="text"
          inputMode="decimal"
          value={fila.saldoDeudor}
          placeholder="0"
          aria-label="Debe"
          onChange={(e) => onUpdate(fila._key, 'saldoDeudor', e.target.value)}
          className={cn(CELL, 'text-right font-mono text-xs text-slate-600 tabular-nums')}
        />
      </td>
      <td className="w-36 px-2 py-1">
        <input
          type="text"
          inputMode="decimal"
          value={fila.saldoAcreedor}
          placeholder="0"
          aria-label="Haber"
          onChange={(e) => onUpdate(fila._key, 'saldoAcreedor', e.target.value)}
          className={cn(CELL, 'text-right font-mono text-xs text-slate-600 tabular-nums')}
        />
      </td>
      <td
        className={cn(
          'w-32 px-3 py-1 text-right font-mono text-xs font-medium tabular-nums',
          saldoFinal < 0 ? 'text-red-600' : 'text-slate-700',
        )}
      >
        {formatCurrency(saldoFinal, { decimales: 2 })}
      </td>
      <td className="w-10 px-2 py-1 text-center">
        <button
          type="button"
          onClick={() => onDelete(fila._key)}
          className="text-slate-300 transition-colors hover:text-red-500"
          title="Eliminar fila"
          aria-label={`Eliminar fila ${fila.codigo || ''}`.trim()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
})
