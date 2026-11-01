'use client'

import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'

/**
 * Anterior manual ya ajustado: el botón y la columna con lo que se había cargado, sin ajustar. Es
 * solo para ver en pantalla: la columna nunca sale en el documento.
 */
export function BotonVerCargado({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const Icono = visible ? EyeOff : Eye
  return (
    <Button
      variant="secondary"
      size="sm"
      className="shrink-0 whitespace-nowrap"
      onClick={onToggle}
      aria-pressed={visible}
    >
      <Icono className="h-3.5 w-3.5" />
      {visible ? 'Ocultar lo cargado' : 'Ver lo cargado'}
    </Button>
  )
}

export function ThCargado({ className }: { className?: string }) {
  return (
    <th
      className={cn(
        'bg-slate-100 px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500',
        className,
      )}
      title="Lo que se escribió, antes de ajustar por inflación. No sale en el balance."
    >
      <div>Lo cargado</div>
      <div className="font-normal normal-case">sin ajustar</div>
    </th>
  )
}

export function TdCargado({
  valor,
  fuerte = false,
  oscuro = false,
  className,
}: {
  /** null: una fila sin importe en esta columna. */
  valor: number | null
  fuerte?: boolean
  /** Fila de total con fondo oscuro. */
  oscuro?: boolean
  className?: string
}) {
  return (
    <td
      className={cn(
        'px-4 py-2 text-right font-mono text-sm tabular-nums',
        oscuro ? 'text-slate-300' : 'bg-slate-50 text-slate-500',
        fuerte && 'font-semibold',
        className,
      )}
    >
      {valor === null ? null : formatCurrency(valor)}
    </td>
  )
}
