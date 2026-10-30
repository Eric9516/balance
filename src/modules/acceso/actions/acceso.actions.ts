'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { AppError } from '@/modules/errores/types'
import { destinoSeguro } from '@/lib/cookie-sesion'
import {
  borrarCookieDeSesion,
  datosDelPedido,
  guardarCookieDeSesion,
  sesionActual,
  tokenDeLaCookie,
} from '@/lib/sesion'
import { CONTRASENA_MAXIMO } from '../domain/reglas'
import { cambiarContrasena, entrar, salir } from '../services/entrada.service'

export type EstadoFormulario = { error: AppError | null; email?: string }

const EntrarSchema = z.object({
  email: z.string().max(254),
  contrasena: z.string().max(CONTRASENA_MAXIMO + 1),
  recordar: z.literal('si').optional(),
  volver: z.string().max(500).optional(),
})

export async function entrarAction(
  _: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const leido = EntrarSchema.safeParse({
    email: datos.get('email') ?? '',
    contrasena: datos.get('contrasena') ?? '',
    recordar: datos.get('recordar') ?? undefined,
    volver: datos.get('volver') ?? undefined,
  })
  if (!leido.success)
    return {
      error: {
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Revisá el correo y la contraseña.',
      },
    }
  const { email, contrasena, volver } = leido.data
  const recordar = leido.data.recordar === 'si'
  const r = await entrar({ email, contrasena, recordar, ...(await datosDelPedido()) })
  if (!r.ok) return { error: r.error, email }
  await guardarCookieDeSesion(r, recordar)
  redirect(destinoSeguro(volver))
}

export async function salirAction(): Promise<void> {
  await salir(await tokenDeLaCookie())
  await borrarCookieDeSesion()
  redirect('/entrar?listo=salir')
}

const NuevaSchema = z.object({
  nueva: z.string().max(CONTRASENA_MAXIMO + 1),
  repetida: z.string().max(CONTRASENA_MAXIMO + 1),
})

export async function nuevaContrasenaAction(
  _: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  const leido = NuevaSchema.safeParse({
    nueva: datos.get('nueva') ?? '',
    repetida: datos.get('repetida') ?? '',
  })
  const error = (mensaje: string): EstadoFormulario => ({
    error: { tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje },
  })
  if (!leido.success) return error('Revisá la contraseña.')
  if (leido.data.nueva !== leido.data.repetida) return error('Las dos contraseñas no coinciden.')
  const r = await cambiarContrasena(sesion, leido.data.nueva)
  if (!r.ok) return { error: r.error }
  // Cambiarla cierra todas las sesiones: se vuelve a entrar con la nueva
  await borrarCookieDeSesion()
  redirect('/entrar?listo=contrasena')
}
