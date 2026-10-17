'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { Calculator, Database, Info, X } from 'lucide-react'

type StepInfo = {
  title: string
  purpose: string
  sources: string[]
  formulas: string[]
  notes?: string[]
}

function InfoSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function InfoModal({ info, onClose }: { info: StepInfo; onClose: () => void }) {
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
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                Información del paso
              </p>
              <h2 className="text-base font-semibold text-slate-900">{info.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar información"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-6 py-5">
          <InfoSection
            icon={<Info className="h-4 w-4 flex-shrink-0 text-blue-600" />}
            title="Qué hace esta pantalla"
          >
            <p className="text-sm leading-relaxed text-slate-600">{info.purpose}</p>
          </InfoSection>

          <InfoSection
            icon={<Database className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
            title="De dónde toma los datos"
          >
            <ul className="space-y-1.5">
              {info.sources.map((source) => (
                <li key={source} className="text-sm leading-relaxed text-slate-600">
                  {source}
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection
            icon={<Calculator className="h-4 w-4 flex-shrink-0 text-amber-600" />}
            title="Cálculos que aplica"
          >
            <div className="space-y-2">
              {info.formulas.map((formula) => (
                <div
                  key={formula}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700"
                >
                  {formula}
                </div>
              ))}
            </div>
          </InfoSection>

          {info.notes && info.notes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="mb-1.5 text-sm font-semibold text-amber-800">A tener en cuenta</p>
              <ul className="space-y-1.5">
                {info.notes.map((note) => (
                  <li key={note} className="text-sm leading-relaxed text-amber-700">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function StepInfoButton({ info }: { info: StepInfo }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Información: ${info.title}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-600"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && <InfoModal info={info} onClose={() => setOpen(false)} />}
    </>
  )
}

export type { StepInfo }
