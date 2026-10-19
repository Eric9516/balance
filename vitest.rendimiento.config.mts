import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { URL_APP_RENDIMIENTO } from './src/test/rendimiento/postgres.setup'

/**
 * Medición de rendimiento con PostgreSQL real y datos sintéticos grandes: `pnpm rendimiento`.
 * No corre con las pruebas comunes. Ver docs/RENDIMIENTO.md y docs/decisiones/0005.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.rendimiento.ts'],
    globalSetup: ['./src/test/rendimiento/postgres.setup.ts'],
    // La app (db.ts) se conecta a través del intermediario que simula la latencia de red,
    // y emite el evento "query" de Prisma para contar consultas.
    env: { DATABASE_URL: URL_APP_RENDIMIENTO, NODE_ENV: 'test', PRISMA_LOG_QUERIES: '1' },
    fileParallelism: false,
    testTimeout: 3 * 60 * 60_000,
    hookTimeout: 3 * 60 * 60_000,
  },
})
