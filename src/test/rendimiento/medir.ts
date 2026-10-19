/**
 * Herramientas de la medición de rendimiento:
 * - un intermediario TCP que simula la latencia de red hacia la base (Supabase está en otra ciudad);
 * - el conteo de consultas por operación (evento "query" de Prisma);
 * - los planes de ejecución reales (EXPLAIN ANALYZE) de cada consulta;
 * - controles del esquema (claves foráneas sin índice, tamaños).
 */
import { createServer, connect, type Server, type Socket } from 'node:net'
import type { Client } from 'pg'

// ─── Latencia de red simulada ─────────────────────────────────────────────────

/**
 * Reenvía la conexión de la app a PostgreSQL demorando cada paquete medio viaje en cada sentido.
 * Con latencia 0 no agrega nada. El orden se conserva porque todas las demoras son iguales.
 */
export function iniciarIntermediario(puertoEscucha: number, destino: URL) {
  const hostDestino = destino.hostname
  const puertoDestino = Number(destino.port || 5432)
  let latenciaMs = 0
  const sockets = new Set<Socket>()
  const reenviar = (desde: Socket, hacia: Socket) => {
    desde.on('data', (bloque) => {
      const mitad = latenciaMs / 2
      if (mitad <= 0) hacia.write(bloque)
      else setTimeout(() => hacia.writable && hacia.write(bloque), mitad)
    })
  }
  const servidor: Server = createServer((cliente) => {
    const base = connect(puertoDestino, hostDestino)
    sockets.add(cliente).add(base)
    reenviar(cliente, base)
    reenviar(base, cliente)
    const cerrar = () => {
      cliente.destroy()
      base.destroy()
    }
    cliente.on('error', cerrar).on('close', cerrar)
    base.on('error', cerrar).on('close', cerrar)
  })
  return {
    escuchar: () => new Promise<void>((ok) => servidor.listen(puertoEscucha, '127.0.0.1', ok)),
    fijarLatencia: (ms: number) => {
      latenciaMs = ms
    },
    cerrar: () =>
      new Promise<void>((ok) => {
        for (const s of sockets) s.destroy()
        servidor.close(() => ok())
      }),
  }
}

// ─── Consultas por operación ──────────────────────────────────────────────────

export type ConsultaCapturada = { sql: string; params: string }

type EventoConsulta = { query: string; params: string }
type ConEventos = { $on: (evento: 'query', cb: (e: EventoConsulta) => void) => void }

/** Registra las consultas de Prisma mientras `activo` sea verdadero. */
export function capturarConsultas(cliente: unknown) {
  let activo = false
  let buffer: ConsultaCapturada[] = []
  ;(cliente as ConEventos).$on('query', (e) => {
    if (activo) buffer.push({ sql: e.query, params: e.params })
  })
  return {
    async durante<T>(
      fn: () => Promise<T>,
    ): Promise<{ resultado: T; consultas: ConsultaCapturada[] }> {
      buffer = []
      activo = true
      try {
        const resultado = await fn()
        return { resultado, consultas: buffer }
      } finally {
        activo = false
      }
    },
  }
}

const CONTROL_DE_TRANSACCION = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|DEALLOCATE|SET )/i

/** Consultas de datos (sin las de control de transacción). */
export function deDatos(consultas: ConsultaCapturada[]): ConsultaCapturada[] {
  return consultas.filter((c) => !CONTROL_DE_TRANSACCION.test(c.sql))
}

// ─── Tiempos ──────────────────────────────────────────────────────────────────

export function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b)
  const i = Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)
  return orden[Math.max(0, i)] ?? 0
}

export async function cronometrar(
  fn: () => Promise<unknown>,
  repeticiones: number,
  calentamiento = 2,
): Promise<{ mediana: number; p95: number; max: number }> {
  for (let i = 0; i < calentamiento; i++) await fn()
  const tiempos: number[] = []
  for (let i = 0; i < repeticiones; i++) {
    const t0 = performance.now()
    await fn()
    tiempos.push(performance.now() - t0)
  }
  return {
    mediana: percentil(tiempos, 50),
    p95: percentil(tiempos, 95),
    max: Math.max(...tiempos),
  }
}

// ─── Planes de ejecución ──────────────────────────────────────────────────────

function literal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) {
    const items = v.map((x) =>
      x === null ? 'NULL' : `"${String(x).replace(/["\\]/g, (m) => `\\${m}`)}"`,
    )
    return `'{${items.join(',')}}'`
  }
  const texto = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `'${texto.replace(/'/g, "''")}'`
}

type NodoPlan = {
  'Node Type': string
  'Relation Name'?: string
  'Index Name'?: string
  'Actual Rows'?: number
  Plans?: NodoPlan[]
}

export type HallazgoPlan = {
  sql: string
  ms: number
  lecturasCompletas: { tabla: string; filasTabla: number }[]
  error?: string
}

