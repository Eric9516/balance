import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppError } from '@/modules/errores/types'

/** Lo que ve alguien que entra a una pantalla que su rol no usa (en vez de un error). */
export function SinPermiso({ error }: { error: AppError }) {
  return (
    <div className="flex justify-center px-8 py-16">
      <div className="max-w-md rounded-xl border border-slate-200 bg-superficie p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="font-serif text-xl font-semibold text-slate-900">No tenés permiso</h1>
        <p className="mt-2 text-sm text-slate-600">{error.mensaje}</p>
        <Button variant="secondary" size="sm" className="mt-6" asChild>
          <Link href="/sociedades">Volver a Sociedades</Link>
        </Button>
      </div>
    </div>
  )
}
