/**
 * La gente del estudio (Configuración → Usuarios, solo el dueño) y la cuenta propia (Mi cuenta).
 * Reglas de Gestión empresarial (web/db/03-usuarios.sql): nadie se elimina, se desactiva ni se
 * cambia el rol a sí mismo; a un dueño no se lo elimina (primero se le cambia el rol); cambiar la
 * contraseña propia pide la actual y cuenta como un intento de entrar. La base lo controla también
 * (migración 20261030235000_permisos_por_rol).
 */
import { createHash, randomInt } from 'node:crypto'
import type { RolUsuario } from '@prisma/client'
import { db } from '@/lib/db'
import { conEstudio, type Quien } from '@/lib/contexto-base'
import type { AppError } from '@/modules/errores/types'
import { DATOS_INCORRECTOS, DEMASIADOS_INTENTOS, normalizarEmail } from '../domain/reglas'
import { contrasenaCoincide, huellaDeContrasena } from '../infra/contrasenas'
import {
  datosParaEntrar,
  fijarContrasena,
  puedeIntentar,
  registrarIntento,
  type SesionActiva,
} from '../repository/acceso.repository'
import { cambiarContrasena, darDeAltaUsuario } from './entrada.service'

export type UsuarioDelEstudio = {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
  ultimoIngreso: Date | null
  contrasenaProvisoria: boolean
  codigoActivado: boolean
  esVos: boolean
}

type Resultado<T = void> = { ok: true; data: T } | { ok: false; error: AppError }

const quienEs = (sesion: SesionActiva): Quien => ({ usuarioId: sesion.usuarioId, rol: sesion.rol })
const enSuEstudio = <T>(sesion: SesionActiva, fn: () => Promise<T>) =>
  conEstudio(sesion.estudioId, fn, quienEs(sesion))

function error(mensaje: string, codigo = 'FORM-001'): { ok: false; error: AppError } {
  return {
    ok: false,
    error: {
      tipo: codigo === 'FORM-001' ? 'FORMULARIO' : 'NEGOCIO',
      severidad: 'BAJO',
      codigo,
      mensaje,
    },
  }
}

const ROLES: readonly RolUsuario[] = ['DUENO', 'CONTADOR', 'ASISTENTE']
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contraseña provisoria fácil de dictar: 3 grupos de 4, sin las letras y números que se confunden
 * (l, 1, o, 0, i). 14 caracteres: la persona la cambia al entrar.
 */
export function contrasenaProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  const grupo = () => Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join('')
  return `${grupo()}-${grupo()}-${grupo()}`
}

export async function listarUsuarios(sesion: SesionActiva): Promise<UsuarioDelEstudio[]> {
  return enSuEstudio(sesion, async () => {
    const [usuarios, estados] = await Promise.all([
      db.usuario.findMany({
        where: { estudioId: sesion.estudioId },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true,
          activo: true,
          ultimoIngreso: true,
        },
      }),
      db.$queryRaw<
        { usuario_id: string; contrasena_provisoria: boolean; codigo_activado: boolean }[]
      >`SELECT usuario_id, contrasena_provisoria, codigo_activado FROM acceso.estado_de_usuarios()`,
    ])
    const estadoDe = new Map(estados.map((e) => [e.usuario_id, e]))
    return usuarios.map((u) => ({
      ...u,
      contrasenaProvisoria: estadoDe.get(u.id)?.contrasena_provisoria ?? true,
      codigoActivado: estadoDe.get(u.id)?.codigo_activado ?? false,
      esVos: u.id === sesion.usuarioId,
    }))
  })
}

/** Da de alta a una persona con una contraseña provisoria, que se muestra una sola vez. */
export async function agregarUsuario(
  sesion: SesionActiva,
  datos: { nombre: string; email: string; rol: RolUsuario },
): Promise<Resultado<{ contrasena: string }>> {
  const nombre = datos.nombre.trim()
  const email = normalizarEmail(datos.email)
  if (!nombre || nombre.length > 120) return error('Escribí el nombre y apellido.')
  if (!FORMATO_EMAIL.test(email) || email.length > 254) return error('El correo no parece válido.')
  if (!ROLES.includes(datos.rol)) return error('Elegí un rol.')
  // El correo es único en toda la plataforma: se pregunta sin ver los datos de otros estudios
  if (await datosParaEntrar(email))
    return error('Ya hay una cuenta con ese correo. Cada correo es de un solo estudio.')
  const contrasena = contrasenaProvisoria()
  const r = await darDeAltaUsuario(
    {
      estudioId: sesion.estudioId,
      email,
      nombre,
      rol: datos.rol,
      contrasenaProvisoria: contrasena,
    },
    quienEs(sesion),
  )
  return r.ok ? { ok: true, data: { contrasena } } : r
}

