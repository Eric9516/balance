import pg from 'pg'

/**
 * Cliente de PostgreSQL que fija la sesión en UTC como parte de la conexión: el pool no lo entrega
 * a nadie hasta que el SET terminó. Si el SET falla, la conexión falla a la vista (nunca queda una
 * sesión con otra zona horaria).
 */
type AlConectar = ((err: Error) => void) | ((err: null, c: pg.Client) => void)

class ClienteUtc extends pg.Client {
  override connect(): Promise<pg.Client>
  override connect(callback: AlConectar): void
  override connect(callback?: AlConectar): Promise<pg.Client> | void {
    const conectado = super.connect().then(async () => {
      await this.query("SET TIME ZONE 'UTC'")
      return this
    })
    if (!callback) return conectado
    // pg-pool conecta con callback.
    const avisar = callback as (err: Error | null, c?: pg.Client) => void
    conectado.then(
      (cliente) => avisar(null, cliente),
      (error: Error) => avisar(error),
    )
  }
}

/**
 * Pool de PostgreSQL con cada sesión fijada en UTC. Lo usan la app (db.ts), las semillas,
 * las pruebas de integración y la medición de rendimiento: nadie crea un pool por su cuenta.
 *
 * Por qué: el adaptador de Prisma (@prisma/adapter-pg) asume que la sesión está en UTC. Escribe
 * los instantes sin zona horaria y, al leer una columna `timestamptz`, reemplaza la zona que
 * devuelve la base por "+00:00". Si un proyecto de Supabase tuviera otra zona horaria por
 * defecto, todas las fechas y horas quedarían corridas sin ningún aviso.
 *
 * Por qué así: el pooler de Supabase ignora la zona horaria pedida al conectarse (parámetro
 * `options`; verificado el 2026-10-19), así que se fija con SET al abrir cada conexión. Cuesta un
 * viaje una sola vez por conexión, porque el pool las reutiliza.
 * Ver docs/decisiones/0006-fechas-y-zona-horaria.md.
 */
export function crearPoolPg(config: pg.PoolConfig): pg.Pool {
  return new pg.Pool({ ...config, Client: ClienteUtc })
}
