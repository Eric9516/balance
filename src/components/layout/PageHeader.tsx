import React from 'react'
import { StepInfoButton } from '@/components/shared/StepInfoButton'
import { INFO_PANTALLAS, type ClavePantalla } from '@/modules/ayuda/domain/pantallas'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  /** Pantalla que explica el botón (i): su resumen y el enlace a la ayuda completa. */
  ayuda?: ClavePantalla
}

export function PageHeader({ title, description, action, ayuda }: PageHeaderProps) {
  const info = ayuda ? INFO_PANTALLAS[ayuda] : null
  return (
    <div className="flex items-start justify-between border-b border-linea bg-superficie px-8 py-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-tinta">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {(info || action) && (
        <div className="flex flex-shrink-0 items-center gap-2">
          {info && <StepInfoButton info={info.info} ayudaHref={`/ayuda#${info.articulo}`} />}
          {action}
        </div>
      )}
    </div>
  )
}
