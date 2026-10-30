import pg from 'pg'
import { contextoActual } from './contexto-base'

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

/** El rol sin permiso para saltear las reglas por fila (migración 20261030150000). */
const ROL_APP = 'balancert_app'

/** Rol y estudio con que quedó cada conexión, para no repetir el SET si no cambian. */
const estadoDe = new WeakMap<pg.PoolClient, string>()

type AlEntregar = (err: Error | undefined, c?: pg.PoolClient, liberar?: () => void) => void

/**
 * Pool que entrega cada conexión con el rol y el estudio de lo que se está ejecutando
 * (contexto-base.ts). El SET va antes de la consulta, en la misma conexión, y solo cuando la
 * conexión venía con otro: con un mismo estudio, no suma viajes a la base.
 *
 * Es un ajuste de la sesión (no de la transacción): necesita una conexión directa o un pooler en
 * modo sesión, donde la conexión del servidor es siempre la misma. Con un pooler en modo
 * transacción otra conexión podría llegar con el estudio de otro: crearPoolPg lo rechaza.
 */
class PoolPorEstudio extends pg.Pool {
  override connect(): Promise<pg.PoolClient>
  override connect(callback: AlEntregar): void
  override connect(callback?: AlEntregar): Promise<pg.PoolClient> | void {
    // Se lee ahora, en el contexto de quien pide la conexión.
    const contexto = contextoActual()
    const rol = contexto && 'plataforma' in contexto ? 'none' : ROL_APP
    const estudio = contexto && 'estudioId' in contexto ? contexto.estudioId : ''
    const clave = `${rol}|${estudio}`
    const entregado = super.connect().then(async (cliente) => {
      if (estadoDe.get(cliente) !== clave) {
        try {
          await cliente.query(
            "SELECT set_config('role', $1, false), set_config('app.estudio', $2, false)",
            [rol, estudio],
          )
        } catch (error) {
          // Una conexión que no se pudo preparar no vuelve al pool.
          estadoDe.delete(cliente)
          cliente.release(error as Error)
          throw error
        }
        estadoDe.set(cliente, clave)
      }
      return cliente
    })
    if (!callback) return entregado
    // pg-pool pide la conexión con callback en pool.query().
    entregado.then(
      (cliente) => callback(undefined, cliente, () => cliente.release()),
      (error: Error) => callback(error),
    )
  }
}

/**
 * Pool de PostgreSQL con cada sesión fijada en UTC, en el rol de la app y en el estudio de lo que
 * se está ejecutando. Lo usan la app (db.ts), las pruebas de integración y la medición de
 * rendimiento: nadie crea un pool por su cuenta.
 *
 * Por qué UTC: el adaptador de Prisma (@prisma/adapter-pg) asume que la sesión está en UTC. Escribe
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
  if (usaPoolerEnModoTransaccion(config.connectionString)) {
    throw new Error(
      'La conexión a la base pasa por un pooler en modo transacción (puerto 6543 o pgbouncer=true). ' +
        'La app guarda el estudio en la sesión: usá una conexión directa o el pooler en modo sesión (puerto 5432).',
    )
  }
  return new PoolPorEstudio({ ...config, Client: ClienteUtc })
}

function usaPoolerEnModoTransaccion(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.port === '6543' || u.searchParams.get('pgbouncer') === 'true'
  } catch {
    return false
  }
}
