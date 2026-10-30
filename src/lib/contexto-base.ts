import { AsyncLocalStorage } from 'node:async_hooks'
import { esUuid } from './utils/uuid'

/**
 * Con qué permisos habla la app con la base en lo que se está ejecutando (docs/decisiones/0011):
 *
 * - Un estudio: la base solo deja ver y cambiar las filas de ese estudio (reglas por fila de la
 *   migración 20261030150000_separacion_por_estudio).
 * - La plataforma: sin reglas. Solo para lo que es de toda la plataforma a propósito (saber si ya
 *   hay estudios, preparar las pruebas). Nunca para atender a un usuario.
 * - Nada declarado: el rol de la app sin estudio. Si la base tiene un solo estudio, la base usa ese
 *   (mientras no haya login); si tiene más, no se ve nada.
 *
 * pool-pg.ts lo lee al entregar cada conexión y se lo dice a la base.
 */
export type ContextoBase = { estudioId: string } | { plataforma: true }

// En globalThis: Next carga este módulo más de una vez (servidor, acciones) y todas las copias
// tienen que compartir el mismo contexto que lee el pool.
const global_ = globalThis as typeof globalThis & {
  __contextoBase?: AsyncLocalStorage<ContextoBase>
  __contextoBasePorDefecto?: ContextoBase
}
const almacen = (global_.__contextoBase ??= new AsyncLocalStorage<ContextoBase>())

/**
 * Ejecuta `fn` dentro del contexto y espera su resultado ahí adentro: una consulta de Prisma no
 * arranca al escribirla sino cuando alguien espera su resultado. Si se esperara afuera, arrancaría
 * fuera del contexto y la base no sabría de qué estudio es.
 */
function dentroDe<T>(contexto: ContextoBase, fn: () => Promise<T>): Promise<T> {
  return almacen.run(contexto, async () => await fn())
}

/** Ejecuta `fn` con la base limitada al estudio. */
export function conEstudio<T>(estudioId: string, fn: () => Promise<T>): Promise<T> {
  if (!esUuid(estudioId)) throw new Error('Identificador de estudio inválido.')
  return dentroDe({ estudioId }, fn)
}

/** Ejecuta `fn` sin las reglas de los estudios. Solo para tareas de la plataforma. */
export function comoPlataforma<T>(fn: () => Promise<T>): Promise<T> {
  return dentroDe({ plataforma: true }, fn)
}

export function contextoActual(): ContextoBase | null {
  return almacen.getStore() ?? global_.__contextoBasePorDefecto ?? null
}

/**
 * Las pruebas de integración preparan sus datos sin las reglas (cada archivo crea sus propios
 * estudios); la prueba de espionaje declara cada estudio a mano. Fuera de las pruebas, falla.
 */
export function plataformaPorDefectoEnPruebas(): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Solo en las pruebas.')
  global_.__contextoBasePorDefecto = { plataforma: true }
}
