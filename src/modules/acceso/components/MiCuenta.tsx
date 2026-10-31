'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CONTRASENA_MINIMO } from '../domain/reglas'
import {
  cambiarMiContrasenaAction,
  cambiarMiNombreAction,
  cerrarOtrasSesionesAction,
  type EstadoMiContrasena,
} from '../actions/usuarios.actions'
import { CampoContrasena } from './CampoContrasena'

type Datos = {
  nombre: string
  email: string
  rol: string
  queHace: string
  quienLoCambia: string
  estudio: string
}

/** Tus datos: el nombre se cambia acá; el correo y el rol, el dueño del estudio. */
export function MisDatos({ datos }: { datos: Datos }) {
  const [nombre, setNombre] = useState(datos.nombre)
  const [guardando, startTransition] = useTransition()
  const cambio = nombre.trim() !== datos.nombre

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await cambiarMiNombreAction(nombre)
      if (r.ok) toastSuccess('Tu nombre quedó guardado')
      else toastError(r.error)
    })
  }

  return (
    <Card>
      <form onSubmit={guardar}>
        <CardHeader className="pb-3">
          <CardTitle>Tus datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="mi-nombre">Nombre y apellido</Label>
            <Input
              id="mi-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-slate-700">Correo</dt>
              <dd className="mt-1 text-sm text-slate-900">{datos.email}</dd>
              <dd className="mt-0.5 text-xs text-slate-500">Es con el que entrás.</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-700">Estudio</dt>
              <dd className="mt-1 text-sm text-slate-900">{datos.estudio}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-slate-700">Rol</dt>
              <dd className="mt-1 text-sm text-slate-900">{datos.rol}</dd>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {datos.queHace} {datos.quienLoCambia}
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={!cambio || guardando}>
            {guardando ? 'Guardando…' : 'Guardar nombre'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/** Cambiar la contraseña propia: pide la actual y cierra la sesión en los demás equipos. */
export function MiContrasena() {
  const [estado, accion, enviando] = useActionState<EstadoMiContrasena, FormData>(
    cambiarMiContrasenaAction,
    { error: null },
  )
  const formulario = useRef<HTMLFormElement>(null)
  const error = estado.error

  // Hecho el cambio, los campos quedan vacíos
  useEffect(() => {
    if (estado.listo) formulario.current?.reset()
  }, [estado])

  return (
    <Card>
      <form ref={formulario} action={accion} noValidate>
        <CardHeader className="pb-3">
          <CardTitle>Contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error.mensaje}
            </p>
          )}
          {estado.listo && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Listo: tu contraseña cambió. Se cerró tu sesión en los demás equipos.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="actual">Contraseña actual</Label>
            <CampoContrasena
              id="actual"
              name="actual"
              autoComplete="current-password"
              error={Boolean(error)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nueva">Contraseña nueva</Label>
              <CampoContrasena
                id="nueva"
                name="nueva"
                autoComplete="new-password"
                error={Boolean(error)}
                describedBy="pista-mi-nueva"
              />
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
          </div>
          <p id="pista-mi-nueva" className="text-xs leading-relaxed text-slate-500">
            Al menos {CONTRASENA_MINIMO} caracteres. Lo más seguro es una frase que puedas recordar,
            por ejemplo «el mate de las cinco».
          </p>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={enviando}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
              </>
            ) : (
              'Cambiar contraseña'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

/** Para quien entró desde otra computadora o un celular y no salió. */
export function OtrosEquipos() {
  const [enviando, startTransition] = useTransition()

  function cerrar() {
    startTransition(async () => {
      const r = await cerrarOtrasSesionesAction()
      if (r.ok) toastSuccess('Listo: se cerró tu sesión en los demás equipos')
      else toastError(r.error)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Otros equipos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          ¿Entraste desde otra computadora o un celular y no saliste? Cerrá la sesión ahí sin
          moverte de acá. En este equipo seguís adentro.
        </p>
        <Button variant="secondary" onClick={cerrar} disabled={enviando} className="shrink-0">
          <LogOut className="h-4 w-4" />
          {enviando ? 'Cerrando…' : 'Cerrar en los demás'}
        </Button>
      </CardContent>
    </Card>
  )
}
