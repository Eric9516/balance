'use client'

import { useState, useTransition, useEffect, useId } from 'react'
import { useMontado } from '@/components/shared/useMontado'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronLeft, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { guardarConfigNotaIAction } from '../actions/notas.actions'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { AyudaOpcion } from '@/components/shared/AyudaOpcion'
import {
  AYUDA_ADOPCION_RT54,
  AYUDA_CRITERIO_BIENES_CAMBIO,
  AYUDA_HECHOS_POSTERIORES,
  type ExplicacionOpcion,
} from '@/modules/ayuda/domain/opciones'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfigNotaILocal = {
  adopcionRT54: 'PRIMERA_ADOPCION' | 'APLICACION_CONTINUADA' | null
  criteriosBienesCambio: 'COSTO_ADQUISICION' | 'ULTIMA_COMPRA' | 'COSTO_REPOSICION' | null
  hechosPosterioress: boolean | null
  hechosPosterioressTexto: string | null
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function Explicacion({ texto }: { texto: string }) {
  return <p className="mb-3 text-xs leading-relaxed text-slate-500">{texto}</p>
}

function RadioOpcion({
  checked,
  onChange,
  ayuda,
}: {
  checked: boolean
  onChange: () => void
  /** Etiqueta, descripción y explicación del símbolo (?), de la ayuda. */
  ayuda: ExplicacionOpcion
}) {
  // Atado por id: sin `htmlFor`, la etiqueta activaría el primer control que contiene, que es el
  // símbolo (?), y tocar la opción abriría la ayuda en lugar de elegirla.
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all',
        checked
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div
        className={cn(
          'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-colors',
          checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300',
        )}
      >
        {checked && <div className="h-full w-full scale-[0.4] rounded-full bg-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-slate-800">{ayuda.etiqueta}</p>
          <AyudaOpcion ayuda={ayuda} />
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{ayuda.resumen}</p>
      </div>
      <input id={id} type="radio" checked={checked} onChange={onChange} className="sr-only" />
    </label>
  )
}

// ─── Pasos del wizard ─────────────────────────────────────────────────────────

function Paso1({
  value,
  onChange,
}: {
  value: ConfigNotaILocal['adopcionRT54']
  onChange: (v: ConfigNotaILocal['adopcionRT54']) => void
}) {
  const { explicacion, opciones } = AYUDA_ADOPCION_RT54
  return (
    <div>
      <Explicacion texto={explicacion} />
      <div className="space-y-3">
        {(['PRIMERA_ADOPCION', 'APLICACION_CONTINUADA'] as const).map((k) => (
          <RadioOpcion
            key={k}
            checked={value === k}
            onChange={() => onChange(k)}
            ayuda={opciones[k]}
          />
        ))}
      </div>
    </div>
  )
}

function Paso2({
  value,
  onChange,
}: {
  value: ConfigNotaILocal['criteriosBienesCambio']
  onChange: (v: ConfigNotaILocal['criteriosBienesCambio']) => void
}) {
  const { explicacion, opciones } = AYUDA_CRITERIO_BIENES_CAMBIO
  return (
    <div>
      <Explicacion texto={explicacion} />
      <div className="space-y-3">
        {(['COSTO_ADQUISICION', 'ULTIMA_COMPRA', 'COSTO_REPOSICION'] as const).map((k) => (
          <RadioOpcion
            key={k}
            checked={value === k}
            onChange={() => onChange(k)}
            ayuda={opciones[k]}
          />
        ))}
      </div>
    </div>
  )
}

function Paso3({
  tieneHechos,
  texto,
  onToggle,
  onTexto,
}: {
  tieneHechos: boolean | null
  texto: string | null
  onToggle: (v: boolean) => void
  onTexto: (v: string) => void
}) {
  const { explicacion, opciones } = AYUDA_HECHOS_POSTERIORES
  return (
    <div className="space-y-4">
      <div>
        <Explicacion texto={explicacion} />
        <div className="space-y-3">
          <RadioOpcion
            checked={tieneHechos === false}
            onChange={() => onToggle(false)}
            ayuda={opciones.NO}
          />
          <RadioOpcion
            checked={tieneHechos === true}
            onChange={() => onToggle(true)}
            ayuda={opciones.SI}
          />
        </div>
      </div>

      {tieneHechos === true && (
        <div>
          <label
            htmlFor="hechos-posteriores-texto"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Descripción de hechos posteriores (obligatoria)
          </label>
          <textarea
            id="hechos-posteriores-texto"
            value={texto ?? ''}
            onChange={(e) => onTexto(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
            placeholder="Qué pasó después del cierre y, si se puede estimar, su efecto..."
          />
        </div>
      )}
    </div>
  )
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

const PASOS = [
  { numero: 1, titulo: AYUDA_ADOPCION_RT54.titulo },
  { numero: 2, titulo: AYUDA_CRITERIO_BIENES_CAMBIO.titulo },
  { numero: 3, titulo: AYUDA_HECHOS_POSTERIORES.titulo },
]

interface Props {
  initialConfig: ConfigNotaILocal
  ejercicioId: string
  sociedadId: string
  onClose: () => void
  onGuardado: (config: ConfigNotaILocal) => void
}

export function WizardNotaI({
  initialConfig,
  ejercicioId,
  sociedadId,
  onClose,
  onGuardado,
}: Props) {
  const [paso, setPaso] = useState(1)
  const [config, setConfig] = useState<ConfigNotaILocal>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const mounted = useMontado()

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

  const puedeAvanzar = () => {
    if (paso === 1) return config.adopcionRT54 !== null
    if (paso === 2) return config.criteriosBienesCambio !== null
    // Con hechos posteriores, la descripción es obligatoria (NEG-007 en el servidor).
    if (paso === 3)
      return (
        config.hechosPosterioress === false ||
        (config.hechosPosterioress === true && !!config.hechosPosterioressTexto?.trim())
      )
    return true
  }

  function handleConfirmar() {
    startTransition(async () => {
      const result = await guardarConfigNotaIAction(ejercicioId, sociedadId, {
        adopcionRT54: config.adopcionRT54,
        criteriosBienesCambio: config.criteriosBienesCambio,
        hechosPosterioress: config.hechosPosterioress,
        hechosPosterioressTexto: config.hechosPosterioress
          ? config.hechosPosterioressTexto?.trim() || null
          : null,
      })
      if (result.ok) {
        toastSuccess('Configuración guardada')
        onGuardado(config)
        onClose()
      } else {
        toastError(result.error)
      }
    })
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 pt-5 pb-4">
          {/* Stepper */}
          <div className="mb-4 flex items-center gap-2">
            {PASOS.map((p, i) => (
              <div key={p.numero} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    paso > p.numero
                      ? 'bg-blue-600 text-white'
                      : paso === p.numero
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-500',
                  )}
                >
                  {paso > p.numero ? <CheckCircle2 className="h-3.5 w-3.5" /> : p.numero}
                </div>
                {i < PASOS.length - 1 && (
                  <div
                    className={cn(
                      'h-px min-w-[24px] flex-1 transition-colors',
                      paso > p.numero ? 'bg-blue-400' : 'bg-slate-200',
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Configuración Nota I — Paso {paso} de {PASOS.length}
              </p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">
                {PASOS[paso - 1]?.titulo}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="min-h-[280px] px-6 py-5">
          {paso === 1 && (
            <Paso1
              value={config.adopcionRT54}
              onChange={(v) => setConfig((prev) => ({ ...prev, adopcionRT54: v }))}
            />
          )}
          {paso === 2 && (
            <Paso2
              value={config.criteriosBienesCambio}
              onChange={(v) => setConfig((prev) => ({ ...prev, criteriosBienesCambio: v }))}
            />
          )}
          {paso === 3 && (
            <Paso3
              tieneHechos={config.hechosPosterioress}
              texto={config.hechosPosterioressTexto}
              onToggle={(v) =>
                setConfig((prev) => ({
                  ...prev,
                  hechosPosterioress: v,
                  hechosPosterioressTexto: v ? (prev.hechosPosterioressTexto ?? '') : null,
                }))
              }
              onTexto={(v) => setConfig((prev) => ({ ...prev, hechosPosterioressTexto: v }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={() => (paso > 1 ? setPaso((p) => p - 1) : onClose())}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {paso < PASOS.length ? (
            <button
              onClick={() => setPaso((p) => p + 1)}
              disabled={!puedeAvanzar() || isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirmar}
              disabled={!puedeAvanzar() || isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
