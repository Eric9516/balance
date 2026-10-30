'use client'

import { useActionState } from 'react'
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  nuevaContrasenaAction,
  salirAction,
  type EstadoFormulario,
} from '../actions/acceso.actions'
import { CONTRASENA_MINIMO } from '../domain/reglas'
import { CampoContrasena } from './CampoContrasena'

export function FormNuevaContrasena({ volver }: { volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(
    nuevaContrasenaAction,
    { error: null },
  )
  const error = estado.error

  return (
    <div className="rounded-xl border border-slate-200 bg-superficie p-6 shadow-sm sm:p-8">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <KeyRound className="h-5 w-5" />
      </div>
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
        Elegí tu contraseña
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        La que tenés es provisoria. Elegí una nueva para seguir.
      </p>

      {error && (
        <p
          id="error-nueva"
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
          <Label htmlFor="nueva">Contraseña nueva</Label>
          <CampoContrasena
            id="nueva"
            name="nueva"
            autoComplete="new-password"
            error={Boolean(error)}
            describedBy="pista-nueva"
          />
          <p id="pista-nueva" className="text-xs leading-relaxed text-slate-500">
            Al menos {CONTRASENA_MINIMO} caracteres. Lo más seguro es una frase que puedas recordar,
            por ejemplo «el mate de las cinco».
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="repetida">Repetila</Label>
          <CampoContrasena
            id="repetida"
            name="repetida"
            autoComplete="new-password"
            error={Boolean(error)}
          />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            'Guardar contraseña'
          )}
        </Button>
      </form>

      <form action={salirAction} className="mt-5 text-center">
        <button type="submit" className="text-sm text-slate-500 underline-offset-4 hover:underline">
          Salir sin cambiarla
        </button>
      </form>
    </div>
  )
}
