/**
 * Integración (PostgreSQL real): en carga manual, el anterior de cada rubro del Estado de
 * Situación Patrimonial sale del total de su nota de composición, que se carga cuenta por cuenta.
 * Se carga una sola vez y el estado coincide con la nota. Con la nota sin cargar, el rubro conserva
 * el importe escrito en el estado.
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
import type { ActionResult } from '@/modules/errores/types'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import {
  actualizarDetalleAction,
  crearDetalleAction,
  generarNotasAutomaticasAction,
} from '@/modules/notas/actions/notas.actions'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'

const ctx = {} as {
  estudioId: string
  sociedadId: string
  ejercicioId: string
  rubro: Map<string, string>
}

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

async function rubroDelEstado(codigoRubro: string) {
  const ejercicio = (await findEjercicioById(ctx.ejercicioId))!
  const { estadosData } = await cargarEstadosConPN(
    ejercicio,
    await findCuentasByEjercicio(ctx.ejercicioId),
  )
  return estadosData.sspRubros.find((r) => r.id === ctx.rubro.get(codigoRubro))!
}

beforeAll(async () => {
  // El más antiguo, para que sea el estudio actual mientras corre este archivo.
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Notas',
      cuit: `30${Date.now().toString().slice(-8)}6`,
      razonSocial: 'Estudio Notas',
      createdAt: new Date('2000-01-01T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Comparativo Manual SA',
      cuit: `30${Date.now().toString().slice(-8)}7`,
    },
  })
  const rubros = await db.rubroBase.findMany({ select: { id: true, codigo: true } })
  Object.assign(ctx, {
    estudioId: estudio.id,
    sociedadId: sociedad.id,
    rubro: new Map(rubros.map((r) => [r.codigo, r.id])),
  })

  const ejercicio = ok(
    await crearEjercicio(sociedad.id, {
      fechaInicio: '2025-01-01',
      fechaCierre: '2025-12-31',
      denominacion: '',
      numeroEjercicio: '2',
      auditorId: auditor.id,
      modoAnterior: 'MANUAL',
      ejercicioAnteriorId: '',
      categoriaEnte: 'PEQUENA',
      fechaInformeAuditor: '2026-03-15',
      indiceInflacionAnterior: '100',
      indiceInflacionActual: '125',
    }),
  )
  ctx.ejercicioId = ejercicio.id

  const cuentas: [string, string, string, number][] = [
    ['1103', 'ACT-CTE-01', 'BCO NACION CC', 1_088.12],
    ['1109', 'ACT-CTE-01', 'BCO GALICIA', 155_360.78],
    ['1301', 'ACT-CTE-03', 'Deudores por ventas', 50_000],
  ]
  await db.cuentaContable.createMany({
    data: cuentas.map(([codigo, rubro, nombre, saldo]) => ({
      ejercicioId: ejercicio.id,
      codigo,
      nombre,
      rubroBaseId: ctx.rubro.get(rubro)!,
      saldoDeudor: saldo,
      saldoFinal: saldo,
      clasificadaManual: true,
    })),
  })
  ok(await generarNotasAutomaticasAction(ejercicio.id, sociedad.id))
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Anterior del Estado de Situación Patrimonial desde las notas', () => {
  it('el total del rubro es la suma de la nota, incluidas las cuentas que ya no existen', async () => {
    const cuentas = await findCuentasByEjercicio(ctx.ejercicioId)
    const notaId = cuentas.find((c) => c.nombre === 'BCO GALICIA')!.notaEjercicioId!
    const nota = (await findNotasByEjercicio(ctx.ejercicioId)).find((n) => n.id === notaId)!
    const args = [ctx.ejercicioId, ctx.sociedadId] as const

    // Cuenta por cuenta, como en la pantalla de la nota.
    for (const d of nota.detalles) {
      const importeAnterior = d.concepto === 'BCO GALICIA' ? 98_000.5 : 2_000.25
      ok(await actualizarDetalleAction(d.id, ...args, { importeAnterior }))
    }
    // Un banco que tenía el año pasado y ya no está en el balance: fila nueva en la nota.
    const fila = ok(await crearDetalleAction(notaId, ...args, nota.detalles.length + 1))
    ok(
      await actualizarDetalleAction(fila.id, ...args, {
        concepto: 'BCO SANTANDER',
        importeAnterior: 10_000,
      }),
    )
    // Un importe escrito en el estado para el mismo rubro no cuenta: manda la nota.
    ok(
      await guardarLoteComparativoAction(...args, [
        {
          modulo: 'SSP',
          clave: ctx.rubro.get('ACT-CTE-01')!,
          label: 'Caja y Bancos',
          valor: 1,
          esHuerfano: false,
          orden: 0,
        },
      ]),
    )

    const caja = await rubroDelEstado('ACT-CTE-01')
    expect(caja.displayValueAnt).toBe(110_000.75)
    expect(caja.anteriorDesdeNota?.filas).toEqual([
      { concepto: 'BCO NACION CC', importeAnterior: 2_000.25 },
      { concepto: 'BCO GALICIA', importeAnterior: 98_000.5 },
      { concepto: 'BCO SANTANDER', importeAnterior: 10_000 },
    ])
  })

  it('si la nota del rubro no tiene cargado el anterior, usa el importe escrito en el estado', async () => {
    ok(
      await guardarLoteComparativoAction(ctx.ejercicioId, ctx.sociedadId, [
        {
          modulo: 'SSP',
          clave: ctx.rubro.get('ACT-CTE-03')!,
          label: 'Créditos por ventas',
          valor: 42_500.5,
          esHuerfano: false,
          orden: 0,
        },
      ]),
    )
    const deudores = await rubroDelEstado('ACT-CTE-03')
    expect(deudores.displayValueAnt).toBe(42_500.5)
    expect(deudores.anteriorDesdeNota).toBeUndefined()
  })
})
