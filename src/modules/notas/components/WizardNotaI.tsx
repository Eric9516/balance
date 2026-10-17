'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronLeft, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { guardarConfigNotaIAction } from '../actions/notas.actions'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfigNotaILocal = {
  adopcionRT54: 'PRIMERA_ADOPCION' | 'APLICACION_CONTINUADA' | null
  criteriosBienesCambio: 'COSTO_ADQUISICION' | 'ULTIMA_COMPRA' | 'COSTO_REPOSICION' | null
  hechosPosterioress: boolean | null
  hechosPosterioressTexto: string | null
}

const TEXTO_HECHOS_DEFAULT =
  'No existen acontecimientos u operaciones ocurridos entre la fecha de cierre del ejercicio y la de emisión de los presentes estados contables que puedan modificar significativamente la situación patrimonial y financiera de la entidad a la fecha de cierre ni los resultados del presente ejercicio.'

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function RadioOpcion({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all',
        checked
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className={cn(
        'mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors',
        checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300',
      )}>
        {checked && <div className="h-full w-full rounded-full bg-white scale-[0.4]" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
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
  return (
    <div className="space-y-3">
      <RadioOpcion
        checked={value === 'PRIMERA_ADOPCION'}
        onChange={() => onChange('PRIMERA_ADOPCION')}
        label="Primera adopción"
        description="Es el primer ejercicio en que la entidad presenta estados contables bajo RT 54. El texto de la Nota I incluirá la mención a la adopción inicial y las reclasificaciones realizadas."
      />
      <RadioOpcion
        checked={value === 'APLICACION_CONTINUADA'}
        onChange={() => onChange('APLICACION_CONTINUADA')}
        label="Aplicación continuada"
        description="La entidad ya venía aplicando RT 54 en ejercicios anteriores. El texto de la Nota I no incluye mención a adopción inicial."
      />
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
  return (
    <div className="space-y-3">
      <RadioOpcion
        checked={value === 'COSTO_ADQUISICION'}
        onChange={() => onChange('COSTO_ADQUISICION')}
        label="Costo de adquisición"
        description="Los bienes de cambio se miden a su costo de adquisición reexpresado en moneda de cierre."
      />
      <RadioOpcion
        checked={value === 'ULTIMA_COMPRA'}
        onChange={() => onChange('ULTIMA_COMPRA')}
        label="Costo de la última compra"
        description="Los bienes de cambio se miden al costo de la última compra a la fecha de cierre."
      />
      <RadioOpcion
        checked={value === 'COSTO_REPOSICION'}
        onChange={() => onChange('COSTO_REPOSICION')}
        label="Costo de reposición"
        description="Precio que demandaría adquirir bienes de similares características a valores vigentes al cierre. Habitual en este estudio."
      />
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
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <RadioOpcion
          checked={tieneHechos === false}
          onChange={() => onToggle(false)}
          label="No"
          description="No existen hechos posteriores relevantes a informar. Se usará el texto estándar."
        />
        <RadioOpcion
          checked={tieneHechos === true}
          onChange={() => onToggle(true)}
          label="Sí"
          description="Existen hechos posteriores al cierre que deben informarse en notas."
        />
      </div>

      {tieneHechos === false && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500 italic leading-relaxed">{TEXTO_HECHOS_DEFAULT}</p>
        </div>
      )}

      {tieneHechos === true && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Descripción de hechos posteriores
          </label>
          <textarea
            value={texto ?? ''}
            onChange={(e) => onTexto(e.target.value)}
            rows={5}
            className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            placeholder="Describí los hechos posteriores al cierre del ejercicio..."
          />
        </div>
      )}
    </div>
  )
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

const PASOS = [
  { numero: 1, titulo: 'Adopción de la RT 54' },
  { numero: 2, titulo: 'Criterio — Bienes de Cambio' },
  { numero: 3, titulo: 'Hechos posteriores al cierre' },
]

interface Props {
  initialConfig: ConfigNotaILocal
  ejercicioId: string
  sociedadId: string
  onClose: () => void
  onGuardado: (config: ConfigNotaILocal) => void
}

export function WizardNotaI({ initialConfig, ejercicioId, sociedadId, onClose, onGuardado }: Props) {
  const [paso, setPaso] = useState(1)
  const [config, setConfig] = useState<ConfigNotaILocal>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const puedeAvanzar = () => {
    if (paso === 1) return config.adopcionRT54 !== null
    if (paso === 2) return config.criteriosBienesCambio !== null
    if (paso === 3) return config.hechosPosterioress !== null
    return true
  }

  function handleConfirmar() {
    startTransition(async () => {
      const result = await guardarConfigNotaIAction(ejercicioId, sociedadId, {
        adopcionRT54: config.adopcionRT54 as any,
        criteriosBienesCambio: config.criteriosBienesCambio as any,
        hechosPosterioress: config.hechosPosterioress,
        hechosPosterioressTexto: config.hechosPosterioress
          ? (config.hechosPosterioressTexto?.trim() || null)
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
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-4">
            {PASOS.map((p, i) => (
              <div key={p.numero} className="flex items-center gap-2">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors',
                  paso > p.numero
                    ? 'bg-blue-600 text-white'
                    : paso === p.numero
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}>
                  {paso > p.numero ? <CheckCircle2 className="h-3.5 w-3.5" /> : p.numero}
                </div>
                {i < PASOS.length - 1 && (
                  <div className={cn('h-px flex-1 min-w-[24px] transition-colors', paso > p.numero ? 'bg-blue-400' : 'bg-slate-200')} />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Configuración Nota I — Paso {paso} de {PASOS.length}
              </p>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {PASOS[paso - 1].titulo}
              </h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 py-5 min-h-[280px]">
          {paso === 1 && (
            <Paso1
              value={config.adopcionRT54}
              onChange={(v) => setConfig(prev => ({ ...prev, adopcionRT54: v }))}
            />
          )}
          {paso === 2 && (
            <Paso2
              value={config.criteriosBienesCambio}
              onChange={(v) => setConfig(prev => ({ ...prev, criteriosBienesCambio: v }))}
            />
          )}
          {paso === 3 && (
            <Paso3
              tieneHechos={config.hechosPosterioress}
              texto={config.hechosPosterioressTexto}
              onToggle={(v) => setConfig(prev => ({
                ...prev,
                hechosPosterioress: v,
                hechosPosterioressTexto: v ? (prev.hechosPosterioressTexto ?? '') : null,
              }))}
              onTexto={(v) => setConfig(prev => ({ ...prev, hechosPosterioressTexto: v }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => paso > 1 ? setPaso(p => p - 1) : onClose()}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors px-3 py-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {paso < PASOS.length ? (
            <button
              onClick={() => setPaso(p => p + 1)}
              disabled={!puedeAvanzar() || isPending}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirmar}
              disabled={!puedeAvanzar() || isPending}
              className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
