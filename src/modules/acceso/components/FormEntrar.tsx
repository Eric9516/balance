'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { entrarAction, type EstadoFormulario } from '../actions/acceso.actions'
import { CampoContrasena } from './CampoContrasena'

export function FormEntrar({ aviso, volver }: { aviso?: string; volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(entrarAction, {
    error: null,
  })
  const error = estado.error

  return (
    <div className="rounded-xl border border-slate-200 bg-superficie p-6 shadow-sm sm:p-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">Entrar</h1>
      <p className="mt-1.5 text-sm text-slate-500">Con el correo y la contraseña de tu estudio.</p>

      {aviso && !error && (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {aviso}
        </p>
      )}
      {error && (
        <p
          id="error-entrar"
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
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            autoFocus
            defaultValue={estado.email}
            error={Boolean(error)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'error-entrar' : undefined}
            className="h-11 text-[15px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contrasena">Contraseña</Label>
          <CampoContrasena
            id="contrasena"
            name="contrasena"
            autoComplete="current-password"
            error={Boolean(error)}
            describedBy={error ? 'error-entrar' : undefined}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <input
            type="checkbox"
            name="recordar"
            value="si"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--acento)]"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">Recordar este equipo</span>
            <span className="mt-0.5 block text-slate-500">
              La sesión dura 30 días en este equipo. No lo marques en uno compartido.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" className="h-11 w-full text-[15px]" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>

      <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-500">
        ¿Te olvidaste la contraseña? Pedile una provisoria al dueño de tu estudio.
      </p>
    </div>
  )
}
