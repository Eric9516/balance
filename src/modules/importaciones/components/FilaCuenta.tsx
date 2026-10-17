import { Pencil, Check, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { CuentaContableDTO, RubroBaseSimple } from '../domain/types'
import type { DraftRow } from '../hooks/useFilaCuentaEdicion'

const EDIT_INPUT_BASE =
  'w-full rounded border border-blue-300 bg-white text-slate-900 px-2 py-1 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200'

function SelectRubro({
  value,
  groups,
  disabled,
  onChange,
  className,
}: {
  value: string | null
  groups: [string, RubroBaseSimple[]][]
  disabled?: boolean
  onChange: (rubroId: string | null) => void
  className?: string
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className={className}
      >
        <option value="">— Sin clasificar —</option>
        {groups.map(([label, groupRubros]) => (
          <optgroup key={label} label={label}>
            {groupRubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

export function FilaCuenta({
  cuenta,
  groups,
  efectivoRubroId,
  isSaving,
  isSelected,
  isEditing,
  draftRow,
  isSavingEdit,
  confirmDeleteId,
  isDeletingId,
  onToggleSelect,
  onAsignar,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDraftFieldChange,
  onDraftDeudorChange,
  onDraftAcreedorChange,
  onConfirmDeleteIdChange,
  onDeleteConfirm,
}: {
  cuenta: CuentaContableDTO
  groups: [string, RubroBaseSimple[]][]
  efectivoRubroId: string | null
  isSaving: boolean
  isSelected: boolean
  isEditing: boolean
  draftRow: DraftRow | null
  isSavingEdit: boolean
  confirmDeleteId: string | null
  isDeletingId: string | null
  onToggleSelect: () => void
  onAsignar: (rubroId: string | null) => void
  onEditStart: () => void
  onEditCancel: () => void
  onEditSave: () => void
  onDraftFieldChange: (field: 'nombre' | 'saldoFinal', value: string) => void
  onDraftDeudorChange: (value: string) => void
  onDraftAcreedorChange: (value: string) => void
  onConfirmDeleteIdChange: (id: string | null) => void
  onDeleteConfirm: () => void
}) {
  const c = cuenta

  // ── Fila en modo edición ──────────────────────────────────────────────────
  if (isEditing && draftRow) {
    return (
      <tr className="border-b border-blue-200 bg-blue-50">
        <td className="px-4 py-2" />
        <td className="px-4 py-2 font-mono text-xs text-slate-400">{c.codigo}</td>
        <td className="px-4 py-2">
          <input
            autoFocus
            type="text"
            value={draftRow.nombre}
            onChange={(e) => onDraftFieldChange('nombre', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onEditCancel()
            }}
            className={EDIT_INPUT_BASE}
          />
        </td>
        <td className="w-32 px-4 py-2">
          <input
            type="text"
            inputMode="decimal"
            value={draftRow.saldoDeudor}
            onChange={(e) => onDraftDeudorChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onEditCancel()
            }}
            className={cn(EDIT_INPUT_BASE, 'text-right font-mono text-xs')}
            placeholder="0"
          />
        </td>
        <td className="w-32 px-4 py-2">
          <input
            type="text"
            inputMode="decimal"
            value={draftRow.saldoAcreedor}
            onChange={(e) => onDraftAcreedorChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onEditCancel()
            }}
            className={cn(EDIT_INPUT_BASE, 'text-right font-mono text-xs')}
            placeholder="0"
          />
        </td>
        <td className="w-32 px-4 py-2">
          <input
            type="text"
            inputMode="decimal"
            value={draftRow.saldoFinal}
            onChange={(e) => onDraftFieldChange('saldoFinal', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onEditCancel()
            }}
            className={cn(EDIT_INPUT_BASE, 'text-right font-mono text-xs font-semibold')}
            placeholder="0"
          />
        </td>
        <td className="px-4 py-2">
          {/* Rubro se puede seguir asignando mientras se edita */}
          <SelectRubro
            value={efectivoRubroId}
            groups={groups}
            disabled={isSaving}
            onChange={onAsignar}
            className={cn(
              'w-full appearance-none rounded-md border bg-white py-1.5 pr-7 pl-2 text-xs transition-colors',
              efectivoRubroId
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-500',
            )}
          />
        </td>
        <td className="w-16 px-4 py-2">
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={onEditSave}
              disabled={isSavingEdit}
              title="Guardar cambios"
              className="rounded p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onEditCancel}
              disabled={isSavingEdit}
              title="Cancelar"
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // ── Fila normal ────────────────────────────────────────────────────────────
  return (
    <tr
      className={cn(
        'group border-b border-slate-100 transition-colors last:border-0',
        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/60',
      )}
    >
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="cursor-pointer rounded border-slate-300 accent-blue-600"
        />
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{c.codigo}</td>
      <td className="px-4 py-2.5 font-medium text-slate-800">{c.nombre}</td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">
        {c.saldoDeudor > 0 ? formatCurrency(c.saldoDeudor) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">
        {c.saldoAcreedor > 0 ? formatCurrency(c.saldoAcreedor) : '—'}
      </td>
      <td
        className={cn(
          'px-4 py-2.5 text-right font-mono text-xs font-semibold',
          c.saldoFinal < 0 ? 'text-red-600' : 'text-slate-700',
        )}
      >
        {formatCurrency(c.saldoFinal)}
      </td>
      <td className="px-4 py-2.5">
        <SelectRubro
          value={efectivoRubroId}
          groups={groups}
          disabled={isSaving}
          onChange={onAsignar}
          className={cn(
            'w-full appearance-none rounded-md border bg-white py-1.5 pr-7 pl-2 text-xs transition-colors',
            isSaving
              ? 'cursor-wait border-slate-200 text-slate-400'
              : efectivoRubroId
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                : 'border-slate-200 text-slate-500 hover:border-slate-300',
          )}
        />
      </td>
      <td className="w-24 px-4 py-2.5">
        {confirmDeleteId === c.id ? (
          <div className="flex items-center justify-end gap-0.5">
            <span className="mr-1 text-xs whitespace-nowrap text-red-600">¿Borrar?</span>
            <button
              onClick={onDeleteConfirm}
              title="Confirmar eliminación"
              className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onConfirmDeleteIdChange(null)}
              title="Cancelar"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {isDeletingId === c.id ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
            ) : (
              <>
                <button
                  onClick={onEditStart}
                  title="Editar cuenta"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onConfirmDeleteIdChange(c.id)}
                  title="Eliminar cuenta"
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
