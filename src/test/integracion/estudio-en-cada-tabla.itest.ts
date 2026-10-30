/**
 * Una sola base para todos los estudios (docs/decisiones/0011), etapa 1: cada tabla con datos de un
 * estudio lleva el estudio, y la base no deja que una fila apunte a un dato de otro estudio ni que
 * cambie de estudio. Falla si se agrega una tabla sin el estudio o un vínculo sin su control
 * (ver la migración 20261029150000_estudio_en_cada_tabla). Además controla que la base coincida con
 * schema.prisma.
 */
import { execSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'

/**
 * Tablas sin estudio, a propósito. Cada una con su motivo: agregar una acá es una decisión, no un
 * atajo.
 */
const SIN_ESTUDIO: Record<string, string> = {
  estudios: 'es la tabla de los estudios',
  _prisma_migrations: 'historial de migraciones',
  errores_tecnicos_log: 'registro técnico de la plataforma (se decide con el login)',
  // Catálogo: hoy común a todos; falta decidir si cada estudio tiene el suyo (ver el informe)
  rubros_grupo: 'catálogo de secciones (decisión pendiente)',
  rubros_base: 'catálogo de clasificaciones (decisión pendiente)',
  gasto_seccion_config: 'configuración de secciones de gastos (decisión pendiente)',
}

const ctx = { a: '', b: '', socA: '', socB: '', ejA: '', ejB: '' }

const falla = (p: Promise<unknown>) => expect(p).rejects.toThrow(/otro estudio|no se cambia/)

beforeAll(async () => {
  const [a, b] = await Promise.all([
    db.estudio.create({
      data: {
        nombre: 'Estudio A espionaje',
        cuit: '30999999996',
        razonSocial: 'Estudio A',
        createdAt: new Date('1994-01-01T00:00:00Z'),
      },
    }),
    db.estudio.create({
      data: {
        nombre: 'Estudio B espionaje',
        cuit: '30999999988',
        razonSocial: 'Estudio B',
        createdAt: new Date('2099-01-01T00:00:00Z'),
      },
    }),
  ])
  ctx.a = a.id
  ctx.b = b.id
  const [socA, socB, audA] = await Promise.all([
    db.sociedad.create({
      data: { estudioId: a.id, razonSocial: 'Sociedad A', cuit: '30999999970' },
    }),
    db.sociedad.create({
      data: { estudioId: b.id, razonSocial: 'Sociedad B', cuit: '30999999962' },
    }),
    db.auditor.create({ data: { estudioId: a.id, nombre: 'Ana', apellido: 'A', esDefault: true } }),
  ])
  ctx.socA = socA.id
  ctx.socB = socB.id
  const r = await crearEjercicio(socA.id, {
    fechaInicio: '2025-01-01',
    fechaCierre: '2025-12-31',
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: audA.id,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2026-04-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '131.55',
  })
  if (!r.ok) throw new Error(r.error.mensaje)
  ctx.ejA = r.data.id
  // El de B, copiado del de A (la acción crea solo en el estudio activo)
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    auditorSnapshot: _s,
    ...datos
  } = await db.ejercicioContable.findUniqueOrThrow({ where: { id: ctx.ejA } })
  ctx.ejB = (
    await db.ejercicioContable.create({
      data: { ...datos, estudioId: b.id, sociedadId: socB.id, auditorId: null },
    })
  ).id
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: { in: [ctx.socA, ctx.socB] } } })
  await db.auditor.deleteMany({ where: { estudioId: { in: [ctx.a, ctx.b] } } })
  await db.sociedad.deleteMany({ where: { id: { in: [ctx.socA, ctx.socB] } } })
  await db.estudio.deleteMany({ where: { id: { in: [ctx.a, ctx.b] } } })
})

