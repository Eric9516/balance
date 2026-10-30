import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './src/test/integration.setup'

/**
 * Pruebas de integración contra un PostgreSQL real (base `balancert_test`).
 * Se corren aparte de las unitarias: `pnpm test:int`.
 * Requiere un servidor local; la base se crea/migra/siembra en el globalSetup.
 * Otra base: variable TEST_DATABASE_URL (debe terminar en "_test").
 */

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    globalSetup: ['./src/test/integration.setup.ts'],
    setupFiles: ['./src/test/contexto-pruebas.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: 'test',
      // Clave de pruebas para el código del celular (la de producción va solo en su .env)
      CLAVE_CODIGOS: 'cHJ1ZWJhcy1iYWxhbmNlcnQtY29kaWdvcy0zMmJ5dGU=',
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
