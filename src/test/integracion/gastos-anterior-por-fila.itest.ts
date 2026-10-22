/**
 * Integración (PostgreSQL real): con el ejercicio anterior cargado a mano, el Anexo III se carga
 * una sola vez, fila por fila ('GASTOS_FILA'). El total del anterior de cada columna se calcula
 * desde las filas y es el mismo que recibe el Estado de Resultados. Ver gastos/domain/filasAnexo.ts.
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
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { claveFilaAnterior, filasAnexoGastos } from '@/modules/gastos/domain/filasAnexo'

const ADM = 'legacy:GASTOS_ADM'
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
  const auditor = await db.auditor.create({
    data: { estudioId, nombre: 'Ana', apellido: 'Pérez' },
  })
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
  // Una cuenta de gastos de administración del ejercicio actual (sección legacy:GASTOS_ADM).
  const rubroAdm = await db.rubroBase.findFirstOrThrow({ where: { codigo: 'EERR-GADM-01' } })
  await db.cuentaContable.create({
    data: {
      ejercicioId: ejercicio.id,
      codigo: '5101',
      nombre: 'SUELDOS ADMINISTRACION',
      rubroBaseId: rubroAdm.id,
      saldoDeudor: 1000,
      saldoFinal: 1000,
    },
  })
  Object.assign(ctx, { sociedadId: sociedad.id, ejercicioId: ejercicio.id })
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
})

describe('Anexo III con el ejercicio anterior cargado a mano', () => {
  it('el total anterior de cada columna sale de las filas y es el mismo en el Estado de Resultados', async () => {
    ok(
      await guardarLoteComparativoAction(ctx.ejercicioId, ctx.sociedadId, [
        // Un total escrito a mano por sección (forma anterior): ya no cuenta.
        { modulo: 'GASTOS', clave: ADM, label: 'Adm', valor: 777, esHuerfano: false, orden: 0 },
        {
          modulo: 'GASTOS_FILA',
          clave: claveFilaAnterior('SUELDOS ADMINISTRACION'),
          label: 'SUELDOS ADMINISTRACION',
          valor: 600.555,
          esHuerfano: false,
          orden: 0,
        },
        // Gasto que solo existió el año pasado, clasificado en Administración.
        {
          modulo: 'GASTOS_FILA',
          clave: `sec:${ADM}:1700000000000`,
          label: 'PUBLICIDAD',
          valor: 400,
          esHuerfano: true,
          orden: 1,
        },
      ]),
    )

    const ejercicio = (await findEjercicioById(ctx.ejercicioId))!
    const gastos = await cargarGastos(ejercicio)
    const adm = gastos.secciones.find((s) => s.key === ADM)
    // 600,555 + 400, sin redondear; el 777 escrito por sección no cuenta.
    expect(adm?.totalAnterior).toBe(1000.555)

    const filas = filasAnexoGastos(gastos.secciones, gastos.anteriorManualPorFila)
    expect(filas.map((f) => [f.nombre, f.totalAnterior, f.soloAnterior])).toEqual([
      ['SUELDOS ADMINISTRACION', 600.555, false],
      ['PUBLICIDAD', 400, true],
    ])

    // El Estado de Resultados recibe exactamente el mismo total por sección.
    const { estadosData } = await cargarEstadosConPN(
      ejercicio,
      await findCuentasByEjercicio(ctx.ejercicioId),
    )
    expect(estadosData.eerr.seccionesGasto.find((s) => s.key === ADM)?.totalAnt).toBe(1000.555)
  })
})
