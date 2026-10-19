/**
 * PostgreSQL REAL para pruebas y mediciones, sin instalar nada: embedded-postgres baja el
 * programa como paquete de npm (misma versión mayor que producción), lo arranca en una carpeta
 * temporal y lo apaga al terminar. Lo usan las pruebas de integración y la medición de rendimiento.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

export type PostgresEmbebido = { detener: () => Promise<void> }

/**
 * Arranca un servidor en `puerto` (usuario y clave "postgres") y crea la base `base`.
 * `zonaHoraria` es la zona por defecto de las sesiones del servidor: las pruebas usan a propósito
 * una distinta de UTC para comprobar que la app no depende de ella (ver src/lib/pool-pg.ts).
 */
export async function iniciarPostgresEmbebido(opciones: {
  puerto: number
  base: string
  prefijoCarpeta: string
  zonaHoraria?: string
}): Promise<PostgresEmbebido> {
  const carpeta = mkdtempSync(join(tmpdir(), opciones.prefijoCarpeta))
  const servidor = new EmbeddedPostgres({
    databaseDir: carpeta,
    user: 'postgres',
    password: 'postgres',
    port: opciones.puerto,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: [
      '-c',
      'shared_buffers=256MB',
      '-c',
      'log_min_messages=error',
      ...(opciones.zonaHoraria ? ['-c', `timezone=${opciones.zonaHoraria}`] : []),
    ],
    onLog: () => {},
    onError: () => {},
  })
  await servidor.initialise()
  await servidor.start()
  await servidor.createDatabase(opciones.base)
  return {
    detener: async () => {
      await servidor.stop().catch(() => {})
      try {
        rmSync(carpeta, { recursive: true, force: true, maxRetries: 5 })
      } catch {
        // En Windows la carpeta puede quedar tomada un instante: es temporal, la limpia el sistema.
      }
    },
  }
}
