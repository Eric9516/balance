'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { avanzarEstadoEjercicio } from '../actions/ejercicio.actions'
import type { EstadoEjercicio } from '@prisma/client'

interface EjercicioEstadoButtonProps {
  id: string
  sociedadId: string
  estadoActual: EstadoEjercicio
  nuevoEstado: EstadoEjercicio
  label: string
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost'
}

export function EjercicioEstadoButton({
  id,
  sociedadId,
  estadoActual,
  nuevoEstado,
  label,
  variant = 'secondary',
}: EjercicioEstadoButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await avanzarEstadoEjercicio(id, sociedadId, estadoActual, nuevoEstado)
      if (!result.ok) {
        toastError(result.error)
      } else {
        toastSuccess(`Estado actualizado correctamente`)
      }
    })
  }

  return (
    <Button variant={variant} size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? '...' : label}
    </Button>
  )
}
