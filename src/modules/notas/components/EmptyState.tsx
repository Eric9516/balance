import { FileText, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  onGenerar,
  isPending,
  tieneCuentasClasificadas,
}: {
  onGenerar: () => void
  isPending: boolean
  tieneCuentasClasificadas: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
      <FileText className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-700">No hay notas cargadas</p>
      <p className="mt-1 text-xs text-slate-400 max-w-xs">
        Generá las notas automáticamente desde las cuentas clasificadas, o agregá una nota manual.
      </p>
      {!tieneCuentasClasificadas && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Clasificá las cuentas primero para poder generar notas automáticas.
          </p>
        </div>
      )}
      {tieneCuentasClasificadas && (
        <Button className="mt-5" onClick={onGenerar} disabled={isPending}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isPending && 'animate-spin')} />
          {isPending ? 'Generando...' : 'Generar notas automáticas'}
        </Button>
      )}
    </div>
  )
}
