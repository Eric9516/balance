'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import type { NotaDTO } from '../domain/types'

/** Subir, bajar o llevar una nota debajo de otra. Cambia su número en el balance. */
export function UbicarNota({
  nota,
  indice,
  notas,
  disabled,
  onMover,
}: {
  nota: NotaDTO
  indice: number
  notas: NotaDTO[]
  disabled: boolean
  /** null: primera. */
  onMover: (debajoDe: string | null) => void
}) {
  if (notas.length < 2) return null
  const anterior = notas[indice - 1]
  const dosAntes = notas[indice - 2]
  const siguiente = notas[indice + 1]
  const flecha =
    'rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30'
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        className={flecha}
        disabled={disabled || !anterior}
        onClick={() => onMover(dosAntes?.id ?? null)}
        title="Subir la nota"
        aria-label={`Subir ${nota.titulo}`}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={flecha}
        disabled={disabled || !siguiente}
        onClick={() => siguiente && onMover(siguiente.id)}
        title="Bajar la nota"
        aria-label={`Bajar ${nota.titulo}`}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <select
        aria-label={`Mover ${nota.titulo} debajo de otra nota`}
        value=""
        disabled={disabled}
        onChange={(e) => onMover(e.target.value === 'PRIMERA' ? null : e.target.value)}
        className="max-w-52 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-500"
      >
        <option value="" disabled>
          Mover a…
        </option>
        {indice > 0 && <option value="PRIMERA">Primera</option>}
        {notas
          .filter((n) => n.id !== nota.id && n.id !== anterior?.id)
          .map((n) => (
            <option key={n.id} value={n.id}>
              Debajo de la Nota {n.numero}: {n.titulo}
            </option>
          ))}
      </select>
    </div>
  )
}
