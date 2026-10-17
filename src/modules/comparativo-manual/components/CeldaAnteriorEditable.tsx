'use client'

import { useMemo, useState } from 'react'
import { Plus, Check, X, Trash2 } from 'lucide-react'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { parseImporte } from '@/lib/utils/parseImporte'
import { actionOk } from '@/modules/errores/types'
import type { ActionResult } from '@/modules/errores/types'
import { guardarComparativoAction, eliminarComparativoAction } from '../actions/comparativo.actions'
import {
  buildClaveHuerfano,
  type ComparativoManualDTO,
  type ModuloComparativo,
} from '../domain/types'

export type ComparativoEntry = {
  modulo: ModuloComparativo
  clave: string
  label: string
  valor: number
  esHuerfano?: boolean
  orden?: number
}

type MapaComparativo = Map<string, ComparativoEntry>

function aMapa(entradas: ComparativoEntry[]): MapaComparativo {
  return new Map(entradas.map((e) => [e.clave, e]))
}

async function guardarLoteComparativo(
  borrador: MapaComparativo,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<MapaComparativo>> {
  const resultados = await Promise.all(
    Array.from(borrador.values()).map((e) =>
      guardarComparativoAction(
        ejercicioId,
        sociedadId,
        e.modulo,
        e.clave,
        e.label,
        e.valor,
        e.esHuerfano ?? false,
        e.orden ?? 0,
      ),
    ),
  )
  const fallo = resultados.find((r) => !r.ok)
  if (fallo && !fallo.ok) return fallo
  return actionOk(borrador)
}

/**
 * Modo edición ÚNICO de la columna "Ejercicio Anterior" (comparativo manual).
 * Un borrador con todas las claves visibles (de uno o varios módulos); Guardar
 * persiste todo de una vez (en vez de on-blur por celda). Usado por Costo de
 * Ventas, Gastos, y en conjunto por SSP+EERR (comparten un solo toggle).
 */
export function useComparativoLote(
  entradas: ComparativoEntry[],
  ejercicioId: string,
  sociedadId: string,
) {
  const inicial = useMemo(() => aMapa(entradas), [entradas])
  const {
    valor,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
    sincronizar,
  } = useEdicionLote(inicial, (borrador) =>
    guardarLoteComparativo(borrador, ejercicioId, sociedadId),
  )

  function setValor(clave: string, nuevoValor: number) {
    actualizar((prev) => {
      const next = new Map(prev)
      const actual = next.get(clave)
      if (actual) next.set(clave, { ...actual, valor: nuevoValor })
      return next
    })
  }

  function agregar(entry: ComparativoEntry) {
    sincronizar(new Map(valor).set(entry.clave, entry))
  }

  function quitar(clave: string) {
    const next = new Map(valor)
    next.delete(clave)
    sincronizar(next)
  }

  return {
    entradas: valor,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    setValor,
    agregar,
    quitar,
  }
}

// Toggle de edición de la columna "Ejercicio Anterior" — usa el BotonEditar canónico.
export function ToggleEditarAnterior({
  editando,
  isPending = false,
  onEditar,
  onGuardar,
  onCancelar,
  className,
}: {
  editando: boolean
  isPending?: boolean
  onEditar: () => void
  onGuardar: () => void
  onCancelar: () => void
  className?: string
}) {
  return (
    <BotonEditar
      editando={editando}
      isPending={isPending}
      onEditar={onEditar}
      onGuardar={onGuardar}
      onCancelar={onCancelar}
      label="Editar ejercicio anterior"
      className={className}
    />
  )
}

// ─── Agregar fila "solo del período anterior" (huérfana) ──────────────────────
// Se persiste de inmediato (alta estructural) y se refleja en el mapa vía `onAdded`.
export function AgregarFilaAnterior({
  ejercicioId,
  sociedadId,
  modulo,
  seccion,
  ordenBase = 0,
  texto = 'Agregar fila del período anterior',
  onAdded,
}: {
  ejercicioId: string
  sociedadId: string
  modulo: ModuloComparativo
  seccion?: string | null
  ordenBase?: number
  texto?: string
  onAdded?: (dto: ComparativoManualDTO) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [valor, setValor] = useState('')
  const { isPending, ejecutar } = useGuardarAccion()

  function reset() {
    setLabel('')
    setValor('')
    setOpen(false)
  }

  function handleAdd() {
    if (!label.trim()) return
    const v = parseImporte(valor)
    const clave = buildClaveHuerfano(seccion)
    ejecutar(
      () =>
        guardarComparativoAction(
          ejercicioId,
          sociedadId,
          modulo,
          clave,
          label.trim(),
          v,
          true,
          ordenBase,
        ),
      (dto) => {
        onAdded?.(dto)
        reset()
      },
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-blue-600"
      >
        <Plus className="h-3.5 w-3.5" />
        {texto}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nombre del rubro / concepto"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') reset()
        }}
        className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
      />
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="0,00"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') reset()
        }}
        className="w-32 rounded border border-blue-200 bg-white px-2 py-1 text-right font-mono text-sm text-slate-900 tabular-nums focus:border-blue-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending || !label.trim()}
        className="p-1 text-emerald-600 transition-colors hover:text-emerald-700 disabled:opacity-40"
        title="Agregar"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={reset}
        className="p-1 text-slate-400 transition-colors hover:text-slate-600"
        title="Cancelar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Botón de eliminar fila huérfana ──────────────────────────────────────────
export function EliminarFilaAnterior({
  ejercicioId,
  sociedadId,
  modulo,
  clave,
  onDeleted,
}: {
  ejercicioId: string
  sociedadId: string
  modulo: ModuloComparativo
  clave: string
  onDeleted?: () => void
}) {
  const { isPending, ejecutar } = useGuardarAccion()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        ejecutar(() => eliminarComparativoAction(ejercicioId, sociedadId, modulo, clave), onDeleted)
      }
      className="p-1 text-slate-300 transition-colors hover:text-red-500 disabled:opacity-40"
      title="Eliminar fila"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
