'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { parseImporte } from '@/lib/utils/parseImporte'

/**
 * Celda de número ÚNICA de la app (importes contables).
 * - Fuera de modo edición (o `soloLectura`): muestra el valor formateado ('—' si es 0).
 * - En modo edición: input que guarda on-blur (parseo AR robusto) si el valor cambió.
 *
 * Reemplaza las celdas editables ad-hoc de cada tabla. Usar SIEMPRE esta.
 * El padre la envuelve en su <td>.
 */
export function CeldaNumero({
  value,
  editando,
  onSave,
  decimales = 2,
  negativo = false,
  soloLectura = false,
  dense = false,
  placeholder = '0',
  className,
}: {
  value: number
  editando: boolean
  onSave: (v: number) => void
  decimales?: number
  /** Muestra el valor entre paréntesis (deducción). */
  negativo?: boolean
  /** Celda calculada: nunca editable. */
  soloLectura?: boolean
  /** Versión compacta para matrices densas (text-xs, padding chico). */
  dense?: boolean
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const [focus, setFocus] = useState(false)
  const tam = dense ? 'text-xs' : 'text-sm'

  // ── Modo lectura ──────────────────────────────────────────────────────────
  // `negativo` = estilo deducción (paréntesis), color normal.
  // Rojo solo si el valor es REALMENTE negativo.
  if (soloLectura || !editando) {
    return (
      <span
        className={cn(
          'block text-right font-mono tabular-nums',
          tam,
          value === 0 ? 'text-slate-300' : value < 0 ? 'text-red-600' : 'text-slate-700',
          className,
        )}
      >
        {value === 0
          ? '—'
          : negativo
            ? `(${formatCurrency(Math.abs(value), { decimales })})`
            : formatCurrency(value, { decimales })}
      </span>
    )
  }

  // ── Modo edición ──────────────────────────────────────────────────────────
  // Sin foco: muestra formateado (2.746.608,79) para leer fácil.
  // Con foco: muestra el número crudo para editar cómodo. Guarda on-blur.
  return (
    <input
      type="text"
      inputMode="decimal"
      value={focus ? draft : value === 0 ? '' : formatCurrency(value, { decimales })}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setDraft(value === 0 ? '' : String(value))
        setFocus(true)
        setTimeout(() => e.target.select(), 0)
      }}
      onBlur={() => {
        setFocus(false)
        const v = parseImporte(draft)
        if (v !== value) onSave(v)
      }}
      placeholder={placeholder}
      className={cn(
        'w-full text-right font-mono text-slate-900 bg-white border border-blue-200 hover:border-blue-300 focus:border-blue-500 rounded focus:outline-none transition-colors tabular-nums placeholder:text-slate-300',
        tam,
        dense ? 'px-1.5 py-0.5' : 'px-2 py-1',
        className,
      )}
    />
  )
}
