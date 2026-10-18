import { z } from 'zod'

/**
 * Variables de entorno del servidor, validadas una sola vez al arrancar.
 * Usar `env.X` en lugar de `process.env.X` para fallar temprano y con un mensaje claro.
 */
const EnvSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'Falta DATABASE_URL (ver .env.example)' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL debe ser una URL de PostgreSQL (postgresql://...)'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Conexiones máximas del pool de pg (Supabase session pooler: mantener bajo). */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  /** '1' = loguear en consola las consultas lentas (≥ 50 ms) en desarrollo. */
  PRISMA_LOG_QUERIES: z.enum(['0', '1']).default('0'),
})

function cargarEnv() {
  const resultado = EnvSchema.safeParse(process.env)
  if (!resultado.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`)
  }
  return resultado.data
}

export const env = cargarEnv()
