'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from './Dialogo'

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
  return (
    <Dialogo
      open={open}
      onClose={onClose}
      title={title}
      bloqueado={isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Procesando...' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
      {warning && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700">{warning}</p>
        </div>
      )}
    </Dialogo>
  )
}
