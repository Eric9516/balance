import { cookies, headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { registrarContextoDelPedido, sinEstudio } from '@/lib/contexto-base'
import { COOKIE_SESION } from '@/lib/cookie-sesion'
import { sesionDelToken, type ResultadoEntrada } from '@/modules/acceso/services/entrada.service'
import type { SesionActiva } from '@/modules/acceso/repository/acceso.repository'

// La cookie de la sesión: un número al azar que la página no puede leer (httpOnly). La base guarda
// solo su huella (docs/decisiones/0013).

/** Lo que se registra de cada intento y de cada sesión. */
export async function datosDelPedido(): Promise<{ ip: string; navegador: string }> {
  const h = await headers()
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  return { ip, navegador: h.get('user-agent') ?? '' }
}

/**
 * Guarda la cookie. Con "recordar este equipo" vence con la sesión (30 días); si no, es de sesión
 * del navegador: al cerrarlo hay que volver a entrar, y la base además la corta a las 8 horas sin uso.
 */
export async function guardarCookieDeSesion(
  entrada: Extract<ResultadoEntrada, { ok: true }>,
  recordar: boolean,
): Promise<void> {
  ;(await cookies()).set(COOKIE_SESION, entrada.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(recordar ? { expires: entrada.vence } : {}),
  })
}

export async function tokenDeLaCookie(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESION)?.value
}

export async function borrarCookieDeSesion(): Promise<void> {
  ;(await cookies()).delete(COOKIE_SESION)
  olvidarSesiones()
}

// ─── La sesión de cada pedido ────────────────────────────────────────────────
// Se lee de la base una vez y se recuerda unos segundos por número de cookie: la piden la página, el
// pool (para saber el estudio de cada consulta) y las acciones. Desactivar una cuenta o salir se
// nota a lo sumo en ese tiempo.

const RECORDAR_MS = 2_000
const recientes = new Map<string, { hasta: number; sesion: Promise<SesionActiva | null> }>()

function olvidarSesiones(): void {
  recientes.clear()
}

/** Después de completar la sesión (el código del celular), que la próxima lectura vaya a la base. */
export function olvidarSesion(): void {
  olvidarSesiones()
}

function sesionRecordada(token: string | undefined): Promise<SesionActiva | null> {
  if (!token) return Promise.resolve(null)
  const ahora = Date.now()
  const guardada = recientes.get(token)
  if (guardada && guardada.hasta > ahora) return guardada.sesion
  if (recientes.size > 1_000) recientes.clear()
  // Sin estudio: la lectura de la sesión no puede depender de la sesión
  const sesion = sinEstudio(() => sesionDelToken(token)).catch((error: unknown) => {
    recientes.delete(token)
    throw error
  })
  recientes.set(token, { hasta: ahora + RECORDAR_MS, sesion })
  return sesion
}

const global_ = globalThis as typeof globalThis & {
  __sesionDePruebas?: () => Promise<SesionActiva | null>
}

/** La sesión de este pedido, o null. */
export const sesionActual = cache(async (): Promise<SesionActiva | null> =>
  global_.__sesionDePruebas
    ? global_.__sesionDePruebas()
    : sesionRecordada(await tokenDeLaCookie()),
)

/** Las pruebas, que no tienen pedido ni cookie, dicen qué sesión usar (src/test/contexto-pruebas.ts). */
export function sesionDePruebas(fn: () => Promise<SesionActiva | null>): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Solo en las pruebas.')
  global_.__sesionDePruebas = fn
}

/**
 * El estudio de cada consulta de un pedido sale de su sesión: sin sesión, ninguno (no se ve nada).
 * Fuera de un pedido (pruebas, comandos) no hay cookies: null, y decide contexto-base.ts.
 */
registrarContextoDelPedido(async () => {
  let token: string | undefined
  try {
    token = await tokenDeLaCookie()
  } catch (error) {
    // Las señales internas de Next (por ejemplo, al armar páginas) siguen su camino
    unstable_rethrow(error)
    return null
  }
  const sesion = await sesionRecordada(token)
  // A medio entrar (falta el código del celular): todavía no ve ningún dato
  return sesion && !sesion.faltaCodigo ? { estudioId: sesion.estudioId } : { sinEstudio: true }
})
