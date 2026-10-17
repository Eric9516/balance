'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { eliminarEjercicio } from '../actions/ejercicio.actions'

interface EjercicioEliminarButtonProps {
  id: string
  sociedadId: string
}

export function EjercicioEliminarButton({ id, sociedadId }: EjercicioEliminarButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      setTimeout(() => setConfirmed(false), 3000)
      return
    }
    startTransition(async () => {
      const result = await eliminarEjercicio(id, sociedadId)
      if (!result.ok) {
        toastError(result.error)
      } else {
        toastSuccess('Ejercicio eliminado')
      }
      setConfirmed(false)
    })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? '...' : confirmed ? '¿Confirmar?' : 'Eliminar'}
    </Button>
  )
}