function sobreSiMismo(
  sesion: SesionActiva,
  usuarioId: string,
): { ok: false; error: AppError } | null {
  return usuarioId === sesion.usuarioId
    ? error(
        'No podés cambiar tu propio rol, desactivarte ni eliminarte: lo hace otro dueño.',
        'NEG-063',
      )
    : null
}

export async function cambiarRol(
  sesion: SesionActiva,
  usuarioId: string,
  rol: RolUsuario,
): Promise<Resultado> {
  if (!ROLES.includes(rol)) return error('Elegí un rol.')
  const propio = sobreSiMismo(sesion, usuarioId)
  if (propio) return propio
  await enSuEstudio(sesion, () => db.usuario.update({ where: { id: usuarioId }, data: { rol } }))
  return { ok: true, data: undefined }
}

/** Desactivar corta sus sesiones al instante: la base no deja entrar a una cuenta desactivada. */
export async function activarUsuario(
  sesion: SesionActiva,
  usuarioId: string,
  activo: boolean,
): Promise<Resultado> {
  const propio = sobreSiMismo(sesion, usuarioId)
  if (propio) return propio
  await enSuEstudio(sesion, () => db.usuario.update({ where: { id: usuarioId }, data: { activo } }))
  return { ok: true, data: undefined }
}

export async function eliminarUsuario(sesion: SesionActiva, usuarioId: string): Promise<Resultado> {
  const propio = sobreSiMismo(sesion, usuarioId)
  if (propio) return propio
  await enSuEstudio(sesion, () => db.usuario.delete({ where: { id: usuarioId } }))
  return { ok: true, data: undefined }
}

/** Una contraseña provisoria nueva para quien se olvidó la suya; cierra sus sesiones. */
export async function nuevaContrasenaProvisoria(
  sesion: SesionActiva,
  usuarioId: string,
): Promise<Resultado<{ contrasena: string }>> {
  if (usuarioId === sesion.usuarioId)
    return error('Tu contraseña la cambiás en Mi cuenta.', 'NEG-063')
  const contrasena = contrasenaProvisoria()
  const huella = await huellaDeContrasena(contrasena)
  await enSuEstudio(sesion, () => fijarContrasena(usuarioId, huella, true))
  return { ok: true, data: { contrasena } }
}

/** A quien perdió el celular: lo configura de nuevo la próxima vez que entra. */
export async function quitarCodigoDelCelular(
  sesion: SesionActiva,
  usuarioId: string,
): Promise<Resultado> {
  await enSuEstudio(sesion, () => db.$executeRaw`SELECT acceso.quitar_codigo(${usuarioId}::uuid)`)
  return { ok: true, data: undefined }
}

// ─── Mi cuenta ───────────────────────────────────────────────────────────────

export async function miCuenta(sesion: SesionActiva) {
  return enSuEstudio(sesion, () =>
    db.usuario.findUniqueOrThrow({
      where: { id: sesion.usuarioId },
      select: { nombre: true, email: true, rol: true, estudio: { select: { nombre: true } } },
    }),
  )
}

export async function cambiarMiNombre(sesion: SesionActiva, nombre: string): Promise<Resultado> {
  const limpio = nombre.trim()
  if (!limpio || limpio.length > 120)
    return error('Escribí tu nombre y apellido (hasta 120 letras).')
  await enSuEstudio(sesion, () =>
    db.usuario.update({ where: { id: sesion.usuarioId }, data: { nombre: limpio } }),
  )
  return { ok: true, data: undefined }
}

/**
 * Cambia la contraseña propia: primero comprueba la actual (si alguien deja la computadora abierta,
 * no puede cambiarla) y cuenta como un intento de entrar, con el mismo freno. Las sesiones de los
 * otros equipos se cierran; la de este sigue.
 */
export async function cambiarMiContrasena(
  sesion: SesionActiva,
  pedido: { actual: string; nueva: string; token: string | undefined; ip: string },
): Promise<Resultado> {
  const { email } = await miCuenta(sesion)
  if (!(await puedeIntentar(email, pedido.ip))) return { ok: false, error: DEMASIADOS_INTENTOS }
  const cuenta = await datosParaEntrar(email)
  const coincide =
    cuenta?.usuarioId === sesion.usuarioId &&
    (await contrasenaCoincide(cuenta.huella, pedido.actual))
  await registrarIntento(email, pedido.ip, coincide)
  if (!coincide)
    return {
      ok: false,
      error: { ...DATOS_INCORRECTOS, mensaje: 'La contraseña actual no es correcta.' },
    }
  const r = await cambiarContrasena(sesion, pedido.nueva, pedido.token)
  return r.ok ? { ok: true, data: undefined } : r
}

/** Cierra la sesión en los demás equipos (la de este queda abierta). */
export async function cerrarOtrasSesiones(token: string | undefined): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return
  const huella = createHash('sha256').update(token).digest()
  await db.$executeRaw`SELECT acceso.cerrar_otras_sesiones(${huella})`
}
