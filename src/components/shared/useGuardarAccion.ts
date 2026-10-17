'use client'

import { useTransition } from 'react'
import { toastError } from '@/modules/errores/components/Toast'
import type { ActionResult } from '@/modules/errores/types'

/**
 * Ejecuta una server action que devuelve ActionResult<T>: maneja el transition
 * pendiente y el toast de error. Única forma de invocar acciones desde un
 * componente — reemplaza el bloque `startTransition + if(ok)/else toastError`
 * repetido a mano en cada vista.
 */
export function useGuardarAccion() {
  const [isPending, startTransition] = useTransition()

  function ejecutar<T>(accion: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    startTransition(async () => {
      const result = await accion()
      if (result.ok) onOk?.(result.data)
      else toastError(result.error)
    })
  }

  return { isPending, ejecutar }
}
