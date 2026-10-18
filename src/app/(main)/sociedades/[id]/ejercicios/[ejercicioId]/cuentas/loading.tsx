// Esqueleto inmediato al navegar entre pasos: el encabezado y el stepper aparecen
// al instante mientras el servidor arma el contenido del paso.
export default function Loading() {
  return (
    <div>
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="px-8 py-6">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-4">
          <div className="flex items-start gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
          <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
