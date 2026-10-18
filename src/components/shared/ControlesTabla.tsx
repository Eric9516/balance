'use client'

import { useRouter } from 'next/navigation'
import { ChevronsLeftRight, ChevronsRightLeft, Rows3, Rows4 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGuardarAccion } from './useGuardarAccion'
import { usePreferencias } from './PreferenciasProvider'
import { guardarPreferenciasAction } from '@/modules/estudios/actions/preferencias.actions'

/**
 * Selector Cómoda / Compacta de las tablas de trabajo. La densidad es una
 * preferencia del estudio guardada en la base (EstudioConfiguracion.densidadTablas).
 */
export function ToggleDensidad({ className }: { className?: string }) {
  const { densidadTablas } = usePreferencias()
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()

  function elegir(valor: 'COMODA' | 'COMPACTA') {
    if (valor === densidadTablas) return
    ejecutar(
      () => guardarPreferenciasAction({ densidadTablas: valor }),
      () => router.refresh(),
    )
  }

  const opciones = [
    { valor: 'COMODA' as const, icono: Rows3, label: 'Cómoda' },
    { valor: 'COMPACTA' as const, icono: Rows4, label: 'Compacta' },
  ]

  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-md border border-linea bg-white p-0.5',
        isPending && 'opacity-60',
        className,
      )}
      role="radiogroup"
      aria-label="Densidad de la tabla"
    >
      {opciones.map((o) => {
        const activo = o.valor === densidadTablas
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => elegir(o.valor)}
            disabled={isPending}
            title={`Densidad ${o.label.toLowerCase()} (se guarda para todo el estudio)`}
            className={cn(
              'inline-flex h-full items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
              activo ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <o.icono className="h-3.5 w-3.5" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Botón "Solo totales / Ver detalle" para plegar o expandir todos los grupos de columnas. */
export function TogglePlegarTodos({
  todosPlegados,
  onPlegar,
  onExpandir,
  disabled = false,
}: {
  todosPlegados: boolean
  onPlegar: () => void
  onExpandir: () => void
  disabled?: boolean
}) {
  const Icono = todosPlegados ? ChevronsLeftRight : ChevronsRightLeft
  return (
    <button
      type="button"
      onClick={todosPlegados ? onExpandir : onPlegar}
      disabled={disabled}
      title={disabled ? 'En edición se muestran todas las columnas' : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-linea bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <Icono className="h-3.5 w-3.5" />
      {todosPlegados ? 'Ver detalle' : 'Solo totales'}
    </button>
  )
}
