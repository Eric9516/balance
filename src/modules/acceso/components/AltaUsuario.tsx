'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, UserPlus } from 'lucide-react'
import type { RolUsuario } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialogo } from '@/components/shared/Dialogo'
import { cn } from '@/lib/utils'
import type { AppError } from '@/modules/errores/types'
import { NOMBRE_DEL_ROL, QUE_HACE_EL_ROL } from '../domain/permisos'
import { agregarUsuarioAction } from '../actions/usuarios.actions'
import { ContrasenaParaPasar, type ParaPasar } from './ContrasenaParaPasar'

const ROLES: RolUsuario[] = ['ASISTENTE', 'CONTADOR', 'DUENO']

/** Botón "Agregar persona": pide nombre, correo y rol, y muestra la contraseña provisoria. */
export function AltaUsuario() {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolUsuario>('ASISTENTE')
  const [error, setError] = useState<AppError | null>(null)
  const [paraPasar, setParaPasar] = useState<ParaPasar | null>(null)
  const [enviando, startTransition] = useTransition()

  function abrir() {
    setNombre('')
    setEmail('')
    setRol('ASISTENTE')
    setError(null)
    setAbierto(true)
  }

  function agregar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await agregarUsuarioAction({ nombre, email, rol })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setAbierto(false)
      setParaPasar({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        contrasena: r.data.contrasena,
        nueva: true,
      })
    })
  }

  return (
    <>
      <Button onClick={abrir}>
        <UserPlus className="h-4 w-4" />
        Agregar persona
      </Button>

      <Dialogo
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Agregar a una persona del estudio"
        bloqueado={enviando}
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" form="alta-usuario" disabled={enviando}>
              {enviando ? 'Agregando…' : 'Agregar'}
            </Button>
          </>
        }
      >
        <form id="alta-usuario" onSubmit={agregar} className="space-y-4" noValidate>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error.mensaje}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="alta-nombre">Nombre y apellido</Label>
            <Input
              id="alta-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alta-email">Correo</Label>
            <Input
              id="alta-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              autoComplete="off"
            />
            <p className="text-xs text-slate-500">Es con el que va a entrar a la app.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Rol</legend>
            {ROLES.map((r) => (
              <label
                key={r}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                  rol === r
                    ? 'border-blue-300 bg-blue-50/60 ring-1 ring-blue-200'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input
                  type="radio"
                  name="rol"
                  value={r}
                  checked={rol === r}
                  onChange={() => setRol(r)}
                  className="mt-0.5 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    {NOMBRE_DEL_ROL[r]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {QUE_HACE_EL_ROL[r]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </form>
      </Dialogo>

      <ContrasenaParaPasar datos={paraPasar} onClose={() => setParaPasar(null)} />
    </>
  )
}
