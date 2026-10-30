/**
 * El esquema acceso (migración 20261030180000_login_propio): la app no lee sus tablas, solo llama
 * a estas funciones de la base.
 */
import type { RolUsuario } from '@prisma/client'
import { db } from '@/lib/db'

export type DatosParaEntrar = { usuarioId: string; huella: string | null; puedeEntrar: boolean }

export type SesionActiva = {
  usuarioId: string
  estudioId: string
  rol: RolUsuario
  contrasenaProvisoria: boolean
  /** La contraseña está bien pero falta el código del celular: todavía no ve ningún dato. */
  faltaCodigo: boolean
  codigoConfigurado: boolean
}

export type SesionAbierta = { vence: Date; faltaCodigo: boolean; codigoConfigurado: boolean }

export type CodigoDeLaSesion = {
  secreto: Uint8Array | null
  activado: boolean
  email: string
}

export async function datosParaEntrar(email: string): Promise<DatosParaEntrar | null> {
  const [fila] = await db.$queryRaw<
    { usuario_id: string; huella: string | null; puede_entrar: boolean }[]
  >`SELECT usuario_id, huella, puede_entrar FROM acceso.datos_para_entrar(${email})`
  return fila
    ? { usuarioId: fila.usuario_id, huella: fila.huella, puedeEntrar: fila.puede_entrar }
    : null
}

export async function puedeIntentar(email: string, ip: string): Promise<boolean> {
  const [fila] = await db.$queryRaw<{ ok: boolean }[]>`
    SELECT acceso.puede_intentar(${email}, ${ip}) AS ok`
  return fila?.ok === true
}

export async function registrarIntento(email: string, ip: string, ok: boolean): Promise<void> {
  await db.$executeRaw`SELECT acceso.registrar_intento(${email}, ${ip}, ${ok})`
}

export async function abrirSesion(
  usuarioId: string,
  huella: Uint8Array,
  recordar: boolean,
  ip: string,
  navegador: string,
): Promise<SesionAbierta> {
  const [fila] = await db.$queryRaw<
    { sesion_vence: Date; falta_codigo: boolean; codigo_configurado: boolean }[]
  >`SELECT sesion_vence, falta_codigo, codigo_configurado
      FROM acceso.abrir_sesion(${usuarioId}::uuid, ${huella}, ${recordar}, ${ip}, ${navegador})`
  if (!fila) throw new Error('La base no abrió la sesión.')
  return {
    vence: fila.sesion_vence,
    faltaCodigo: fila.falta_codigo,
    codigoConfigurado: fila.codigo_configurado,
  }
}

export async function sesionActiva(huella: Uint8Array): Promise<SesionActiva | null> {
  const [fila] = await db.$queryRaw<
    {
      usuario_id: string
      estudio_id: string
      rol: RolUsuario
      contrasena_provisoria: boolean
      falta_codigo: boolean
      codigo_configurado: boolean
    }[]
  >`SELECT usuario_id, estudio_id, rol::text AS rol, contrasena_provisoria, falta_codigo,
           codigo_configurado
      FROM acceso.sesion_activa(${huella})`
  return fila
    ? {
        usuarioId: fila.usuario_id,
        estudioId: fila.estudio_id,
        rol: fila.rol,
        contrasenaProvisoria: fila.contrasena_provisoria,
        faltaCodigo: fila.falta_codigo,
        codigoConfigurado: fila.codigo_configurado,
      }
    : null
}

export async function codigoDeLaSesion(huella: Uint8Array): Promise<CodigoDeLaSesion | null> {
  const [fila] = await db.$queryRaw<
    { secreto: Uint8Array | null; activado: boolean; email: string }[]
  >`SELECT secreto, activado, email FROM acceso.codigo_de_la_sesion(${huella})`
  return fila ? { secreto: fila.secreto, activado: fila.activado, email: fila.email } : null
}

export async function guardarCodigo(huella: Uint8Array, secretoCifrado: Uint8Array): Promise<void> {
  await db.$executeRaw`SELECT acceso.guardar_codigo(${huella}, ${secretoCifrado})`
}

/** El paso del código ya revisado; false si ese código (o uno anterior) ya se usó. */
export async function aceptarCodigo(huella: Uint8Array, paso: bigint): Promise<boolean> {
  const [fila] = await db.$queryRaw<{ ok: boolean }[]>`
    SELECT acceso.aceptar_codigo(${huella}, ${paso}) AS ok`
  return fila?.ok === true
}

/** Anota un código equivocado; false si la sesión se cerró (cinco seguidos). */
export async function codigoFallido(huella: Uint8Array): Promise<boolean> {
  const [fila] = await db.$queryRaw<{ sigue: boolean }[]>`
    SELECT acceso.codigo_fallido(${huella}) AS sigue`
  return fila?.sigue === true
}

export async function cerrarSesion(huella: Uint8Array): Promise<void> {
  await db.$executeRaw`SELECT acceso.cerrar_sesion(${huella})`
}

/**
 * La persona tiene que ser del estudio de la sesión (lo controla la base). Cierra sus sesiones,
 * salvo la que se pide mantener (la de quien la está cambiando).
 */
export async function fijarContrasena(
  usuarioId: string,
  huella: string,
  provisoria: boolean,
  mantener: Uint8Array | null = null,
): Promise<void> {
  await db.$executeRaw`
    SELECT acceso.fijar_contrasena(${usuarioId}::uuid, ${huella}, ${provisoria}, ${mantener})`
}
