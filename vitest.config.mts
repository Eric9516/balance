import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Cobertura exigida donde vive la lógica contable, no en la UI.
      include: ['src/lib/**/*.ts', 'src/modules/**/domain/**/*.ts', 'src/modules/**/lib/**/*.ts'],
    },
  },
})
