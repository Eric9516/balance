import { AlertTriangle, Lock } from 'lucide-react'

/**
 * Avisos sobre el arrastre desde el ejercicio anterior (modo VINCULADO):
 * - `bloqueado`: leyenda fija que explica el candado.
 * - `advertencias`: fuentes faltantes en el anterior (filas que quedan editables).
 * Devuelve null si no hay nada que mostrar.
 */
export function AvisosArrastre({
  bloqueado,
  origen,
  advertencias = [],
}: {
  bloqueado?: boolean
  origen?: string | null
  advertencias?: string[]
}) {
  if (!bloqueado && advertencias.length === 0) return null
  return (
    <div className="space-y-2">
      {bloqueado && (
        <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
          <Lock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
          Los importes con candado vienen de {origen ?? 'el ejercicio anterior vinculado'} y no se
          editan acá.
        </p>
      )}
      {advertencias.map((a) => (
        <p
          key={a}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          {a}
        </p>
      ))}
    </div>
  )
}
