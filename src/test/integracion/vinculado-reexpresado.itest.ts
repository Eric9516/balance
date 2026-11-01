/**
 * Anterior VINCULADO con coeficiente (índices 100 → 150): todo lo que se arrastra del ejercicio
 * anterior queda en moneda de cierre y nada que existió solo el año anterior se pierde.
 *  - Anexo III y gastos del estado de resultados: el anterior reexpresado, incluidas las cuentas
 *    de gasto que este año ya no están.
 *  - Anexo II: la existencia inicial es la existencia final del anterior reexpresada (pantalla y
 *    lo que se guarda).
 *  - Anexo I: el neto del año anterior es el neto reexpresado (igual al rubro del SSP anterior).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import type { CreateEjercicioInput } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { guardarTodoCostoVentasAction } from '@/modules/costo-ventas/actions/costo-ventas.actions'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import {
  crearBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'

const ctx = { estudioId: '', auditorId: '', sociedadId: '', ej2024: '', ej2025: '' }
const rubro = new Map<string, string>()

function ok<T>(
  r: { ok: true; data: T } | { ok: false; error: { codigo: string; mensaje: string } },
): T {
  if (!r.ok) throw new Error(`Esperaba ok y vino ${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

function input(partial: Partial<CreateEjercicioInput>): CreateEjercicioInput {
  return {
    fechaInicio: '2024-01-01',
    fechaCierre: '2024-12-31',
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: ctx.auditorId,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2025-03-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '100',
    ...partial,
  }
}

async function cuentas(
  ejercicioId: string,
  filas: [rubro: string, nombre: string, saldo: number][],
) {
  await db.cuentaContable.createMany({
    data: filas.map(([r, nombre, saldo], i) => ({
      ejercicioId,
      codigo: String(100 + i),
      nombre,
      rubroBaseId: rubro.get(r)!,
      saldoDeudor: saldo > 0 ? saldo : 0,
      saldoAcreedor: saldo < 0 ? -saldo : 0,
      saldoFinal: saldo,
      clasificadaManual: true,
    })),
  })
}

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Reexpresión',
      cuit: '30777777776',
      razonSocial: 'Estudio Reexpresión',
      createdAt: new Date('1998-01-01T00:00:00Z'),
    },
  })
  ctx.estudioId = estudio.id
  ctx.auditorId = (
    await db.auditor.create({
      data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
    })
  ).id
  ctx.sociedadId = (
    await db.sociedad.create({
      data: { estudioId: estudio.id, razonSocial: 'Reexpresada S.A.', cuit: '30777777784' },
    })
  ).id
  for (const r of await db.rubroBase.findMany({
    where: { estudioId: estudio.id },
    select: { id: true, codigo: true },
  })) {
    rubro.set(r.codigo, r.id)
  }

  ctx.ej2024 = ok(await crearEjercicio(ctx.sociedadId, input({}))).id
  await cuentas(ctx.ej2024, [
    ['ACT-CTE-09', 'Mercaderías', 400],
    ['ACT-NCTE-09', 'Rodados', 900],
    ['PN-01', 'Capital', -1_000],
    ['EERR-GADM-01', 'Sueldos', 100.1],
    ['EERR-GCOM-01', 'Publicidad', 50], // este año ya no está
    ['EERR-ING-01', 'Ventas', -450.1],
  ])
  ok(
    await guardarTodoCostoVentasAction(ctx.ej2024, ctx.sociedadId, {
      existenciaInicial: 300,
      compras: 500,
      gastosFabricacion: 0,
      existenciaFinal: 400.002,
    }),
  )
  const rodados = ok(await crearBienDeUsoAction(ctx.ej2024, ctx.sociedadId, 'Rodados'))
  ok(
    await guardarLoteBienesAction(ctx.ej2024, ctx.sociedadId, [
      { ...rodados, costoInicioReexpresado: 1_000, depEjercicio: 100.004 },
    ]),
  )

  ctx.ej2025 = ok(
    await crearEjercicio(
      ctx.sociedadId,
      input({
        fechaInicio: '2025-01-01',
        fechaCierre: '2025-12-31',
        numeroEjercicio: '2',
        modoAnterior: 'VINCULADO',
        ejercicioAnteriorId: ctx.ej2024,
        fechaInformeAuditor: '2026-03-15',
        indiceInflacionActual: '150',
      }),
    ),
  ).id
  await cuentas(ctx.ej2025, [
    ['ACT-CTE-09', 'Mercaderías', 600],
    ['PN-01', 'Capital', -1_000],
    ['EERR-GADM-01', 'Sueldos', 200],
    ['EERR-ING-01', 'Ventas', -200],
  ])
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

const ej2025 = async () => (await findEjercicioById(ctx.ej2025))!

describe('Anterior vinculado con coeficiente', () => {
  it('Anexo III: el anterior reexpresado y con la cuenta que ya no existe', async () => {
    const gastos = await cargarGastos(await ej2025())
    const adm = gastos.secciones.find((s) => s.key === 'legacy:GASTOS_ADM')!
    const com = gastos.secciones.find((s) => s.key === 'legacy:GASTOS_COM')
    expect(adm.filas.map((f) => [f.cuentaNombre, f.importe, f.importeAnterior])).toEqual([
      ['Sueldos', 200, 150.15],
    ])
    expect(adm.totalAnterior).toBe(150.15)
    // La sección entera existió solo el año anterior: aparece igual, sin importe actual.
    expect(com?.filas.map((f) => [f.cuentaNombre, f.importe, f.importeAnterior])).toEqual([
      ['Publicidad', 0, 75],
    ])
    expect(com?.total).toBe(0)
    expect(com?.totalAnterior).toBe(75)
  })

  it('estado de resultados: los gastos del anterior coinciden con el Anexo III', async () => {
    const ejercicio = await ej2025()
    const { estadosData } = await cargarEstadosConPN(
      ejercicio,
      await findCuentasByEjercicio(ctx.ej2025),
    )
    const ant = Object.fromEntries(estadosData.eerr.seccionesGasto.map((s) => [s.key, s.totalAnt]))
    expect(ant['legacy:GASTOS_ADM']).toBe(150.15)
    expect(ant['legacy:GASTOS_COM']).toBe(75)
  })

  it('Anexo II: la existencia inicial es la final del anterior sin ajustar, también al guardar', async () => {
    const antes = await cargarCostoVentas(await ej2025())
    expect(antes.existenciaInicialDerivada).toBe(400.002)
    // La columna anterior sí se ajusta; la del ejercicio actual, no.
    expect(antes.datosAnteriores?.existenciaFinal).toBe(600.003)
    // La pantalla manda otra existencia inicial: el servidor guarda la derivada.
    ok(
      await guardarTodoCostoVentasAction(ctx.ej2025, ctx.sociedadId, {
        existenciaInicial: 1,
        compras: 1_000,
        gastosFabricacion: 0,
        existenciaFinal: 600,
      }),
    )
    expect((await findCostoVentas(ctx.ej2025))?.existenciaInicial).toBe(400.002)
  })

  it('Anexo I: el neto del año anterior es el neto reexpresado', async () => {
    ok(await crearBienDeUsoAction(ctx.ej2025, ctx.sociedadId, 'Rodados'))
    const bdu = await cargarBienesDeUso(await ej2025())
    // Neto 2024: 1.000 − 100,004 = 899,996; × 1,5 = 1.349,994.
    expect(bdu.netoAnteriorMap.get('Rodados')).toBe(1_349.994)
  })
})
