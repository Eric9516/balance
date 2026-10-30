'use client'

import { useActionState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { codigoAction, salirAction, type EstadoFormulario } from '../actions/acceso.actions'

/** Las 6 cifras de la app del celular. */
export function FormCodigo({ volver, boton }: { volver?: string; boton: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(codigoAction, {
    error: null,
  })
  const error = estado.error

  return (
    <>
      {error && (
        <p
          id="error-codigo"
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error.mensaje}
        </p>
      )}
      <form action={accion} className="mt-6 space-y-5" noValidate>
        {volver && <input type="hidden" name="volver" value={volver} />}
        <div className="space-y-2">
          <Label htmlFor="codigo">Código de 6 cifras</Label>
          <Input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            placeholder="123 456"
            error={Boolean(error)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'error-codigo' : undefined}
            className="h-12 text-center font-mono text-xl tracking-[0.3em]"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando…
            </>
          ) : (
            boton
          )}
        </Button>
      </form>
      <form action={salirAction} className="mt-5 text-center">
        <button type="submit" className="text-sm text-slate-500 underline-offset-4 hover:underline">
          Usar otra cuenta
        </button>
      </form>
    </>
  )
}