/**
 * Reproduce la operación consulta por consulta, en el mismo orden, con EXPLAIN ANALYZE y dentro
 * de UNA transacción que al final se deshace: así las escrituras se explican igual que corrieron
 * (por ejemplo, el borrado antes de la inserción) y la base queda como estaba.
 * Marca las lecturas completas de tablas grandes.
 */
export async function analizarPlanes(
  pg: Client,
  consultas: ConsultaCapturada[],
  filasPorTabla: Map<string, number>,
  umbralFilas = 10_000,
): Promise<HallazgoPlan[]> {
  const hallazgos: HallazgoPlan[] = []
  await pg.query('BEGIN')
  try {
    for (const c of deDatos(consultas)) {
      let params: unknown[] = []
      try {
        params = c.params ? (JSON.parse(c.params) as unknown[]) : []
      } catch {
        hallazgos.push({ sql: c.sql, ms: 0, lecturasCompletas: [], error: 'parámetros ilegibles' })
        continue
      }
      await pg.query('SAVEPOINT rend_paso')
      try {
        await pg.query(`PREPARE rend_consulta AS ${c.sql}`)
        const ejecutar =
          params.length > 0
            ? `EXECUTE rend_consulta(${params.map(literal).join(', ')})`
            : 'EXECUTE rend_consulta'
        const r = await pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${ejecutar}`)
        const plan = (r.rows[0]['QUERY PLAN'] as { Plan: NodoPlan; 'Execution Time': number }[])[0]!
        const lecturasCompletas: HallazgoPlan['lecturasCompletas'] = []
        const recorrer = (n: NodoPlan) => {
          if (n['Node Type'] === 'Seq Scan' && n['Relation Name']) {
            const filasTabla = filasPorTabla.get(n['Relation Name']) ?? 0
            if (filasTabla >= umbralFilas)
              lecturasCompletas.push({ tabla: n['Relation Name'], filasTabla })
          }
          n.Plans?.forEach(recorrer)
        }
        recorrer(plan.Plan)
        hallazgos.push({ sql: c.sql, ms: plan['Execution Time'], lecturasCompletas })
        await pg.query('RELEASE SAVEPOINT rend_paso')
      } catch (e) {
        hallazgos.push({ sql: c.sql, ms: 0, lecturasCompletas: [], error: (e as Error).message })
        await pg.query('ROLLBACK TO SAVEPOINT rend_paso')
      } finally {
        await pg.query('DEALLOCATE ALL')
      }
    }
  } finally {
    await pg.query('ROLLBACK')
  }
  return hallazgos
}

/**
 * Consultas idénticas (mismo SQL y mismos parámetros) a una anterior de la misma operación,
 * agrupadas: qué consulta se repite y cuántas veces de más.
 */
export function repetidas(consultas: ConsultaCapturada[]): { sql: string; veces: number }[] {
  const conteo = new Map<string, { sql: string; veces: number }>()
  for (const c of deDatos(consultas)) {
    const clave = `${c.sql}\u0000${c.params}`
    const previa = conteo.get(clave)
    if (previa) previa.veces++
    else conteo.set(clave, { sql: c.sql, veces: 0 })
  }
  return [...conteo.values()].filter((r) => r.veces > 0)
}

// ─── Controles del esquema ────────────────────────────────────────────────────

export async function filasPorTabla(pg: Client): Promise<Map<string, number>> {
  const r = await pg.query<{ tabla: string; filas: string }>(
    `SELECT relname AS tabla, GREATEST(reltuples, 0)::bigint AS filas
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`,
  )
  return new Map(r.rows.map((f) => [f.tabla, Number(f.filas)]))
}

/** Claves foráneas cuyas columnas no son el comienzo de ningún índice de su tabla. */
export async function clavesForaneasSinIndice(
  pg: Client,
): Promise<{ tabla: string; columnas: string; filas: number }[]> {
  const r = await pg.query<{ tabla: string; columnas: string; filas: string }>(
    `SELECT c.conrelid::regclass::text AS tabla,
            (SELECT string_agg(a.attname, ', ' ORDER BY a.attnum)
               FROM pg_attribute a
              WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) AS columnas,
            GREATEST((SELECT reltuples FROM pg_class WHERE oid = c.conrelid), 0)::bigint AS filas
       FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
              SELECT 1
                FROM pg_index i
               WHERE i.indrelid = c.conrelid
                 AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)] @> c.conkey
                 AND c.conkey @> (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)]
            )
      ORDER BY filas DESC, tabla`,
  )
  return r.rows.map((f) => ({ ...f, filas: Number(f.filas) }))
}

export async function tamanios(
  pg: Client,
): Promise<{ tabla: string; filas: number; total: string }[]> {
  const r = await pg.query<{ tabla: string; filas: string; total: string }>(
    `SELECT relname AS tabla, GREATEST(reltuples, 0)::bigint AS filas,
            pg_size_pretty(pg_total_relation_size(oid)) AS total
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
      ORDER BY pg_total_relation_size(oid) DESC
      LIMIT 10`,
  )
  return r.rows.map((f) => ({ ...f, filas: Number(f.filas) }))
}
