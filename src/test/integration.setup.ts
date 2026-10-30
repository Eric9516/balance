/**
 * globalSetup de las pruebas de integración: crea la base de prueba si no existe,
 * aplica TODAS las migraciones desde cero (lo que además verifica que el historial
 * de migraciones esté completo) y deja la base sin estudios (cada estudio que crea una prueba
 * recibe el catálogo oficial de la RT 54).
 *
 * Sin TEST_DATABASE_URL levanta solo un PostgreSQL real embebido (ver postgres-embebido.ts):
 * no hace falta tener PostgreSQL instalado. Con TEST_DATABASE_URL usa esa base (por ejemplo,
 * el servicio de la CI); por seguridad, su nombre tiene que terminar en "_test".
 */
import { execSync } from 'node:child_process'
import { Client } from 'pg'
import { iniciarPostgresEmbebido, type PostgresEmbebido } from './postgres-embebido'

const PUERTO_EMBEBIDO = 55435

/**
 * Zona horaria por defecto del PostgreSQL embebido. A propósito NO es UTC: cada corrida comprueba
 * que la app fija UTC en sus sesiones y no depende de la configuración de la base (ver
 * src/lib/pool-pg.ts). Se cambia con TEST_PG_TIMEZONE para probar otras zonas.
 */
export const ZONA_HORARIA_PG_PRUEBAS =
  process.env.TEST_PG_TIMEZONE ?? 'America/Argentina/Buenos_Aires'

/** Misma URL que vitest.integration.config.mts inyecta a los workers. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://postgres:postgres@127.0.0.1:${PUERTO_EMBEBIDO}/balancert_test?schema=public`

export default async function setup() {
  const url = TEST_DATABASE_URL
  const parsed = new URL(url)
  const dbName = parsed.pathname.replace(/^\//, '')
  // Red de seguridad: el setup TRUNCA tablas; solo sobre una base de prueba.
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `La base de pruebas de integración debe terminar en "_test" (recibido: ${dbName})`,
    )
  }

  let embebido: PostgresEmbebido | null = null
  if (!process.env.TEST_DATABASE_URL) {
    embebido = await iniciarPostgresEmbebido({
      puerto: PUERTO_EMBEBIDO,
      base: dbName,
      prefijoCarpeta: 'balancert-test-',
      zonaHoraria: ZONA_HORARIA_PG_PRUEBAS,
    })
  } else {
    // 1. Crear la base si no existe (conectando a la base de mantenimiento "postgres").
    const admin = new Client({
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: 'postgres',
    })
    await admin.connect()
    const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`)
    await admin.end()
  }

  // 2. Migraciones desde cero (falla si el historial no está completo).
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  })

  // 3. Base limpia: los datos de corridas anteriores alterarían "el estudio activo". El catálogo
  //    de cada estudio se va con él; el oficial (catalogo_rubros) queda.
  //    Con una conexión propia, como dueño de la base: es tarea de la plataforma.
  const base = new Client({ connectionString: url })
  await base.connect()
  try {
    await base.query('TRUNCATE TABLE "estudios", "errores_tecnicos_log" CASCADE')
  } finally {
    await base.end()
  }

  return async () => {
    await embebido?.detener()
  }
}
