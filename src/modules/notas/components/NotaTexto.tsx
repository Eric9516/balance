'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toastError } from '@/modules/errores/components/Toast'
import { actualizarNotaAction, eliminarNotaAction } from '../actions/notas.actions'
import type { NotaDTO } from '../domain/types'

// ─── Nota de texto (INFORMATIVA) ──────────────────────────────────────────────

export function NotaTexto({
  nota,
  ejercicioId,
  sociedadId,
  onChange,
  onDelete,
}: {
  nota: NotaDTO
  ejercicioId: string
  sociedadId: string
  onChange: (updated: NotaDTO) => void
  onDelete: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function saveTexto(value: string) {
    startTransition(async () => {
      const result = await actualizarNotaAction(nota.id, ejercicioId, sociedadId, {
        textoApertura: value || null,
      })
      if (result.ok) onChange(result.data)
    })
  }

  function eliminarNota() {
    startTransition(async () => {
      const result = await eliminarNotaAction(nota.id, ejercicioId, sociedadId)
      if (result.ok) onDelete()
      else toastError(result.error)
    })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white',
        isPending && 'opacity-70',
      )}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
        <span className="text-sm font-bold text-slate-900">
          Nota N° {nota.numero ?? '?'}: <span className="uppercase">{nota.titulo}</span>
        </span>
        <button
          type="button"
          onClick={eliminarNota}
          disabled={isPending}
          className="text-slate-300 transition-colors hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {/* Texto editable */}
      <div className="px-5 py-4">
        <textarea
          defaultValue={nota.textoApertura ?? ''}
          onBlur={(e) => saveTexto(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none"
          placeholder="Texto de la nota..."
        />
      </div>
    </div>
  )
}
