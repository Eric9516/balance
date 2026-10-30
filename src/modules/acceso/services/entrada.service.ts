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
import { base32, direccionOtpauth, pasoDelCodigo } from '../domain/codigo'
import { cifrar, descifrar } from '../infra/cifrado'
import { contrasenaCoincide, huellaDeContrasena } from '../infra/contrasenas'
import {
  abrirSesion,
  aceptarCodigo,
  cerrarSesion,
  codigoDeLaSesion,
  codigoFallido,
  datosParaEntrar,
  fijarContrasena,
  guardarCodigo,
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
  | {
      ok: true
      token: string
      vence: Date
      /** Usa código del celular: la sesión queda a medio entrar hasta que lo escriba. */
      faltaCodigo: boolean
      codigoConfigurado: boolean
    }
  | { ok: false; error: AppError }

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
  const [, sesion] = await Promise.all([
    registrarIntento(email, pedido.ip, true),
    abrirSesion(
      cuenta.usuarioId,
      huellaDeToken(token),
      pedido.recordar,
      pedido.ip,
      pedido.navegador,
    ),
  ])
  return { ok: true, token, ...sesion }
}

// ─── El código del celular ───────────────────────────────────────────────────

export const CODIGO_INCORRECTO: AppError = {
  tipo: 'AUTORIZACION',
  severidad: 'MEDIO',
  codigo: 'AUTH-005',
  mensaje: 'El código no es correcto o ya se usó. Escribí el que muestra ahora la app del celular.',
}

export const CODIGO_DEMASIADOS: AppError = {
  tipo: 'AUTORIZACION',
  severidad: 'MEDIO',
  codigo: 'AUTH-006',
  mensaje: 'Cinco códigos equivocados seguidos: por seguridad, volvé a entrar con tu contraseña.',
}

export type CodigoParaConfigurar = {
  /** Lo que lee la app del celular en el QR. */
  direccion: string
  /** El mismo secreto para escribirlo a mano, en grupos de 4. */
  claveManual: string
}

/**
 * La primera vez: genera el secreto (o reusa el que quedó a medio configurar), lo guarda cifrado y
 * devuelve lo que hay que mostrar para cargarlo en el celular. null si la sesión venció o si ya
 * tiene un código activado.
 */
export async function prepararCodigo(
  token: string | undefined,
): Promise<CodigoParaConfigurar | null> {
  if (!token || !FORMATO_TOKEN.test(token)) return null
  const huella = huellaDeToken(token)
  const actual = await codigoDeLaSesion(huella)
  if (!actual || actual.activado) return null
  let secreto = actual.secreto ? descifrar(actual.secreto) : null
  if (!secreto) {
    secreto = randomBytes(20)
    await guardarCodigo(huella, cifrar(secreto))
  }
  return {
    direccion: direccionOtpauth(secreto, actual.email),
    claveManual: base32(secreto)
      .replace(/(.{4})/g, '$1 ')
      .trim(),
  }
}

/** Revisa el código que escribió la persona y, si está bien, completa la sesión. */
export async function verificarCodigo(
  token: string | undefined,
  codigo: string,
  ahoraMs = Date.now(),
): Promise<{ ok: true } | { ok: false; error: AppError; sesionCerrada: boolean }> {
  if (!token || !FORMATO_TOKEN.test(token))
    return { ok: false, error: CODIGO_DEMASIADOS, sesionCerrada: true }
  const huella = huellaDeToken(token)
  const actual = await codigoDeLaSesion(huella)
  if (!actual?.secreto) return { ok: false, error: CODIGO_DEMASIADOS, sesionCerrada: true }
  const paso = pasoDelCodigo(descifrar(actual.secreto), codigo, ahoraMs)
  if (paso !== null && (await aceptarCodigo(huella, paso))) return { ok: true }
  const sigue = await codigoFallido(huella)
  return sigue
    ? { ok: false, error: CODIGO_INCORRECTO, sesionCerrada: false }
    : { ok: false, error: CODIGO_DEMASIADOS, sesionCerrada: true }
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

/**
 * Cambia la contraseña de la persona de la sesión (ya no es provisoria). Cierra sus sesiones en los
 * otros equipos; la de este (su token) sigue.
 */
export async function cambiarContrasena(
  sesion: SesionActiva,
  nueva: string,
  tokenActual?: string,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  const problema = errorDeContrasena(nueva)
  if (problema)
    return {
      ok: false,
      error: { tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje: problema },
    }
  const huella = await huellaDeContrasena(nueva)
  const mantener =
    tokenActual && FORMATO_TOKEN.test(tokenActual) ? huellaDeToken(tokenActual) : null
  await conEstudio(sesion.estudioId, () =>
    fijarContrasena(sesion.usuarioId, huella, false, mantener),
  )
  return { ok: true }
}
