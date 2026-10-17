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
})

function cargarEnv() {
  const resultado = EnvSchema.safeParse(process.env)
  if (!resultado.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`)
  }
  return resultado.data
}

export const env = cargarEnv()
