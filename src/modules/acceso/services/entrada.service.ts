/**
 * Entrar, reconocer la sesión y salir. La cookie (paso 2) lleva un número al azar; la base guarda
 * solo su huella sha-256.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { RolUsuario } from '@prisma/client'
import { db } from '@/lib/db'
import { conEstudio } from '@/lib/contexto-base'
import type { AppError } from '@/modules/errores/types'
import {
  CONTRASENA_MAXIMO,
  CUENTA_DESACTIVADA,
  DATOS_INCORRECTOS,
  DEMASIADOS_INTENTOS,
  errorDeContrasena,
  normalizarEmail,
} from '../domain/reglas'
import { contrasenaCoincide, huellaDeContrasena } from '../infra/contrasenas'
import {
  abrirSesion,
  cerrarSesion,
  datosParaEntrar,
  fijarContrasena,
  puedeIntentar,
  registrarIntento,
  sesionActiva,
  type SesionActiva,
} from '../repository/acceso.repository'

export type PedidoDeEntrada = {
  email: string
  contrasena: string
  /** "Recordar este equipo": 30 días en vez de 8 horas sin uso. */
  recordar: boolean
  ip: string
  navegador: string
}

export type ResultadoEntrada =
  { ok: true; token: string; vence: Date } | { ok: false; error: AppError }

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/

function huellaDeToken(token: string): Uint8Array {
  return createHash('sha256').update(token).digest()
}

export async function entrar(pedido: PedidoDeEntrada): Promise<ResultadoEntrada> {
  const email = normalizarEmail(pedido.email)
  if (!email || !pedido.contrasena || pedido.contrasena.length > CONTRASENA_MAXIMO)
    return { ok: false, error: DATOS_INCORRECTOS }

  // Las dos lecturas en un solo viaje a la base
  const [permitido, cuenta] = await Promise.all([
    puedeIntentar(email, pedido.ip),
    datosParaEntrar(email),
  ])
  if (!permitido) return { ok: false, error: DEMASIADOS_INTENTOS }

  // Se compara siempre, exista o no la cuenta: tarda lo mismo
  const coincide = await contrasenaCoincide(cuenta?.huella, pedido.contrasena)
  if (!cuenta || !coincide) {
    await registrarIntento(email, pedido.ip, false)
    return { ok: false, error: DATOS_INCORRECTOS }
  }
  if (!cuenta.puedeEntrar) {
    await registrarIntento(email, pedido.ip, true)
    return { ok: false, error: CUENTA_DESACTIVADA }
  }

  const token = randomBytes(32).toString('base64url')
  const [, vence] = await Promise.all([
    registrarIntento(email, pedido.ip, true),
    abrirSesion(
      cuenta.usuarioId,
      huellaDeToken(token),
      pedido.recordar,
      pedido.ip,
      pedido.navegador,
    ),
  ])
  return { ok: true, token, vence }
}

/** De quién es el número de la cookie, o null si no es válido, venció o la cuenta se desactivó. */
export async function sesionDelToken(token: string | undefined): Promise<SesionActiva | null> {
  if (!token || !FORMATO_TOKEN.test(token)) return null
  return sesionActiva(huellaDeToken(token))
}

export async function salir(token: string | undefined): Promise<void> {
  if (token && FORMATO_TOKEN.test(token)) await cerrarSesion(huellaDeToken(token))
}

export type AltaDeUsuario = {
  estudioId: string
  email: string
  nombre: string
  rol: RolUsuario
  /** La genera el dueño o la plataforma: la persona la cambia al entrar. */
  contrasenaProvisoria: string
}

/** Da de alta a una persona en su estudio con una contraseña provisoria. */
export async function darDeAltaUsuario(
  alta: AltaDeUsuario,
): Promise<{ ok: true; usuarioId: string } | { ok: false; error: AppError }> {
  const problema = errorDeContrasena(alta.contrasenaProvisoria)
  if (problema)
    return {
      ok: false,
      error: { tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje: problema },
    }
  const huella = await huellaDeContrasena(alta.contrasenaProvisoria)
  const usuarioId = await conEstudio(alta.estudioId, () =>
    db.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          estudioId: alta.estudioId,
          email: normalizarEmail(alta.email),
          nombre: alta.nombre.trim(),
          rol: alta.rol,
        },
        select: { id: true },
      })
      await tx.$executeRaw`SELECT acceso.fijar_contrasena(${u.id}::uuid, ${huella}, true)`
      return u.id
    }),
  )
  return { ok: true, usuarioId }
}

/** Cambia la contraseña de la persona de la sesión (ya no es provisoria) y cierra sus sesiones. */
export async function cambiarContrasena(
  sesion: SesionActiva,
  nueva: string,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const problema = errorDeContrasena(nueva)
  if (problema)
    return {
      ok: false,
      error: { tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje: problema },
    }
  const huella = await huellaDeContrasena(nueva)
  await conEstudio(sesion.estudioId, () => fijarContrasena(sesion.usuarioId, huella, false))
  return { ok: true }
}
