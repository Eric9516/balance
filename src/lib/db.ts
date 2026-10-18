import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from './env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** Umbral a partir del cual una consulta se considera lenta en desarrollo. */
const UMBRAL_LENTA_MS = 50

function createClient() {
  // Pool explícito: tamaño acotado y timeouts para que un cuelgue sea un error
  // visible y no una espera infinita. application_name ayuda a identificar la app
  // en pg_stat_activity.
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: 'balancert',
  })

  const logQueries = env.PRISMA_LOG_QUERIES === '1' && env.NODE_ENV !== 'production'
  const client = new PrismaClient({
    adapter,
    log: logQueries
      ? [{ level: 'query', emit: 'event' }, 'warn', 'error']
      : env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  })

  if (logQueries) {
    client.$on('query', (e) => {
      if (e.duration >= UMBRAL_LENTA_MS) {
        console.warn(`[db lenta] ${e.duration}ms ${e.query}`)
      }
    })
  }

  return client
}

export const db = globalForPrisma.prisma ?? createClient()

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db
