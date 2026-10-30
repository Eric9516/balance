'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { AppError } from '@/modules/errores/types'
import { destinoSeguro } from '@/lib/cookie-sesion'
import {
  borrarCookieDeSesion,
  datosDelPedido,
  guardarCookieDeSesion,
  olvidarSesion,
  sesionActual,
  tokenDeLaCookie,
} from '@/lib/sesion'
import { CONTRASENA_MAXIMO } from '../domain/reglas'
import type { SesionActiva } from '../repository/acceso.repository'
import {
  cambiarContrasena,
  entrar,
  salir,
  sesionDelToken,
  verificarCodigo,
} from '../services/entrada.service'

export type EstadoFormulario = { error: AppError | null; email?: string }

/**
 * Adónde sigue quien acaba de entrar: lo que le falta, en orden (elegir su contraseña si es
 * provisoria, y el código del celular), y después la página que había pedido.
 */
function siguientePaso(sesion: SesionActiva | null, destino: string): string {
  const pagina = !sesion
    ? '/entrar'
    : sesion.contrasenaProvisoria
      ? '/entrar/nueva-contrasena'
      : sesion.faltaCodigo
        ? sesion.codigoConfigurado
          ? '/entrar/codigo'
          : '/entrar/configurar-codigo'
        : null
  if (!pagina) return destino
  return destino === '/' ? pagina : `${pagina}?volver=${encodeURIComponent(destino)}`
}

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
  redirect(siguientePaso(await sesionDelToken(r.token), destinoSeguro(volver)))
}

export async function salirAction(): Promise<void> {
  await salir(await tokenDeLaCookie())
  await borrarCookieDeSesion()
  redirect('/entrar?listo=salir')
}

const NuevaSchema = z.object({
  nueva: z.string().max(CONTRASENA_MAXIMO + 1),
  repetida: z.string().max(CONTRASENA_MAXIMO + 1),
  volver: z.string().max(500).optional(),
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
    volver: datos.get('volver') ?? undefined,
  })
  const error = (mensaje: string): EstadoFormulario => ({
    error: { tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje },
  })
  if (!leido.success) return error('Revisá la contraseña.')
  if (leido.data.nueva !== leido.data.repetida) return error('Las dos contraseñas no coinciden.')
  const r = await cambiarContrasena(sesion, leido.data.nueva, await tokenDeLaCookie())
  if (!r.ok) return { error: r.error }
  // Las sesiones de los otros equipos se cerraron; esta sigue (con el código del celular, si falta)
  olvidarSesion()
  redirect(
    siguientePaso(await sesionDelToken(await tokenDeLaCookie()), destinoSeguro(leido.data.volver)),
  )
}

const CodigoSchema = z.object({
  codigo: z.string().max(20),
  volver: z.string().max(500).optional(),
})

/** El código del celular: si está bien, la sesión se completa y sigue adonde iba. */
export async function codigoAction(
  _: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const leido = CodigoSchema.safeParse({
    codigo: datos.get('codigo') ?? '',
    volver: datos.get('volver') ?? undefined,
  })
  if (!leido.success)
    return {
      error: {
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Escribí las 6 cifras del código.',
      },
    }
  const r = await verificarCodigo(await tokenDeLaCookie(), leido.data.codigo)
  if (!r.ok) {
    if (r.sesionCerrada) {
      await borrarCookieDeSesion()
      redirect('/entrar?listo=codigo')
    }
    return { error: r.error }
  }
  olvidarSesion()
  redirect(destinoSeguro(leido.data.volver))
}
