'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CeldaNumero } from './CeldaNumero'

/**
 * Celda de número BLOQUEADA: el valor viene del ejercicio anterior (modo VINCULADO)
 * y no se edita acá. Muestra candado + valor formateado y explica el origen al pasar
 * el mouse. Única forma de mostrar un importe arrastrado; no inventar otras.
 * El padre la envuelve en su <td>.
 */
export function CeldaBloqueada({
  value,
  origen,
  dense = false,
  negativo = false,
  decimales = 2,
  className,
}: {
  value: number
  /** Nombre del ejercicio de origen (ej. "Ejercicio al 31/12/2024"). */
  origen?: string | null
  dense?: boolean
  negativo?: boolean
  decimales?: number
  className?: string
}) {
  const titulo = origen
    ? `Tomado de ${origen}. Para cambiarlo, corregí ese ejercicio.`
    : 'Tomado del ejercicio anterior vinculado. Para cambiarlo, corregí ese ejercicio.'
  return (
    <span
      className={cn('flex items-center justify-end gap-1', className)}
      title={titulo}
      aria-label={titulo}
    >
      <Lock className="h-3 w-3 flex-shrink-0 text-slate-400" />
      <CeldaNumero
        value={value}
        editando={false}
        soloLectura
        onSave={() => {}}
        dense={dense}
        negativo={negativo}
        decimales={decimales}
        className="text-slate-600"
      />
    </span>
  )
}
