'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMontado } from './useMontado'

interface DialogoProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Botones de abajo a la derecha. */
  footer?: ReactNode
  /** Mientras se guarda no se cierra (ni con Escape ni tocando afuera). */
  bloqueado?: boolean
  className?: string
}

/** Marco único de las ventanas de la app: fondo, título, cerrar con Escape y los botones. */
export function Dialogo({
  open,
  onClose,
  title,
  children,
  footer,
  bloqueado = false,
  className,
}: DialogoProps) {
  const mounted = useMontado()
  const idTitulo = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !bloqueado) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, bloqueado])

  // Mientras está abierto, la página de atrás no se desplaza
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !bloqueado && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={cn(
          'relative z-10 mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <h2 id={idTitulo} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-6 pb-2">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 px-6 py-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
