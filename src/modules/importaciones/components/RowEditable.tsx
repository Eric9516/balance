import React from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { EditableRow } from '../lib/excelParsing'

// ─── Row editable (memoized) ──────────────────────────────────────────────────

export const RowEditable = React.memo(function RowEditable({
  fila,
  onUpdate,
  onDelete,
}: {
  fila: EditableRow
  onUpdate: (key: string, field: keyof Omit<EditableRow, '_key'>, value: string) => void
  onDelete: (key: string) => void
}) {
  const saldo = (parseFloat(fila.saldoDeudor) || 0) - (parseFloat(fila.saldoAcreedor) || 0)
  const cellCls =
    'w-full border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 focus:outline-none bg-transparent focus:bg-white transition-colors'

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/40">
      <td className="px-2 py-1 w-28">
        <input
          type="text"
          value={fila.codigo}
          onChange={(e) => onUpdate(fila._key, 'codigo', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-slate-600')}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={fila.nombre}
          onChange={(e) => onUpdate(fila._key, 'nombre', e.target.value)}
          className={cn(cellCls, 'text-xs text-slate-800')}
        />
      </td>
      <td className="px-2 py-1 w-32">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fila.saldoDeudor}
          onChange={(e) => onUpdate(fila._key, 'saldoDeudor', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-right text-slate-600')}
        />
      </td>
      <td className="px-2 py-1 w-32">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fila.saldoAcreedor}
          onChange={(e) => onUpdate(fila._key, 'saldoAcreedor', e.target.value)}
          className={cn(cellCls, 'font-mono text-xs text-right text-slate-600')}
        />
      </td>
      <td className={cn('px-3 py-1 w-32 text-right font-mono text-xs font-medium', saldo < 0 ? 'text-red-600' : 'text-slate-700')}>
        {formatCurrency(saldo, { decimales: 2 })}
      </td>
      <td className="px-2 py-1 w-10 text-center">
        <button
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
