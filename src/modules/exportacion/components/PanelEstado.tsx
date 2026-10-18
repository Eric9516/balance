import { cn } from '@/lib/utils'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { DocumentoBalance } from '../domain/types'
import { BotonImprimir } from './BotonImprimir'

/** Barra de pantalla (no se imprime): estado del documento, avisos y botón de impresión. */
export function PanelEstado({ doc, volverHref }: { doc: DocumentoBalance; volverHref: string }) {
  const { borrador, advertencias, pendientes } = doc
  return (
    <aside
      className={cn(
        'no-imprimir mx-auto mb-5 w-[210mm] max-w-full rounded-xl border bg-superficie px-5 py-4 text-sm shadow-sm',
        borrador.es ? 'border-amber-300' : 'border-linea',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base font-semibold text-tinta">
            {borrador.es ? T.borrador.titulo : 'Vista para imprimir'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {borrador.es
              ? T.borrador.detalle
              : 'Usá "Imprimir / Guardar PDF" y elegí "Guardar como PDF" en el diálogo del navegador.'}
          </p>
          {borrador.es && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
              {borrador.motivos.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={volverHref}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Volver al ejercicio
          </a>
          <BotonImprimir />
        </div>
      </div>
      {(pendientes.length > 0 || advertencias.length > 0) && (
        <div className="mt-3 grid gap-3 border-t border-linea pt-3 text-xs text-slate-600 md:grid-cols-2">
          {pendientes.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700">Partes del juego todavía pendientes</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {pendientes.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {advertencias.length > 0 && (
            <div>
              <p className="font-semibold text-slate-700">Avisos</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
