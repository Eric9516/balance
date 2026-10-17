'use client'

import { useState, useEffect } from 'react'
import { useMontado } from '@/components/shared/useMontado'
import { createPortal } from 'react-dom'
import { Info, X, FolderOpen, Tag, ArrowRight, BarChart3, Receipt } from 'lucide-react'

function Modal({ onClose }: { onClose: () => void }) {
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

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
              <Info className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Secciones y clasificaciones</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Sección */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">¿Qué es una sección?</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Un agrupador con <strong>nombre y sigla libres</strong>, definidos por el contador.
              Por ejemplo: “Gastos Operativos / GTO”, “Activo Corriente / AC”, “Disponibilidades”.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Las secciones organizan el dropdown de clasificación de cuentas y, si se marcan como{' '}
              <strong>gasto</strong>, también generan columnas automáticas en el Anexo III y líneas
              en el EERR.
            </p>
          </div>

          {/* Clasificación */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">¿Qué es una clasificación?</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              El rubro específico al que asignás las cuentas del balance de sumas y saldos. Por
              ejemplo: “Caja y Bancos”, “Sueldos y jornales”, “Alquileres”. Cada clasificación va
              dentro de una sección.
            </p>
          </div>

          {/* Checkbox es gasto */}
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">
                ¿Qué hace el checkbox “¿Es un gasto?”?
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-amber-700">
              Cuando marcás una sección como gasto, sus clasificaciones aparecen en{' '}
              <strong>dos lugares automáticamente</strong>:
            </p>
            <ul className="mt-1 space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-amber-700">
                <BarChart3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  <strong>EERR</strong> — como una línea de gasto con el total de la sección
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm text-amber-700">
                <Receipt className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  <strong>Anexo III de Gastos</strong> — como una columna con el detalle por
                  clasificación, calculado automáticamente desde las cuentas clasificadas
                </span>
              </li>
            </ul>
          </div>

          {/* Relación */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Relación entre niveles</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                Sección
              </span>
              <ArrowRight className="h-3 w-3 flex-shrink-0" />
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                Clasificaciones
              </span>
              <ArrowRight className="h-3 w-3 flex-shrink-0" />
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                Cuentas contables
              </span>
            </div>
          </div>

          {/* Ejemplo */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Ejemplo</h3>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs">
              <div>
                <p className="font-semibold text-blue-700">
                  📁 Gastos Operativos <span className="text-slate-400">[GTO]</span>{' '}
                  <span className="non-italic font-sans text-[10px] text-amber-600">gasto ✓</span>
                </p>
                <p className="pl-4 text-slate-500">└── Sueldos y jornales → $15.000</p>
                <p className="pl-4 text-slate-500">└── Alquileres → $5.000</p>
                <p className="pl-4 font-semibold text-blue-700">
                  Total GTO: $20.000 → va al EERR y Anexo III
                </p>
              </div>
              <div>
                <p className="font-semibold text-blue-700">
                  📁 Disponibilidades <span className="text-slate-400">[no es gasto]</span>
                </p>
                <p className="pl-4 text-slate-500">└── Caja y Bancos → aparece en el SSP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
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

export function ClasificacionesInfoButton() {
  const [open, setOpen] = useState(false)
  const mounted = useMontado()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="¿Cómo funcionan las secciones y clasificaciones?"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-600"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {mounted && open && <Modal onClose={() => setOpen(false)} />}
    </>
  )
}
