'use client'

import Link from 'next/link'
import { Settings2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnexoTab = { slug: string; label: string; hasView: boolean }

/**
 * Contenedor de pestañas de Anexos. Las pestañas son los anexos ACEPTADOS en la
 * configuración. Un botón "Configuración" (a la derecha) abre la pantalla donde
 * se eligen qué anexos y notas van (antes era el paso "Anexos y notas").
 * Cada pestaña/botón es un link → el servidor sólo trae los datos de lo activo.
 */
export function AnexosTabs({
  tabs,
  active,
  configActivo,
  sugeridos = 0,
  basePath,
  children,
}: {
  tabs: AnexoTab[]
  active: string
  configActivo: boolean
  sugeridos?: number
  basePath: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {/* Barra: pestañas a la izquierda, Configuración a la derecha */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.length === 0 ? (
            <span className="px-1 py-2.5 text-sm text-slate-400">
              Todavía no elegiste anexos →
            </span>
          ) : (
            tabs.map((t) => {
              const activo = !configActivo && t.slug === active
              return (
                <Link
                  key={t.slug}
                  href={`${basePath}?paso=anexos&anexo=${t.slug}`}
                  className={cn(
                    '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                    activo
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                  )}
                >
                  {t.label}
                  {!t.hasView && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                      en construcción
                    </span>
                  )}
                </Link>
              )
            })
          )}
        </div>

        {/* Botón Configuración */}
        <Link
          href={`${basePath}?paso=anexos&anexo=configuracion`}
          className={cn(
            '-mb-px inline-flex flex-shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            configActivo
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
          )}
        >
          <Settings2 className="h-4 w-4" />
          Configuración
          {sugeridos > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {sugeridos}
            </span>
          )}
        </Link>
      </div>

      {/* Contenido activo (anexo o configuración) */}
      <div>{children}</div>
    </div>
  )
}

/** Placeholder para anexos aceptados que todavía no tienen pantalla construida. */
export function AnexoEnConstruccion({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/40 py-16 text-center">
      <Wrench className="mb-3 h-8 w-8 text-amber-400" />
      <p className="text-sm font-medium text-slate-700">
        El {label} todavía no tiene pantalla
      </p>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Lo aceptaste, así que va a figurar en el balance, pero la pantalla para cargar su detalle
        está pendiente de construir.
      </p>
    </div>
  )
}