describe('El estudio en cada tabla', () => {
  it('cada tabla con datos de un estudio lleva estudio_id obligatorio', async () => {
    const tablas = await db.$queryRaw<
      { tabla: string; tipo: string | null; nulo: string | null }[]
    >`
      SELECT c.relname AS tabla, col.data_type AS tipo, col.is_nullable AS nulo
      FROM pg_class c
      LEFT JOIN information_schema.columns col
        ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'estudio_id'
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      ORDER BY c.relname`
    const faltan = tablas
      .filter((t) => !(t.tabla in SIN_ESTUDIO))
      .filter((t) => t.tipo !== 'uuid' || t.nulo !== 'NO')
      .map((t) => t.tabla)
    expect(faltan, 'Agregá estudio_id (ver la migración del estudio en cada tabla)').toEqual([])
  })

  it('cada vínculo entre tablas con estudio tiene su control en la base', async () => {
    const vinculos = await db.$queryRaw<{ tabla: string; columna: string; cubierto: boolean }[]>`
      SELECT c.conrelid::regclass::text AS tabla, a.attname AS columna,
             coalesce(position(('NEW.' || quote_ident(a.attname)) IN pg_get_functiondef(t.tgfoid)) > 0, false)
               AS cubierto
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      LEFT JOIN pg_trigger t ON t.tgrelid = c.conrelid AND t.tgname = 'estudio'
      WHERE c.connamespace = 'public'::regnamespace AND c.contype = 'f'
        AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.conrelid AND x.attname = 'estudio_id')
        AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid AND x.attname = 'estudio_id')`
    expect(vinculos.length).toBeGreaterThan(10)
    expect(
      vinculos.filter((v) => !v.cubierto).map((v) => `${v.tabla}.${v.columna}`),
      "Terminá la migración con SELECT public._estudio_en_la_tabla('public.<tabla>')",
    ).toEqual([])
  })

  it('una fila nueva toma el estudio de su ejercicio, sin que la app lo mande', async () => {
    const cuenta = await db.cuentaContable.create({
      data: { ejercicioId: ctx.ejA, codigo: '1.1.01', nombre: 'Caja' },
    })
    expect(cuenta.estudioId).toBe(ctx.a)
    const nota = await db.notaEjercicio.create({
      data: { ejercicioId: ctx.ejA, titulo: 'CAJA', tipo: 'CUANTITATIVA', numero: 2, orden: 1 },
    })
    const detalle = await db.detalleNota.create({
      data: { notaEjercicioId: nota.id, concepto: 'Caja', orden: 1 },
    })
    expect(detalle.estudioId).toBe(ctx.a)
  })

  it('no deja apuntar a un dato de otro estudio', async () => {
    // una cuenta de B en un ejercicio de A
    await falla(
      db.cuentaContable.create({
        data: { ejercicioId: ctx.ejA, estudioId: ctx.b, codigo: '9', nombre: 'Intrusa' },
      }),
    )
    // una cuenta de A con la nota de un ejercicio de B
    const notaB = await db.notaEjercicio.create({
      data: { ejercicioId: ctx.ejB, titulo: 'NOTA B', tipo: 'CUANTITATIVA', numero: 2, orden: 1 },
    })
    await falla(
      db.cuentaContable.create({
        data: { ejercicioId: ctx.ejA, codigo: '8', nombre: 'Cruzada', notaEjercicioId: notaB.id },
      }),
    )
    // un ejercicio de A con la sociedad de B, o con el anterior de B
    await falla(
      db.ejercicioContable.update({ where: { id: ctx.ejA }, data: { sociedadId: ctx.socB } }),
    )
    await falla(
      db.ejercicioContable.update({
        where: { id: ctx.ejA },
        data: { ejercicioAnteriorId: ctx.ejB },
      }),
    )
  })

  it('una fila no cambia de estudio', async () => {
    const cuenta = await db.cuentaContable.create({
      data: { ejercicioId: ctx.ejA, codigo: '1.1.02', nombre: 'Banco' },
    })
    await falla(db.cuentaContable.update({ where: { id: cuenta.id }, data: { estudioId: ctx.b } }))
    await falla(db.sociedad.update({ where: { id: ctx.socA }, data: { estudioId: ctx.b } }))
  })

  it('la base coincide con schema.prisma (sin diferencias)', () => {
    // Solo contra la base de pruebas (Prisma lee DATABASE_URL)
    expect(new URL(process.env.DATABASE_URL ?? '').pathname).toMatch(/_test$/)
    const salida = execSync(
      'pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script',
      { encoding: 'utf8', env: { ...process.env } },
    )
    const sentencias = salida
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('--') && !/^Loaded Prisma config/.test(l))
    expect(sentencias, salida).toEqual([])
  })
})
