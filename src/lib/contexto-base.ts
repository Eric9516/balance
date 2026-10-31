import { AsyncLocalStorage } from 'node:async_hooks'
import { esUuid } from './utils/uuid'

/**
 * Con qué permisos habla la app con la base en lo que se está ejecutando (docs/decisiones/0011):
 *
 * - Un estudio: la base solo deja ver y cambiar las filas de ese estudio (reglas por fila de la
 *   migración 20261030150000_separacion_por_estudio).
 * - La plataforma: sin reglas. Solo para lo que es de toda la plataforma a propósito (saber si ya
 *   hay estudios, preparar las pruebas). Nunca para atender a un usuario.
 * - Sin estudio: el rol de la app sin estudio. No se ve nada (por ejemplo, alguien sin sesión).
 *
 * Si nadie lo declaró, sale del pedido en curso: la app registra cómo leerlo de la sesión de la
 * cookie (src/lib/sesion.ts). Fuera de un pedido (pruebas, comandos), el de las pruebas o ninguno.
 *
 * pool-pg.ts lo pide al entregar cada conexión y se lo dice a la base.
 */
/** Quién usa la app dentro de su estudio: la base limita por rol (migración 20261030235000). */
export type Quien = { usuarioId: string; rol: 'DUENO' | 'CONTADOR' | 'ASISTENTE' }

export type ContextoBase =
  { estudioId: string; quien?: Quien } | { plataforma: true } | { sinEstudio: true }

/** Cómo sale el contexto del pedido en curso; null si no hay un pedido (pruebas, comandos). */
type ContextoDelPedido = () => Promise<ContextoBase | null>

// En globalThis: Next carga este módulo más de una vez (servidor, acciones) y todas las copias
// tienen que compartir el mismo contexto que lee el pool.
const global_ = globalThis as typeof globalThis & {
  __contextoBase?: AsyncLocalStorage<ContextoBase>
  __contextoBasePorDefecto?: ContextoBase
  __contextoDelPedido?: ContextoDelPedido
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

/**
 * Ejecuta `fn` con la base limitada al estudio y, si se dice quién es, a lo que su rol puede hacer.
 * Sin `quien` (tareas internas de la app), la base no limita por rol.
 */
export function conEstudio<T>(estudioId: string, fn: () => Promise<T>, quien?: Quien): Promise<T> {
  if (!esUuid(estudioId)) throw new Error('Identificador de estudio inválido.')
  if (quien && !esUuid(quien.usuarioId)) throw new Error('Identificador de usuario inválido.')
  return dentroDe({ estudioId, quien }, fn)
}

/** Ejecuta `fn` sin las reglas de los estudios. Solo para tareas de la plataforma. */
export function comoPlataforma<T>(fn: () => Promise<T>): Promise<T> {
  return dentroDe({ plataforma: true }, fn)
}

/** Ejecuta `fn` sin ningún estudio: la base no muestra nada (por ejemplo, para leer una sesión). */
export function sinEstudio<T>(fn: () => Promise<T>): Promise<T> {
  return dentroDe({ sinEstudio: true }, fn)
}

/** La app registra cómo sacar el contexto del pedido en curso (de su sesión). */
export function registrarContextoDelPedido(fn: ContextoDelPedido): void {
  global_.__contextoDelPedido = fn
}

/**
 * El contexto para la base: el declarado; si no, el del pedido en curso; si no, el de las pruebas.
 * Se llama sin esperar en el contexto de quien pide la conexión (el declarado y el pedido de Next se
 * leen ahí); sin nada, ninguno: la base no muestra nada.
 */
export async function contextoParaLaBase(): Promise<ContextoBase | null> {
  const declarado = almacen.getStore()
  if (declarado) return declarado
  const delPedido = global_.__contextoDelPedido ? await global_.__contextoDelPedido() : null
  return delPedido ?? global_.__contextoBasePorDefecto ?? null
}

/**
 * Las pruebas de integración preparan sus datos sin las reglas (cada archivo crea sus propios
 * estudios); la prueba de espionaje declara cada estudio a mano. Fuera de las pruebas, falla.
 */
export function plataformaPorDefectoEnPruebas(): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Solo en las pruebas.')
  global_.__contextoBasePorDefecto = { plataforma: true }
}
