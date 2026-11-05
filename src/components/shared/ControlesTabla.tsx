'use client'

import { ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react'

/** Botón "Solo totales / Ver detalle" para plegar o expandir todos los grupos de columnas. */
export function TogglePlegarTodos({
  todosPlegados,
  onPlegar,
  onExpandir,
  disabled = false,
}: {
  todosPlegados: boolean
  onPlegar: () => void
  onExpandir: () => void
  disabled?: boolean
}) {
  const Icono = todosPlegados ? ChevronsLeftRight : ChevronsRightLeft
  return (
    <button
      type="button"
      onClick={todosPlegados ? onExpandir : onPlegar}
      disabled={disabled}
      title={disabled ? 'En edición se muestran todas las columnas' : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-linea bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <Icono className="h-3.5 w-3.5" />
      {todosPlegados ? 'Ver detalle' : 'Solo totales'}
    </button>
  )
}
