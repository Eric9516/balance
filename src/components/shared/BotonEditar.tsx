'use client'

import { Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Control ÚNICO de edición de tablas/secciones de la app.
 * Lápiz "Editar" → entra en modo edición (borrador local).
 * En edición: "Cancelar" descarta el borrador, "Guardar" lo persiste de una vez.
 * Va arriba a la derecha de la tabla/sección. No inventar otros controles de edición.
 * Pensado para usarse junto a `useEdicionLote`.
 */
export function BotonEditar({
  editando,
  onEditar,
  onGuardar,
  onCancelar,
  isPending = false,
  label = 'Editar',
  className,
}: {
  editando: boolean
  onEditar: () => void
  onGuardar: () => void
  onCancelar: () => void
  isPending?: boolean
  label?: string
  className?: string
}) {
  if (!editando) {
    return (
      <button
        type="button"
        onClick={onEditar}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
          'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
          className,
        )}
      >
        <Pencil className="h-3.5 w-3.5" />
        {label}
      </button>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={onCancelar}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        Cancelar
      </button>
      <button
        type="button"
        onClick={onGuardar}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
