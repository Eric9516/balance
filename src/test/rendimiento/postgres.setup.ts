/**
 * globalSetup de la medición de rendimiento (`pnpm rendimiento`).
 *
 * Levanta un PostgreSQL REAL (ver postgres-embebido.ts), aplica TODAS las migraciones desde
 * cero (incluyen el catálogo oficial de la RT 54, que recibe cada estudio al crearse). Los datos
 * grandes los siembra la propia medición (ver datos-sinteticos.ts).
 *
 * Otra base: variable RENDIMIENTO_DATABASE_URL (por ejemplo, el servicio de PostgreSQL de la CI).
 * Por seguridad, su nombre tiene que terminar en "_rendimiento": la medición la llena de datos.
 */
import { execSync } from 'node:child_process'
import { Client } from 'pg'
import { iniciarPostgresEmbebido, type PostgresEmbebido } from '../postgres-embebido'

const PUERTO = 55433
const NOMBRE_BASE = 'balancert_rendimiento'

/** La base de la medición (conexión directa: siembra y planes de ejecución). */
export const RENDIMIENTO_DATABASE_URL =
  process.env.RENDIMIENTO_DATABASE_URL ??
  `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/${NOMBRE_BASE}?schema=public`

/** Puerto local del intermediario que simula la latencia de red (ver medir.ts). */
export const PUERTO_INTERMEDIARIO = 55434

/**
 * Lo que usa la app (DATABASE_URL de db.ts, inyectada por vitest.rendimiento.config.mts):
 * la misma base, pero a través del intermediario.
 */
export const URL_APP_RENDIMIENTO = (() => {
  const url = new URL(RENDIMIENTO_DATABASE_URL)
  url.hostname = '127.0.0.1'
  url.port = String(PUERTO_INTERMEDIARIO)
  return url.toString()
})()

export default async function setup() {
  const externa = Boolean(process.env.RENDIMIENTO_DATABASE_URL)
  const nombre = new URL(RENDIMIENTO_DATABASE_URL).pathname.replace(/^\//, '')
  if (!nombre.endsWith('_rendimiento')) {
    throw new Error(
      `La base de la medición debe terminar en "_rendimiento" (recibido: ${nombre}): la medición la llena de datos sintéticos.`,
    )
  }

  let embebido: PostgresEmbebido | null = null
  if (!externa) {
    embebido = await iniciarPostgresEmbebido({
      puerto: PUERTO,
      base: NOMBRE_BASE,
      prefijoCarpeta: 'balancert-rendimiento-',
    })
  } else {
    // Base externa: se recrea vacía para que la medición sea comparable entre corridas.
    const url = new URL(RENDIMIENTO_DATABASE_URL)
    const admin = new Client({
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: 'postgres',
    })
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`)
    await admin.query(`CREATE DATABASE "${nombre}"`)
    await admin.end()
  }

  // Migraciones desde cero: además verifica que el historial esté completo en esta versión de PostgreSQL.
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: RENDIMIENTO_DATABASE_URL },
  })

  return async () => {
    await embebido?.detener()
  }
}
