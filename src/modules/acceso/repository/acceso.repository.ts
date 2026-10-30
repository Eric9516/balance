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
): Promise<Date> {
  const [fila] = await db.$queryRaw<{ vence: Date }[]>`
    SELECT acceso.abrir_sesion(${usuarioId}::uuid, ${huella}, ${recordar}, ${ip}, ${navegador}) AS vence`
  if (!fila) throw new Error('La base no abrió la sesión.')
  return fila.vence
}

export async function sesionActiva(huella: Uint8Array): Promise<SesionActiva | null> {
  const [fila] = await db.$queryRaw<
    { usuario_id: string; estudio_id: string; rol: RolUsuario; contrasena_provisoria: boolean }[]
  >`SELECT usuario_id, estudio_id, rol::text AS rol, contrasena_provisoria
      FROM acceso.sesion_activa(${huella})`
  return fila
    ? {
        usuarioId: fila.usuario_id,
        estudioId: fila.estudio_id,
        rol: fila.rol,
        contrasenaProvisoria: fila.contrasena_provisoria,
      }
    : null
}

export async function cerrarSesion(huella: Uint8Array): Promise<void> {
  await db.$executeRaw`SELECT acceso.cerrar_sesion(${huella})`
}

/** La persona tiene que ser del estudio de la sesión (lo controla la base). */
export async function fijarContrasena(
  usuarioId: string,
  huella: string,
  provisoria: boolean,
): Promise<void> {
  await db.$executeRaw`SELECT acceso.fijar_contrasena(${usuarioId}::uuid, ${huella}, ${provisoria})`
}
