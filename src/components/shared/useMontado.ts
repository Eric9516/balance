'use client'

import { useSyncExternalStore } from 'react'

const suscribir = () => () => {}

/**
 * `true` solo en el cliente (después de hidratar). Para portales a `document.body`
 * sin el patrón `useEffect(() => setMounted(true))`, que fuerza un render extra.
 */
export function useMontado(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  )
}
