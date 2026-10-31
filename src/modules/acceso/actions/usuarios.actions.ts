'use server'

/**
 * Configuración → Usuarios (solo el dueño) y Mi cuenta (cada persona). Cada acción controla el
 * permiso al principio; la base lo controla también (migración 20261030235000_permisos_por_rol).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionError, actionOk, type ActionResult, type AppError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { exigirSesion, faltaPermiso } from '@/lib/estudio-context'
import { datosDelPedido, olvidarSesion, tokenDeLaCookie } from '@/lib/sesion'
import { esUuid } from '@/lib/utils/uuid'
import { CONTRASENA_MAXIMO } from '../domain/reglas'
import type { SesionActiva } from '../repository/acceso.repository'
import {
  activarUsuario,
  agregarUsuario,
  cambiarMiContrasena,
  cambiarMiNombre,
  cambiarRol,
  cerrarOtrasSesiones,
  eliminarUsuario,
  nuevaContrasenaProvisoria,
  quitarCodigoDelCelular,
} from '../services/usuarios.service'
import type { EstadoFormulario } from './acceso.actions'

const RolSchema = z.enum(['DUENO', 'CONTADOR', 'ASISTENTE'])

const AltaSchema = z.object({
  nombre: z.string().max(120),
  email: z.string().max(254),
  rol: RolSchema,
})

const USUARIO_NO_ENCONTRADO: AppError = {
  tipo: 'NEGOCIO',
  severidad: 'BAJO',
  codigo: 'NEG-063',
  mensaje: 'No se encontró esa persona en tu estudio. Recargá la página y volvé a intentar.',
}

const formulario = (mensaje: string): AppError => ({
  tipo: 'FORMULARIO',
  severidad: 'BAJO',
  codigo: 'FORM-001',
  mensaje,
})

/**
 * Lo común de las acciones del dueño sobre una persona: el permiso, el identificador y el error
 * explicado. La pantalla se vuelve a armar con los datos nuevos.
 */
type Tarea<T> = (sesion: SesionActiva) => Promise<ActionResult<T>>

async function sobreUnaPersona<T>(
  usuarioId: string,
  operacion: string,
  fn: Tarea<T>,
): Promise<ActionResult<T>> {
  if (!esUuid(usuarioId)) return actionError(USUARIO_NO_ENCONTRADO)
  return conPermiso(operacion, fn)
}

async function conPermiso<T>(operacion: string, fn: Tarea<T>): Promise<ActionResult<T>> {
  try {
    const sinPermiso = await faltaPermiso('gestionar_usuarios')
    if (sinPermiso) return actionError(sinPermiso)
    const r = await fn(await exigirSesion())
    if (r.ok) revalidatePath('/configuracion/usuarios')
    return r
  } catch (error) {
    const e = errorHandler(error, { modulo: 'usuarios', operacion })
    return actionError(e.codigo === 'TECH-002' ? USUARIO_NO_ENCONTRADO : e)
  }
}

export async function agregarUsuarioAction(input: {
  nombre: string
  email: string
  rol: string
}): Promise<ActionResult<{ contrasena: string }>> {
  const leido = AltaSchema.safeParse(input)
  if (!leido.success) return actionError(formulario('Revisá el nombre, el correo y el rol.'))
  return conPermiso('agregar', (sesion) => agregarUsuario(sesion, leido.data))
}

export async function cambiarRolAction(
  usuarioId: string,
  rol: string,
): Promise<ActionResult<void>> {
  const leido = RolSchema.safeParse(rol)
  if (!leido.success) return actionError(formulario('Elegí un rol.'))
  return sobreUnaPersona(usuarioId, 'cambiar rol', (sesion) =>
    cambiarRol(sesion, usuarioId, leido.data),
  )
}

export async function activarUsuarioAction(
  usuarioId: string,
  activo: boolean,
): Promise<ActionResult<void>> {
  return sobreUnaPersona(usuarioId, activo ? 'activar' : 'desactivar', (sesion) =>
    activarUsuario(sesion, usuarioId, activo === true),
  )
}

export async function eliminarUsuarioAction(usuarioId: string): Promise<ActionResult<void>> {
  return sobreUnaPersona(usuarioId, 'eliminar', (sesion) => eliminarUsuario(sesion, usuarioId))
}

export async function nuevaContrasenaAction(
  usuarioId: string,
): Promise<ActionResult<{ contrasena: string }>> {
  return sobreUnaPersona(usuarioId, 'contraseña provisoria', (sesion) =>
    nuevaContrasenaProvisoria(sesion, usuarioId),
  )
}

export async function quitarCodigoAction(usuarioId: string): Promise<ActionResult<void>> {
  return sobreUnaPersona(usuarioId, 'quitar código', (sesion) =>
    quitarCodigoDelCelular(sesion, usuarioId),
  )
}

// ─── Mi cuenta ───────────────────────────────────────────────────────────────

export async function cambiarMiNombreAction(nombre: string): Promise<ActionResult<void>> {
  try {
    const leido = z.string().max(200).safeParse(nombre)
    if (!leido.success) return actionError(formulario('Escribí tu nombre y apellido.'))
    const r = await cambiarMiNombre(await exigirSesion(), leido.data)
    if (r.ok) {
      olvidarSesion()
      revalidatePath('/', 'layout')
    }
    return r
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'mi cuenta', operacion: 'cambiar nombre' }))
  }
}

export type EstadoMiContrasena = EstadoFormulario & { listo?: boolean }

const MiContrasenaSchema = z.object({
  actual: z.string().max(CONTRASENA_MAXIMO + 1),
  nueva: z.string().max(CONTRASENA_MAXIMO + 1),
  repetida: z.string().max(CONTRASENA_MAXIMO + 1),
})

export async function cambiarMiContrasenaAction(
  _: EstadoMiContrasena,
  datos: FormData,
): Promise<EstadoMiContrasena> {
  try {
    const leido = MiContrasenaSchema.safeParse({
      actual: datos.get('actual') ?? '',
      nueva: datos.get('nueva') ?? '',
      repetida: datos.get('repetida') ?? '',
    })
    if (!leido.success) return { error: formulario('Revisá las contraseñas.') }
    const { actual, nueva, repetida } = leido.data
    if (!actual) return { error: formulario('Escribí tu contraseña actual.') }
    if (nueva !== repetida) return { error: formulario('Las dos contraseñas nuevas no coinciden.') }
    const r = await cambiarMiContrasena(await exigirSesion(), {
      actual,
      nueva,
      token: await tokenDeLaCookie(),
      ip: (await datosDelPedido()).ip,
    })
    if (!r.ok) return { error: r.error }
    olvidarSesion()
    return { error: null, listo: true }
  } catch (error) {
    return {
      error: errorHandler(error, { modulo: 'mi cuenta', operacion: 'cambiar contraseña' }),
    }
  }
}

export async function cerrarOtrasSesionesAction(): Promise<ActionResult<void>> {
  try {
    await exigirSesion()
    await cerrarOtrasSesiones(await tokenDeLaCookie())
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'mi cuenta', operacion: 'cerrar otras sesiones' }),
    )
  }
}
