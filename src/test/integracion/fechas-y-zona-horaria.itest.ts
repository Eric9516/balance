/**
 * Integración (PostgreSQL real) de las fechas: las contables son DATE (un día, sin hora) y los
 * instantes son TIMESTAMPTZ. Ninguna puede correrse por la zona horaria de la base ni por la del
 * proceso de Node. Ver docs/decisiones/0006-fechas-y-zona-horaria.md.
 *
 * El PostgreSQL de las pruebas arranca a propósito en una zona distinta de UTC
 * (TEST_PG_TIMEZONE, por defecto America/Argentina/Buenos_Aires), y estas pruebas se corren
 * además con otras zonas en el proceso de Node (variable TZ): ver "Matriz de zonas horarias" en
 * docs/decisiones/0006-fechas-y-zona-horaria.md.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))

import { db } from '@/lib/db'
import { formatFecha } from '@/lib/utils/dates'
import { CreateEjercicioSchema } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import {
  autorizarComparativo,
  createEjercicio,
  findEjercicioById,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { ZONA_HORARIA_PG_PRUEBAS } from '../integration.setup'

const ctx = {} as { estudioId: string; sociedadId: string; ejercicioId: string }
/** Conexión SIN fijar UTC: ve la zona por defecto de la base, como cualquier otro cliente. */
let sinUtc: Client

const dia = (d: Date) => d.toISOString().slice(0, 10)

beforeAll(async () => {
  const sufijo = Date.now().toString().slice(-8)
  const estudio = await db.estudio.create({
    data: { nombre: 'Estudio fechas', cuit: `30${sufijo}6`, razonSocial: 'Estudio fechas' },
  })
  const sociedad = await db.sociedad.create({
    data: { estudioId: estudio.id, razonSocial: 'Fechas SA', cuit: `30${sufijo}5` },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  // El camino real de la app: texto "AAAA-MM-DD" del formulario, validado y convertido por el repositorio.
  const input = CreateEjercicioSchema.parse({
    fechaInicio: '2024-01-01',
    fechaCierre: '2024-12-31',
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: auditor.id,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2025-03-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '125',
  })
  const ejercicio = await createEjercicio(sociedad.id, estudio.id, input)
  Object.assign(ctx, { estudioId: estudio.id, sociedadId: sociedad.id, ejercicioId: ejercicio.id })

  sinUtc = new Client({ connectionString: process.env.DATABASE_URL })
  await sinUtc.connect()
})

afterAll(async () => {
  await sinUtc?.end()
})

describe('zona horaria de la sesión', () => {
  it('la app trabaja en UTC aunque la base tenga otra zona por defecto', async () => {
    const [app] = await db.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`
    expect(app?.TimeZone).toBe('UTC')
    if (!process.env.TEST_DATABASE_URL) {
      const otra = await sinUtc.query<{ TimeZone: string }>('SHOW timezone')
      expect(otra.rows[0]?.TimeZone).toBe(ZONA_HORARIA_PG_PRUEBAS)
    }
  })
})

describe('fechas contables (DATE)', () => {
  it('vuelven con el mismo día con que se cargaron', async () => {
    const e = (await findEjercicioById(ctx.ejercicioId))!
    expect([dia(e.fechaInicio), dia(e.fechaCierre), dia(e.fechaInformeAuditor!)]).toEqual([
      '2024-01-01',
      '2024-12-31',
      '2025-03-15',
    ])
    expect(formatFecha(e.fechaCierre)).toBe('31/12/2024')
  })

  it('la base guarda el día exacto, lo lea quien lo lea', async () => {
    const consulta = `SELECT "fecha_inicio"::text AS inicio, "fecha_cierre"::text AS cierre
                        FROM "ejercicios_contables" WHERE "id" = $1`
    const [app] = await db.$queryRawUnsafe<{ inicio: string; cierre: string }[]>(
      consulta,
      ctx.ejercicioId,
    )
    const otra = await sinUtc.query<{ inicio: string; cierre: string }>(consulta, [ctx.ejercicioId])
    expect(app).toEqual({ inicio: '2024-01-01', cierre: '2024-12-31' })
    expect(otra.rows[0]).toEqual({ inicio: '2024-01-01', cierre: '2024-12-31' })
  })

  it('el 29 de febrero y el último día del año no se corren', async () => {
    await db.sociedad.update({
      where: { id: ctx.sociedadId },
      data: { fechaInscripcion: new Date('2024-02-29'), plazoDuracion: new Date('2099-12-31') },
    })
    const s = (await findSociedadById(ctx.sociedadId))!
    expect([s.fechaInscripcion, s.plazoDuracion].map((d) => (d ? dia(new Date(d)) : null))).toEqual(
      ['2024-02-29', '2099-12-31'],
    )
  })
})

describe('instantes (TIMESTAMPTZ)', () => {
  it('se guardan y se leen exactos, con milisegundos', async () => {
    const instante = new Date('2026-10-19T02:30:00.123Z')
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { comparativoAutorizadoEn: instante },
    })
    const e = (await findEjercicioById(ctx.ejercicioId))!
    expect(e.comparativoAutorizadoEn?.toISOString()).toBe(instante.toISOString())

    // Otro cliente, con la zona por defecto de la base, ve el mismo instante absoluto.
    const r = await sinUtc.query<{ ms: string }>(
      `SELECT (extract(epoch FROM "comparativo_autorizado_en") * 1000)::bigint::text AS ms
         FROM "ejercicios_contables" WHERE "id" = $1`,
      [ctx.ejercicioId],
    )
    expect(Number(r.rows[0]?.ms)).toBe(instante.getTime())
  })

  it('los instantes que pone la base (now) y la app (new Date) son el momento actual', async () => {
    const antes = Date.now()
    await autorizarComparativo(ctx.ejercicioId, 'prueba')
    const e = (await findEjercicioById(ctx.ejercicioId))!
    const margen = 2 * 60_000 // reloj de la base y del proceso en la misma máquina
    expect(Math.abs(e.comparativoAutorizadoEn!.getTime() - antes)).toBeLessThan(margen)
    expect(Math.abs(e.createdAt.getTime() - antes)).toBeLessThan(margen)
  })
})
