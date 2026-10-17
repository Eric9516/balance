'use client'

import { toast } from 'sonner'
import type { AppError } from '../types'

export function toastError(error: AppError): void {
  const description = error.detalle ?? undefined
  toast.error(error.mensaje, { description })
}

export function toastSuccess(mensaje: string, descripcion?: string): void {
  toast.success(mensaje, { description: descripcion })
}

// Re-export Toaster for root layout setup
export { Toaster } from 'sonner'
