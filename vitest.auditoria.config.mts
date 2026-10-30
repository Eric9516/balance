import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './src/test/integration.setup'

/**
 * Auditoría completa (`pnpm auditoria`): un contador simulado hace los balances de referencia de
 * punta a punta y deja un informe en auditoria/informes/. Misma base embebida que las pruebas de
 * integración (se crea, migra y siembra en el globalSetup): nunca toca producción.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/test/auditoria/**/*.auditoria.ts'],
    globalSetup: ['./src/test/integration.setup.ts'],
    setupFiles: ['./src/test/contexto-pruebas.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: 'test',
      // Clave de pruebas para el código del celular (la de producción va solo en su .env)
      CLAVE_CODIGOS: 'cHJ1ZWJhcy1iYWxhbmNlcnQtY29kaWdvcy0zMmJ5dGU=',
    },
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
})
