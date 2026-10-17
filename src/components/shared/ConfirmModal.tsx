'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  warning?: string
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  variant?: 'destructive' | 'default'
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isPending = false,
  variant = 'destructive',
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2 space-y-3">
          <p className="text-sm text-slate-600">{description}</p>

          {warning && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{warning}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-5">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Procesando...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
