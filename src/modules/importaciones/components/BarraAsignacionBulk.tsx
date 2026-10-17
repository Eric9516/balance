import type { RubroBaseSimple } from '../domain/types'

export function BarraAsignacionBulk({
  count,
  bulkRubroId,
  groups,
  isBulkPending,
  onChangeRubro,
  onAsignar,
  onCancelar,
}: {
  count: number
  bulkRubroId: string
  groups: [string, RubroBaseSimple[]][]
  isBulkPending: boolean
  onChangeRubro: (rubroId: string) => void
  onAsignar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-blue-100 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-xl items-center gap-4 px-8 py-3">
        <span className="min-w-max text-sm font-semibold text-blue-700">
          {count} {count === 1 ? 'cuenta seleccionada' : 'cuentas seleccionadas'}
        </span>
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-80">
            <select
              value={bulkRubroId}
              onChange={(e) => onChangeRubro(e.target.value)}
              className="w-full appearance-none rounded-md border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-sm text-slate-700"
            >
              <option value="">Seleccioná un rubro...</option>
              {groups.map(([label, groupRubros]) => (
                <optgroup key={label} label={label}>
                  {groupRubros.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <button
            onClick={onAsignar}
            disabled={!bulkRubroId || isBulkPending}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBulkPending ? 'Asignando...' : 'Asignar rubro'}
          </button>
        </div>
        <button
          onClick={onCancelar}
          className="text-sm text-slate-400 transition-colors hover:text-slate-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
