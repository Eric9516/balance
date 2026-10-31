/**
 * Auditoría completa de la app (`pnpm auditoria`): un contador simulado hace tres balances de
 * referencia de punta a punta (primer balance, anterior cargado a mano y anterior vinculado),
 * controla cada pantalla contra resultados conocidos y entre sí, recorre las pantallas en un
 * navegador real y deja un informe en `auditoria/informes/`. `pnpm auditoria:rapida` hace solo la
 * parte de lógica (segundos). Corre contra el PostgreSQL embebido de las pruebas: nunca toca producción.
 * Falla si hay algún hallazgo de gravedad "error".
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  // En las pruebas, redirect y notFound son errores comunes: no hay señales de Next que dejar pasar
  unstable_rethrow: () => {},
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
  notFound: () => {
    throw new Error('notFound')
  },
}))

import { db } from '@/lib/db'
import { ESCENARIOS } from './referencia'
import { Registro } from './registro'
import { simular, type Contexto } from './motor'
import { controlar } from './controles'
import { recorrerPantallas } from './pantallas'

const ctx = { reg: new Registro(), hechos: new Map() } as unknown as Contexto
let estudioId = ''
const inicio = Date.now()

beforeAll(async () => {
  // El más antiguo: es el estudio actual mientras corre la auditoría.
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Auditoría',
      cuit: '30999999993',
      razonSocial: 'Estudio Auditoría',
      createdAt: new Date('1999-01-01T00:00:00Z'),
    },
  })
  estudioId = estudio.id
  const auditor = await db.auditor.create({
    data: { estudioId, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
  })
  const rubros = await db.rubroBase.findMany({
    where: { estudioId: estudio.id },
    select: { id: true, codigo: true },
  })
  Object.assign(ctx, {
    auditorId: auditor.id,
    rubroId: new Map(rubros.map((r) => [r.codigo, r.id])),
    rubroCodigo: new Map(rubros.map((r) => [r.id, r.codigo])),
  })
})

afterAll(async () => {
  const informe = ctx.reg.informe(
    'Auditoría de BalanceRT',
    ESCENARIOS.map((e) => ({ id: e.id, titulo: e.titulo })),
    Date.now() - inicio,
  )
  const carpeta = join(process.cwd(), 'auditoria', 'informes')
  mkdirSync(carpeta, { recursive: true })
  const archivo = join(carpeta, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  writeFileSync(archivo, informe)
  writeFileSync(join(carpeta, 'ultimo.md'), informe)
  console.log(`\nInforme: ${archivo}\n`)
  await db.ejercicioContable.deleteMany({ where: { sociedad: { estudioId } } })
  await db.sociedad.deleteMany({ where: { estudioId } })
  await db.estudio.delete({ where: { id: estudioId } })
  await db.$disconnect()
})

describe('Auditoría de BalanceRT', () => {
  for (const esc of ESCENARIOS) {
    it(`Lógica — escenario ${esc.id}: ${esc.titulo}`, async () => {
      try {
        const ej = await simular(ctx, esc)
        if (ej) await controlar(ctx, esc, ej)
      } catch (e) {
        ctx.reg.hallazgo(
          'error',
          esc.id,
          'Auditoría',
          `Se cortó: ${e instanceof Error ? e.stack : String(e)}`,
        )
      }
    })
  }

  // Se saltea con `pnpm auditoria:rapida`.
  it('Pantallas — cada paso de cada ejercicio y el documento imprimible', async () => {
    await recorrerPantallas(ctx, ESCENARIOS, estudioId)
  })

  it('Resultado — sin errores', () => {
    const errores = ctx.reg.hallazgos.filter((h) => h.gravedad === 'error')
    expect(errores.map((h) => `[${h.escenario}] ${h.area}: ${h.mensaje}`)).toEqual([])
  })
})
