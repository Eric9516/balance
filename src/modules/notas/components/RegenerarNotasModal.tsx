'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { useMontado } from '@/components/shared/useMontado'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import type { AppError } from '@/modules/errores/types'
import {
  generarNotasAutomaticasAction,
  previsualizarRegeneracionAction,
} from '../actions/notas.actions'
import {
  OPCIONES_POR_DEFECTO,
  type GrupoResumen,
  type OpcionesRegeneracion,
  type ResumenRegeneracion,
} from '../domain/regeneracion'

const ITEMS_VISIBLES = 5

function Grupo({
  grupo,
  marcado,
  onCambiar,
}: {
  grupo: GrupoResumen
  marcado: boolean
  onCambiar: (v: boolean) => void
}) {
  const [verTodos, setVerTodos] = useState(false)
  const items = verTodos ? grupo.items : grupo.items.slice(0, ITEMS_VISIBLES)
  const pierdeDatos = grupo.clave === 'quitarFilasConAnterior'
  return (
    <li
      className={cn(
        'rounded-lg border px-4 py-3',
        pierdeDatos && marcado ? 'border-red-200 bg-red-50' : 'border-slate-200',
      )}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => onCambiar(e.target.checked)}
          className="mt-0.5 accent-blue-600"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
            {grupo.titulo}
            <span className="font-mono text-xs text-slate-400">({grupo.items.length})</span>
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">{grupo.descripcion}</span>
        </span>
      </label>
      <ul className="mt-2 space-y-0.5 pl-6">
        {items.map((it, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 text-xs text-slate-600">
            <span className="min-w-0 truncate">
              <span className="text-slate-400">{it.nota}</span>
              {it.detalle !== undefined && <> · {it.detalle || '(sin concepto)'}</>}
            </span>
            {it.importe !== undefined && (
              <span className="flex-shrink-0 font-mono tabular-nums">
                {formatCurrency(it.importe)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {grupo.items.length > ITEMS_VISIBLES && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="mt-1 pl-6 text-xs font-medium text-blue-600 hover:underline"
        >
          {verTodos ? 'Ver menos' : `Ver los ${grupo.items.length}`}
        </button>
      )}
    </li>
  )
}

/**
 * Regenerar las notas desde los rubros: explica qué hace, muestra lo que cambiaría y deja elegir
 * qué aplicar. Lo que agrega o actualiza desde el balance viene marcado; lo que borra o pisa algo
 * cargado a mano, desmarcado.
 */
export function RegenerarNotasModal({
  ejercicioId,
  sociedadId,
  onClose,
  onAplicado,
}: {
  ejercicioId: string
  sociedadId: string
  onClose: () => void
  onAplicado: () => void
}) {
  const mounted = useMontado()
  const [resumen, setResumen] = useState<ResumenRegeneracion | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [opciones, setOpciones] = useState<OpcionesRegeneracion>(OPCIONES_POR_DEFECTO)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let vigente = true
    previsualizarRegeneracionAction(ejercicioId).then((r) => {
      if (!vigente) return
      if (r.ok) setResumen(r.data)
      else setError(r.error)
    })
    return () => {
      vigente = false
    }
  }, [ejercicioId])

  function aplicar() {
    startTransition(async () => {
      const r = await generarNotasAutomaticasAction(ejercicioId, sociedadId, opciones)
      if (!r.ok) {
        toastError(r.error)
        return
      }
      toastSuccess('Notas actualizadas')
      onAplicado()
    })
  }

  if (!mounted) return null
  const sinCambios = resumen !== null && resumen.grupos.length === 0 && !resumen.reordena

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isPending ? undefined : onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Regenerar las notas</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-sm text-slate-600">
            Regenerar actualiza las notas con el balance: crea las notas de los rubros nuevos,
            agrega filas para las cuentas nuevas y actualiza los importes del ejercicio actual.
            Elegí qué aplicar: lo que borra o reemplaza algo que cargaste a mano viene desmarcado.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <span>{error.mensaje}</span>
            </div>
          )}

          {!resumen && !error && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" /> Revisando qué cambiaría…
            </p>
          )}

          {sinCambios && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              Las notas ya están al día con el balance: no hay nada para cambiar.
            </div>
          )}

          {resumen && resumen.grupos.length > 0 && (
            <ul className="space-y-2">
              {resumen.grupos.map((g) => (
                <Grupo
                  key={g.clave}
                  grupo={g}
                  marcado={opciones[g.clave]}
                  onCambiar={(v) => setOpciones((o) => ({ ...o, [g.clave]: v }))}
                />
              ))}
            </ul>
          )}

          {resumen?.reordena && (
            <p className="text-xs text-slate-500">
              Además, siempre se ordenan y numeran las notas según el orden de los rubros.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {sinCambios ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!sinCambios && (
            <Button onClick={aplicar} disabled={isPending || !resumen}>
              {isPending ? 'Aplicando…' : 'Aplicar'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
