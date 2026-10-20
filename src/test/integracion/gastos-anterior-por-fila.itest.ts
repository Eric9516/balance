/**
 * Integración (PostgreSQL real): en un ejercicio con el anterior cargado a mano, el Anexo III guarda
 * y devuelve la columna "Total ejercicio anterior" fila por fila ('GASTOS_FILA'), separada de los
 * totales por sección ('GASTOS', van al Estado de Resultados). Ver gastos/domain/filasAnexo.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
  notFound: () => {
    throw new Error('notFound')
  },
}))

import { db } from '@/lib/db'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import type { ActionResult } from '@/modules/errores/types'
import { CreateEjercicioSchema } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import {
  createEjercicio,
  findEjercicioById,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { claveFilaAnterior, filasAnexoGastos } from '@/modules/gastos/domain/filasAnexo'

const ctx = {} as { sociedadId: string; ejercicioId: string }

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

beforeAll(async () => {
  // Las acciones trabajan sobre el estudio actual (el primero activo): si la base está vacía, se crea.
  if (!(await db.estudio.findFirst({ where: { activo: true } }))) {
    const cuit = `35${Date.now().toString().slice(-8)}1`
    await db.estudio.create({
      data: { nombre: 'Estudio Gastos', cuit, razonSocial: 'Estudio Gastos' },
    })
  }
  const estudioId = await getCurrentEstudioId()
  const sociedad = await db.sociedad.create({
    data: {
      estudioId,
      razonSocial: 'Gastos Anterior SA',
      cuit: `35${Date.now().toString().slice(-8)}0`,
    },
  })
  const auditor = await db.auditor.create({ data: { estudioId, nombre: 'Ana', apellido: 'Pérez' } })
  const input = CreateEjercicioSchema.parse({
    fechaInicio: '2025-01-01',
    fechaCierre: '2025-12-31',
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: auditor.id,
    modoAnterior: 'MANUAL',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2026-03-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '125',
  })
  const ejercicio = await createEjercicio(sociedad.id, estudioId, input)
  Object.assign(ctx, { sociedadId: sociedad.id, ejercicioId: ejercicio.id })
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
})

describe('Anexo III con el ejercicio anterior cargado a mano', () => {
  it('guarda y devuelve el anterior fila por fila, exacto y separado de los totales por sección', async () => {
    ok(
      await guardarLoteComparativoAction(ctx.ejercicioId, ctx.sociedadId, [
        {
          modulo: 'GASTOS',
          clave: 'legacy:GASTOS_ADM',
          label: 'Gastos de Administración',
          valor: 1000.555,
          esHuerfano: false,
          orden: 0,
        },
        {
          modulo: 'GASTOS_FILA',
          clave: claveFilaAnterior('SUELDOS'),
          label: 'SUELDOS',
          valor: 600.555,
          esHuerfano: false,
          orden: 0,
        },
        {
          modulo: 'GASTOS_FILA',
          clave: 'huerfano:1',
          label: 'PUBLICIDAD',
          valor: 400,
          esHuerfano: true,
          orden: 1,
        },
      ]),
    )

    const ejercicio = (await findEjercicioById(ctx.ejercicioId))!
    const gastos = await cargarGastos(ejercicio)

    expect(gastos.anteriorManualPorFila).toEqual([
      { clave: 'fila:SUELDOS', nombre: 'SUELDOS', valor: 600.555, soloAnterior: false },
      { clave: 'huerfano:1', nombre: 'PUBLICIDAD', valor: 400, soloAnterior: true },
    ])
    // Las filas no se confunden con secciones (columnas del anexo ni líneas del Estado de Resultados).
    const claves = gastos.secciones.map((s) => s.key)
    expect(claves).not.toContain('fila:SUELDOS')
    expect(claves).not.toContain('huerfano:1')
    // La fila solo del anterior aparece en el anexo con su importe.
    const filas = filasAnexoGastos(gastos.secciones, gastos.anteriorManualPorFila)
    expect(filas.find((f) => f.nombre === 'PUBLICIDAD')).toMatchObject({
      soloAnterior: true,
      totalAnterior: 400,
    })
  })
})
