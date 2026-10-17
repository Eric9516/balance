'use client'

import { useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Settings2, X, CheckCircle2, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'

export function ConfigModal({
  todasSecciones,
  seleccionadas,
  onToggle,
  onMover,
  onToggleEERR,
  onClose,
}: {
  todasSecciones: GastosSecciones['todasSecciones']
  seleccionadas: Set<string>
  onToggle: (key: string, value: boolean) => void
  onMover: (keyA: string, keyB: string) => void
  onToggleEERR: (key: string, value: boolean) => void
  onClose: () => void
}) {
  const [isPending] = useTransition()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Secciones en el Anexo III</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Seleccioná qué secciones aparecen como columnas en el Anexo III. Los importes se
            calculan automáticamente desde las cuentas clasificadas.
          </p>

          {todasSecciones.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">No hay secciones creadas todavía.</p>
              <a
                href="/configuracion/rubros"
                target="_blank"
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 underline"
              >
                Ir a Configuración → Clasificaciones <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {todasSecciones.map((s, idx) => {
                const checked = seleccionadas.has(s.key)
                return (
                  <div
                    key={s.key}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors',
                      checked ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-slate-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggle(s.key, e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {s.nombre}
                      </span>
                      {s.sigla && (
                        <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                          {s.sigla}
                        </span>
                      )}
                    </div>
                    {checked && (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    )}
                    {checked && (
                      <button
                        type="button"
                        onClick={() => onToggleEERR(s.key, !s.aparecEnEERR)}
                        disabled={isPending}
                        title={s.aparecEnEERR ? 'Quitar del EERR' : 'Agregar al EERR'}
                        className={cn(
                          'flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                          s.aparecEnEERR
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100',
                        )}
                      >
                        EERR
                      </button>
                    )}
                    <div className="flex flex-shrink-0 flex-col gap-0.5">
                      <button
                        onClick={() => {
                          const anterior = todasSecciones[idx - 1]
                          if (anterior) onMover(s.key, anterior.key)
                        }}
                        disabled={idx === 0 || isPending}
                        className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
                        title="Mover arriba"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const siguiente = todasSecciones[idx + 1]
                          if (siguiente) onMover(s.key, siguiente.key)
                        }}
                        disabled={idx === todasSecciones.length - 1 || isPending}
                        className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
                        title="Mover abajo"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Para crear nuevas secciones de gastos, andá a{' '}
            <a
              href="/configuracion/rubros"
              target="_blank"
              className="inline-flex items-center gap-0.5 text-blue-600 underline"
            >
              Configuración → Clasificaciones <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
