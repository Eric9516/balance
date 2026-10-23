/**
 * Pruebas adversariales de integración (PostgreSQL real) de los dos escenarios:
 *  A) VINCULADO: lo manual residual no contamina lo derivado; el cliente no puede
 *     pisar saldos de inicio bloqueados; la compuerta exige el anterior confirmado.
 *  B) MANUAL: la compuerta exige autorización explícita y cuadre; cualquier
 *     edición posterior anula la autorización; cambiar de modo limpia lo manual.
 * Más validaciones de vínculo (ciclos, otra sociedad, anterior ya usado, borrado).
 * Y el Estado de Flujo de Efectivo: efectivo derivado del balance, columna anterior
 * derivada en VINCULADO, autorización anulada en MANUAL y control en la compuerta.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

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
import {
  actualizarEjercicio,
  autorizarComparativoAction,
  avanzarEstadoEjercicio,
  crearEjercicio,
  eliminarEjercicio,
} from './actions/ejercicio.actions'
import type { CreateEjercicioInput } from './schemas/ejercicio.schemas'
import { findEjercicioById } from './repository/ejercicio.repository'
import { confirmarEstadosAction } from '@/modules/estados/actions/estados.actions'
import {
  confirmarPNAction,
  guardarEvolucionPNAction,
} from '@/modules/patrimonio-neto/actions/patrimonio-neto.actions'
import { PN_MOVIMIENTOS, type EvolucionPNInput } from '@/modules/patrimonio-neto/domain/types'
import { findMovimientosPN } from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import {
  crearBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import { guardarTodoCostoVentasAction } from '@/modules/costo-ventas/actions/costo-ventas.actions'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import {
  findComparativoByEjercicio,
  upsertComparativoLote,
} from '@/modules/comparativo-manual/repository/comparativo.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { claveFilaAnterior } from '@/modules/gastos/domain/filasAnexo'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import {
  crearItemFlujoAction,
  guardarFlujoAction,
  traerConceptosAnteriorAction,
} from '@/modules/flujo-efectivo/actions/flujo.actions'
import { findFlujo } from '@/modules/flujo-efectivo/repository/flujo.repository'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Ctx = {
  estudioId: string
  auditorId: string
  sociedadA: string
  sociedadB: string
  rubro: Map<string, string> // codigo → id
}

const ctx = {} as Ctx

function inputEjercicio(partial: Partial<CreateEjercicioInput>): CreateEjercicioInput {
  return {
    fechaInicio: '2025-01-01',
    fechaCierre: '2025-12-31',
    denominacion: '',
    numeroEjercicio: '2',
    auditorId: ctx.auditorId,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2026-03-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '125',
    ...partial,
  }
}

/** Cuentas de un balance que cuadra. saldo > 0 deudor, < 0 acreedor. */
async function cargarCuentas(
  ejercicioId: string,
  cuentas: [codigoRubro: string, nombre: string, saldo: number][],
) {
  await db.cuentaContable.createMany({
    data: cuentas.map(([codigo, nombre, saldo], i) => ({
      ejercicioId,
      codigo: String(1000 + i),
      nombre,
      rubroBaseId: ctx.rubro.get(codigo)!,
      saldoDeudor: saldo > 0 ? saldo : 0,
      saldoAcreedor: saldo < 0 ? -saldo : 0,
      saldoFinal: saldo,
      clasificadaManual: true,
    })),
  })
}

function filasPN(
  overrides: Partial<Record<string, Partial<EvolucionPNInput>>> = {},
): EvolucionPNInput[] {
  return PN_MOVIMIENTOS.map((m) => ({
    tipo: m.tipo,
    orden: m.orden,
    capitalSuscripto: 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: 0,
    totalAnterior: 0,
    ...overrides[m.tipo],
  }))
}

function ok<T>(
  r: { ok: true; data: T } | { ok: false; error: { codigo: string; mensaje: string } },
): T {
  if (!r.ok) throw new Error(`Esperaba ok y vino ${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

function fail(r: { ok: boolean; error?: { codigo: string; mensaje: string } }, codigo: string) {
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error?.codigo).toBe(codigo)
  return r.ok ? '' : (r.error?.mensaje ?? '')
}

// Balance 2024 (cierra): Activo 780 = Pasivo 390 + PN 390 (200 capital + 30 rdos + 160 resultado)
const CUENTAS_2024: [string, string, number][] = [
  ['ACT-CTE-01', 'Caja', 100_000],
  ['ACT-CTE-03', 'Deudores por ventas', 250_000],
  ['ACT-CTE-09', 'Mercaderías', 180_000],
  ['ACT-NCTE-09', 'Rodados', 250_000],
  ['PAS-CTE-01', 'Proveedores', -150_000],
  ['PAS-CTE-03', 'IVA a pagar', -40_000],
  ['PAS-NCTE-01', 'Préstamo bancario', -200_000],
  ['PN-01', 'Capital social', -200_000],
  ['PN-04', 'Resultados no asignados', -30_000],
  ['EERR-ING-01', 'Ventas', -900_000],
  ['EERR-CST-01', 'Costo de mercaderías vendidas', 500_000],
  ['EERR-GADM-01', 'Sueldos administración', 150_000],
  ['EERR-GCOM-01', 'Comisiones', 60_000],
  ['EERR-RFIN-01', 'Intereses ganados', -10_000],
  ['EERR-IMP-01', 'Impuesto a las ganancias', 40_000],
]

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // El más antiguo, para que sea el estudio actual (el primero activo) mientras corre este archivo:
  // crearEjercicio exige que la sociedad y el auditor sean del estudio actual. Otros archivos de
  // pruebas pueden dejar estudios creados antes.
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Test',
      cuit: `30${Date.now().toString().slice(-8)}1`,
      razonSocial: 'Estudio Test',
      createdAt: new Date('2000-01-01T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
  })
  const socA = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Continuidad S.A.',
      cuit: `30${Date.now().toString().slice(-8)}2`,
    },
  })
  const socB = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Primer Uso S.R.L.',
      cuit: `30${Date.now().toString().slice(-8)}3`,
    },
  })
  const rubros = await db.rubroBase.findMany({ select: { id: true, codigo: true } })
  Object.assign(ctx, {
    estudioId: estudio.id,
    auditorId: auditor.id,
    sociedadA: socA.id,
    sociedadB: socB.id,
    rubro: new Map(rubros.map((r) => [r.codigo, r.id])),
  })
})

afterAll(async () => {
  // Por sociedad: así se borran también los ejercicios que hubieran quedado con otro estudio.
  await db.ejercicioContable.deleteMany({ where: { sociedad: { estudioId: ctx.estudioId } } })
  await db.sociedad.deleteMany({ where: { estudioId: ctx.estudioId } })
  await db.estudio.delete({ where: { id: ctx.estudioId } })
  await db.$disconnect()
})

// ─── Escenario A: continuidad (VINCULADO) ─────────────────────────────────────

describe('Escenario A — ejercicio anterior vinculado', () => {
  let ej2024 = ''
  let ej2025 = ''

  it('crea el primer ejercicio (SIN_ANTERIOR) y lo deja confirmado', async () => {
    const e = ok(
      await crearEjercicio(
        ctx.sociedadA,
        inputEjercicio({
          fechaInicio: '2024-01-01',
          fechaCierre: '2024-12-31',
          numeroEjercicio: '1',
        }),
      ),
    )
    ej2024 = e.id
    expect(e.modoAnterior).toBe('SIN_ANTERIOR')
    expect(e.categoriaEnte).toBe('PEQUENA')
    await cargarCuentas(ej2024, CUENTAS_2024)

    // E.E.P.N. 2024: saldo inicio 200.000 capital + 30.000 rdos; resultado 160.000 (del EERR)
    ok(
      await guardarEvolucionPNAction(
        ej2024,
        ctx.sociedadA,
        filasPN({ SALDO_INICIO: { capitalSuscripto: 200_000, rdosNoAsignados: 30_000 } }),
        160_000,
      ),
    )
    // Anexo I y II 2024
    const rodados = ok(await crearBienDeUsoAction(ej2024, ctx.sociedadA, 'Rodados'))
    ok(
      await guardarLoteBienesAction(ej2024, ctx.sociedadA, [
        {
          ...rodados,
          costoInicioReexpresado: 200_000,
          altas: 100_000,
          depAcumInicio: 20_000,
          depEjercicio: 30_000,
        },
      ]),
    )
    ok(
      await guardarTodoCostoVentasAction(ej2024, ctx.sociedadA, {
        existenciaInicial: 150_000,
        compras: 530_000,
        gastosFabricacion: 0,
        existenciaFinal: 180_000,
      }),
    )
    // Autorización final del 2024: primer ejercicio → pasa (solo advertencia)
    ok(await confirmarEstadosAction(ej2024, ctx.sociedadA))
    ok(await confirmarPNAction(ej2024, ctx.sociedadA, true))
    // Un anterior en Borrador bloquea al sucesor: lo iniciamos.
    ok(await avanzarEstadoEjercicio(ej2024, ctx.sociedadA, 'BORRADOR', 'EN_PROCESO'))
    const e24 = await findEjercicioById(ej2024)
    expect(e24?.estadosConfirmado).toBe(true)
    expect(e24?.pnConfirmado).toBe(true)
    expect(e24?.estado).toBe('EN_PROCESO')
  })

  it('crea 2025 vinculado a 2024; un segundo vínculo al mismo anterior se rechaza', async () => {
    const e = ok(
      await crearEjercicio(
        ctx.sociedadA,
        inputEjercicio({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: ej2024 }),
      ),
    )
    ej2025 = e.id
    expect(e.ejercicioAnteriorId).toBe(ej2024)

    const dup = await crearEjercicio(
      ctx.sociedadA,
      inputEjercicio({
        modoAnterior: 'VINCULADO',
        ejercicioAnteriorId: ej2024,
        numeroEjercicio: '3',
      }),
    )
    expect(fail(dup, 'NEG-010')).toMatch(/ya es el ejercicio anterior/)
  })

  it('rechaza vínculos inválidos: otra sociedad, autovínculo/ciclo, modo incoherente', async () => {
    const otraSociedad = await crearEjercicio(
      ctx.sociedadB,
      inputEjercicio({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: ej2024 }),
    )
    expect(fail(otraSociedad, 'NEG-010')).toMatch(/misma sociedad/)

    // 2024 intentando usar a 2025 (su sucesor) como anterior → ciclo (y fechas)
    const ciclo = await actualizarEjercicio(
      ej2024,
      ctx.sociedadA,
      inputEjercicio({
        fechaInicio: '2024-01-01',
        fechaCierre: '2024-12-31',
        numeroEjercicio: '1',
        modoAnterior: 'VINCULADO',
        ejercicioAnteriorId: ej2025,
      }),
    )
    fail(ciclo, 'NEG-010')

    // MANUAL con vínculo → invariante violada (lo frena el schema)
    const incoherente = await crearEjercicio(
      ctx.sociedadA,
      inputEjercicio({ modoAnterior: 'MANUAL', ejercicioAnteriorId: ej2024, numeroEjercicio: '9' }),
    )
    expect(incoherente.ok).toBe(false)
  })

  it('no admite carga manual y los residuos manuales no contaminan lo derivado', async () => {
    const rechazo = await guardarLoteComparativoAction(ej2025, ctx.sociedadA, [
      {
        modulo: 'SSP',
        clave: ctx.rubro.get('ACT-CTE-01')!,
        label: 'Caja',
        valor: 999_999,
        esHuerfano: false,
        orden: 0,
      },
    ])
    expect(fail(rechazo, 'NEG-012')).toMatch(/vinculado/)

    // Residuo plantado directamente en la base (estado inconsistente de un modo previo)
    await upsertComparativoLote(ej2025, [
      {
        modulo: 'SSP',
        clave: ctx.rubro.get('ACT-CTE-01')!,
        label: 'Caja',
        valor: 999_999,
        esHuerfano: false,
        orden: 0,
      },
      {
        modulo: 'EERR',
        clave: 'INGRESOS',
        label: 'Ingresos',
        valor: 123,
        esHuerfano: false,
        orden: 0,
      },
    ])
    await cargarCuentas(ej2025, [
      ['ACT-CTE-01', 'Caja', 150_000],
      ['PN-01', 'Capital social', -150_000],
    ])
    const ejercicio = (await findEjercicioById(ej2025))!
    const { estadosData, pnData } = await cargarEstadosConPN(
      ejercicio,
      await findCuentasByEjercicio(ej2025),
    )
    const caja = estadosData.sspRubros.find((r) => r.id === ctx.rubro.get('ACT-CTE-01'))!
    // Derivado: 100.000 del 2024 × coeficiente 1,25 — no el residuo de 999.999
    expect(caja.displayValueAnt).toBeCloseTo(125_000, 2)
    expect(estadosData.eerr.ingresosAnt).toBeCloseTo(900_000 * 1.25, 2)
    expect(estadosData.hayEjercicioAnterior).toBe(true)
    // Saldos al inicio del E.E.P.N. = cierre del anterior (sin coeficiente), bloqueados
    const inicio = pnData.movimientos.find((m) => m.tipo === 'SALDO_INICIO')!
    expect(inicio.capitalSuscripto).toBe(200_000)
    expect(inicio.rdosNoAsignados).toBe(190_000)
    expect(pnData.bloqueo).toEqual({ saldoInicio: true, totalAnterior: true })
  })

  it('el cliente no puede pisar los saldos de inicio bloqueados del E.E.P.N.', async () => {
    ok(
      await guardarEvolucionPNAction(
        ej2025,
        ctx.sociedadA,
        filasPN({
          SALDO_INICIO: { capitalSuscripto: 1, rdosNoAsignados: 1, totalAnterior: 1 },
          AJUSTE_INFLACION: { ajusteCapital: 50_000 },
          DISTRIB_DIVIDENDOS: { rdosNoAsignados: -35_000, totalAnterior: 7 },
        }),
        205_000,
      ),
    )
    const guardado = await findMovimientosPN(ej2025)
    const inicio = guardado.find((m) => m.tipo === 'SALDO_INICIO')!
    expect(inicio.capitalSuscripto).toBe(200_000)
    expect(inicio.rdosNoAsignados).toBe(190_000)
    expect(inicio.totalAnterior).toBeCloseTo(230_000 * 1.25, 2) // total fila inicio 2024 × coef
    expect(guardado.find((m) => m.tipo === 'AJUSTE_INFLACION')!.ajusteCapital).toBe(50_000)
    expect(guardado.find((m) => m.tipo === 'DISTRIB_DIVIDENDOS')!.totalAnterior).toBe(0)
    expect(guardado.find((m) => m.tipo === 'RESULTADO_EJERCICIO')!.rdosNoAsignados).toBe(205_000)
  })

  it('bienes de uso: inicio bloqueado por categoría con fuente; sin fuente queda editable', async () => {
    const rodados = ok(await crearBienDeUsoAction(ej2025, ctx.sociedadA, 'rodados'))
    const instalaciones = ok(await crearBienDeUsoAction(ej2025, ctx.sociedadA, 'Instalaciones'))
    ok(
      await guardarLoteBienesAction(ej2025, ctx.sociedadA, [
        {
          ...rodados,
          costoInicioReexpresado: 1,
          depAcumInicio: 1,
          altas: 70_000,
          depEjercicio: 50_000,
        },
        { ...instalaciones, costoInicioReexpresado: 40_000, depAcumInicio: 5_000 },
      ]),
    )
    const bienes = await findBienesDeUso(ej2025)
    const rod = bienes.find((b) => b.id === rodados.id)!
    expect(rod.costoInicioReexpresado).toBe(300_000) // cierre 2024: 200.000 + 100.000
    expect(rod.depAcumInicio).toBe(50_000) // 20.000 + 30.000
    expect(rod.costoFinReexpresado).toBe(370_000)
    const inst = bienes.find((b) => b.id === instalaciones.id)!
    expect(inst.costoInicioReexpresado).toBe(40_000)
  })

  it('costo de ventas: existencia inicial = existencia final del anterior', async () => {
    const cv = ok(
      await guardarTodoCostoVentasAction(ej2025, ctx.sociedadA, {
        existenciaInicial: 1,
        compras: 640_000,
        gastosFabricacion: 0,
        existenciaFinal: 220_000,
      }),
    )
    expect(cv.existenciaInicial).toBe(180_000)
    expect((await findCostoVentas(ej2025))?.existenciaInicial).toBe(180_000)
  })

  it('compuerta: confirma solo si el anterior está confirmado', async () => {
    ok(await confirmarEstadosAction(ej2025, ctx.sociedadA))
    await db.ejercicioContable.update({ where: { id: ej2025 }, data: { estadosConfirmado: false } })
    await db.ejercicioContable.update({ where: { id: ej2024 }, data: { pnConfirmado: false } })
    const bloqueado = await confirmarEstadosAction(ej2025, ctx.sociedadA)
    expect(fail(bloqueado, 'NEG-030')).toMatch(/E\.E\.P\.N\./)
    const validaciones = await db.errorValidacion.findMany({
      where: { ejercicioId: ej2025, estado: 'ACTIVA' },
    })
    expect(validaciones.some((v) => v.tipo === 'CONSISTENCIA_EJERCICIO')).toBe(true)
    await db.ejercicioContable.update({ where: { id: ej2024 }, data: { pnConfirmado: true } })
    ok(await avanzarEstadoEjercicio(ej2025, ctx.sociedadA, 'BORRADOR', 'EN_PROCESO'))
    // Sin sus propios estados y E.E.P.N. confirmados no pasa a revisión: cerrado así, dejaría
    // trabado al ejercicio siguiente (exige su anterior confirmado y el cerrado no se modifica).
    const sinConfirmar = await avanzarEstadoEjercicio(
      ej2025,
      ctx.sociedadA,
      'EN_PROCESO',
      'REVISION',
    )
    expect(fail(sinConfirmar, 'NEG-004')).toMatch(/los estados contables/)
    ok(await confirmarEstadosAction(ej2025, ctx.sociedadA))
    ok(await confirmarPNAction(ej2025, ctx.sociedadA, true))
    // Pasar a revisión también pasa por la compuerta
    ok(await avanzarEstadoEjercicio(ej2025, ctx.sociedadA, 'EN_PROCESO', 'REVISION'))
  })

  it('no se puede borrar un ejercicio que es anterior de otro', async () => {
    const x = ok(
      await crearEjercicio(
        ctx.sociedadB,
        inputEjercicio({
          fechaInicio: '2023-01-01',
          fechaCierre: '2023-12-31',
          numeroEjercicio: '1',
        }),
      ),
    )
    const y = ok(
      await crearEjercicio(
        ctx.sociedadB,
        inputEjercicio({
          fechaInicio: '2024-01-01',
          fechaCierre: '2024-12-31',
          numeroEjercicio: '2',
          modoAnterior: 'VINCULADO',
          ejercicioAnteriorId: x.id,
        }),
      ),
    )
    expect(fail(await eliminarEjercicio(x.id, ctx.sociedadB), 'NEG-003')).toMatch(
      /lo usa como ejercicio anterior/,
    )
    ok(await eliminarEjercicio(y.id, ctx.sociedadB))
    ok(await eliminarEjercicio(x.id, ctx.sociedadB))
  })
})

// ─── Escenario B: historial vacío (MANUAL) ────────────────────────────────────

describe('Escenario B — saldos del ejercicio anterior cargados a mano', () => {
  let ejM = ''
  const caja = () => ctx.rubro.get('ACT-CTE-01')!
  const proveedores = () => ctx.rubro.get('PAS-CTE-01')!

  it('crea el ejercicio en modo MANUAL y bloquea la confirmación sin autorización', async () => {
    const e = ok(await crearEjercicio(ctx.sociedadB, inputEjercicio({ modoAnterior: 'MANUAL' })))
    ejM = e.id
    expect(e.modoAnterior).toBe('MANUAL')
    expect(e.ejercicioAnteriorId).toBeNull()
    await cargarCuentas(ejM, [
      ['ACT-CTE-01', 'Caja', 500_000],
      ['PAS-CTE-01', 'Proveedores', -200_000],
      ['PN-01', 'Capital social', -100_000],
      ['EERR-ING-01', 'Ventas', -400_000],
      ['EERR-GADM-01', 'Gastos', 200_000],
    ])
    expect(fail(await confirmarEstadosAction(ejM, ctx.sociedadB), 'NEG-030')).toMatch(
      /no fueron autorizados/,
    )
  })

  it('no autoriza si el ejercicio anterior no cuadra', async () => {
    ok(
      await guardarLoteComparativoAction(ejM, ctx.sociedadB, [
        {
          modulo: 'SSP',
          clave: caja(),
          label: 'Caja',
          valor: 400_000,
          esHuerfano: false,
          orden: 0,
        },
        {
          modulo: 'SSP',
          clave: proveedores(),
          label: 'Proveedores',
          valor: 150_000,
          esHuerfano: false,
          orden: 1,
        },
        {
          modulo: 'EERR',
          clave: 'INGRESOS',
          label: 'Ingresos',
          valor: 300_000,
          esHuerfano: false,
          orden: 0,
        },
        // Los gastos del anterior se cargan fila por fila en el Anexo III: la cuenta "Gastos"
        // está en Gastos de administración, así que el EERR anterior recibe 180.000 ahí.
        {
          modulo: 'GASTOS_FILA',
          clave: claveFilaAnterior('Gastos'),
          label: 'Gastos',
          valor: 180_000,
          esHuerfano: false,
          orden: 0,
        },
      ]),
    )
    // PN anterior = 0 → Activo 400.000 ≠ Pasivo 150.000 + PN 0
    expect(
      fail(await autorizarComparativoAction(ejM, ctx.sociedadB, 'Ana Pérez'), 'NEG-030'),
    ).toMatch(/no cuadra/)
  })

  it('autoriza cuando cuadra y el resultado anterior coincide entre EERR y E.E.P.N.', async () => {
    // PN anterior 250.000 (saldo inicio 130.000 + resultado 120.000 = 300.000 - 180.000)
    ok(
      await guardarEvolucionPNAction(
        ejM,
        ctx.sociedadB,
        filasPN({
          SALDO_INICIO: { capitalSuscripto: 100_000, totalAnterior: 130_000 },
          RESULTADO_EJERCICIO: { totalAnterior: 120_000 },
        }),
        200_000,
      ),
    )
    expect(fail(await autorizarComparativoAction(ejM, ctx.sociedadB, ''), 'FORM-001')).toMatch(
      /quién autoriza/,
    )
    ok(await autorizarComparativoAction(ejM, ctx.sociedadB, 'Ana Pérez'))
    const e = await findEjercicioById(ejM)
    expect(e?.comparativoAutorizadoPor).toBe('Ana Pérez')
    expect(e?.comparativoAutorizadoEn).not.toBeNull()
    ok(await confirmarEstadosAction(ejM, ctx.sociedadB))
  })

  it('editar la columna anterior anula la autorización y la confirmación', async () => {
    ok(
      await guardarLoteComparativoAction(ejM, ctx.sociedadB, [
        {
          modulo: 'SSP',
          clave: caja(),
          label: 'Caja',
          valor: 410_000,
          esHuerfano: false,
          orden: 0,
        },
      ]),
    )
    const e = await findEjercicioById(ejM)
    expect(e?.comparativoAutorizadoEn).toBeNull()
    expect(e?.estadosConfirmado).toBe(false)
    expect(fail(await confirmarEstadosAction(ejM, ctx.sociedadB), 'NEG-030')).toMatch(
      /autorizados|no cuadra/,
    )
  })

  it('cambiar a VINCULADO limpia los comparativos manuales y desconfirma', async () => {
    const anterior = ok(
      await crearEjercicio(
        ctx.sociedadB,
        inputEjercicio({
          fechaInicio: '2024-01-01',
          fechaCierre: '2024-12-31',
          numeroEjercicio: '1',
        }),
      ),
    )
    ok(
      await actualizarEjercicio(
        ejM,
        ctx.sociedadB,
        inputEjercicio({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: anterior.id }),
      ),
    )
    expect(await findComparativoByEjercicio(ejM)).toEqual([])
    const e = await findEjercicioById(ejM)
    expect(e?.modoAnterior).toBe('VINCULADO')
    expect(e?.comparativoAutorizadoEn).toBeNull()
    expect(e?.pnConfirmado).toBe(false)
    // Sin E.E.P.N. en el anterior: saldos de inicio editables con advertencia (bloqueo blando)
    const { pnData } = await cargarEstadosConPN(e!, await findCuentasByEjercicio(ejM))
    expect(pnData.bloqueo.saldoInicio).toBe(false)
    expect(pnData.advertencias[0]).toMatch(/no tiene Estado de Evolución/)
  })
})

// ─── Estado de Flujo de Efectivo ──────────────────────────────────────────────

describe('Estado de Flujo de Efectivo', () => {
  let soc = ''
  let ej2024 = ''
  let ej2025 = ''
  const linea = (f: Awaited<ReturnType<typeof findFlujo>>, concepto: string) =>
    f!.items.find((i) => i.concepto === concepto)!

  it('primer ejercicio: el cierre sale del balance aunque el cliente mande otro', async () => {
    soc = (
      await db.sociedad.create({
        data: {
          estudioId: ctx.estudioId,
          razonSocial: 'Flujo S.A.',
          cuit: `30${Date.now().toString().slice(-8)}4`,
        },
      })
    ).id
    ej2024 = ok(
      await crearEjercicio(
        soc,
        inputEjercicio({
          fechaInicio: '2024-01-01',
          fechaCierre: '2024-12-31',
          numeroEjercicio: '1',
        }),
      ),
    ).id
    await cargarCuentas(ej2024, CUENTAS_2024) // Caja 100.000
    ok(await crearItemFlujoAction(ej2024, soc, 'ACTIVIDADES_OPERATIVAS', 'Cobros por ventas'))
    ok(await crearItemFlujoAction(ej2024, soc, 'ACTIVIDADES_OPERATIVAS', 'Pagos a proveedores'))
    const f = (await findFlujo(ej2024))!
    ok(
      await guardarFlujoAction(ej2024, soc, {
        ...f,
        saldoInicial: 80_000, // primer ejercicio: editable
        saldoFinal: 999, // derivado: se ignora
        items: [
          { ...linea(f, 'Cobros por ventas'), importe: 200_000, importeAnterior: 5 },
          { ...linea(f, 'Pagos a proveedores'), importe: -180_000 },
        ],
      }),
    )
    const g = (await findFlujo(ej2024))!
    expect(g.saldoInicial).toBe(80_000)
    expect(g.saldoFinal).toBe(100_000)
    expect(linea(g, 'Cobros por ventas').importeAnterior).toBe(0) // sin comparativo
  })

  it('duplicados por sección se rechazan (mayúsculas y acentos no cuentan)', async () => {
    const r = await crearItemFlujoAction(ej2024, soc, 'ACTIVIDADES_OPERATIVAS', 'COBROS POR VENTAS')
    expect(fail(r, 'NEG-050')).toMatch(/Ya hay una línea/)
    ok(await crearItemFlujoAction(ej2024, soc, 'ACTIVIDADES_INVERSION', 'Cobros por ventas'))
    const f = (await findFlujo(ej2024))!
    const inv = f.items.find((i) => i.seccion === 'ACTIVIDADES_INVERSION')!
    // Renombrar al guardar tampoco puede duplicar.
    const r2 = await guardarFlujoAction(ej2024, soc, {
      ...f,
      items: f.items.map((i) =>
        i.id === inv.id ? { ...i, seccion: 'ACTIVIDADES_OPERATIVAS' as const } : i,
      ),
    })
    ok(r2) // la sección no se toma del cliente: sigue en inversión, sin duplicado
    expect((await findFlujo(ej2024))!.items.find((i) => i.id === inv.id)?.seccion).toBe(
      'ACTIVIDADES_INVERSION',
    )
    await db.flujoDeCajaItem.delete({ where: { id: inv.id } })
  })

  it('VINCULADO: inicio, cierre y columna anterior derivados; el cliente no los pisa', async () => {
    ok(await confirmarEstadosAction(ej2024, soc))
    ok(await confirmarPNAction(ej2024, soc, true))
    ok(await avanzarEstadoEjercicio(ej2024, soc, 'BORRADOR', 'EN_PROCESO'))
    ej2025 = ok(
      await crearEjercicio(
        soc,
        inputEjercicio({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: ej2024 }),
      ),
    ).id
    await cargarCuentas(
      ej2025,
      CUENTAS_2024.map(([c, n, v]) => [c, n, c === 'ACT-CTE-01' ? 150_000 : v]),
    )
    ok(await crearItemFlujoAction(ej2025, soc, 'ACTIVIDADES_OPERATIVAS', 'cobros por VENTAS'))
    const f = (await findFlujo(ej2025))!
    const ajeno = linea((await findFlujo(ej2024))!, 'Cobros por ventas')
    ok(
      await guardarFlujoAction(ej2025, soc, {
        ...f,
        saldoInicial: 1,
        saldoFinal: 2,
        saldoInicialAnterior: 3,
        saldoFinalAnterior: 4,
        items: [
          { ...f.items[0]!, importe: 300_000, importeAnterior: 999 },
          { ...ajeno, importe: 1 }, // línea de otro ejercicio: se ignora
        ],
      }),
    )
    const g = (await findFlujo(ej2025))!
    expect(g.saldoInicial).toBe(125_000) // caja 2024 100.000 × 1,25
    expect(g.saldoFinal).toBe(150_000)
    expect(g.saldoFinalAnterior).toBe(125_000)
    expect(g.saldoInicialAnterior).toBe(100_000) // inicio 2024 80.000 × 1,25
    expect(g.items).toHaveLength(1)
    expect(g.items[0]!.importeAnterior).toBe(250_000) // 200.000 × 1,25
    expect(linea((await findFlujo(ej2024))!, 'Cobros por ventas').importe).toBe(200_000)
  })

  it('VINCULADO: trae del anterior los conceptos que faltan con su importe derivado', async () => {
    const creados = ok(await traerConceptosAnteriorAction(ej2025, soc))
    expect(creados.map((c) => [c.concepto, c.importeAnterior])).toEqual([
      ['Pagos a proveedores', -225_000],
    ])
    expect(ok(await traerConceptosAnteriorAction(ej2025, soc))).toEqual([])
  })

  it('compuerta: un flujo que no cuadra bloquea los estados pero no el E.E.P.N.', async () => {
    // Variación 25.000; actividades 300.000 + 0 → no cuadra
    const r = await confirmarEstadosAction(ej2025, soc)
    expect(fail(r, 'NEG-030')).toMatch(/Flujo de Efectivo no cuadra/)
    ok(await confirmarPNAction(ej2025, soc, true))

    const f = (await findFlujo(ej2025))!
    ok(
      await guardarFlujoAction(ej2025, soc, {
        ...f,
        items: f.items.map((i) =>
          i.concepto === 'Pagos a proveedores' ? { ...i, importe: -275_000 } : i,
        ),
      }),
    )
    ok(await confirmarEstadosAction(ej2025, soc))
    // Cualquier cambio posterior en el flujo desconfirma los estados.
    const g = (await findFlujo(ej2025))!
    ok(await guardarFlujoAction(ej2025, soc, { ...g, modificacionesEjAnt: 0 }))
    expect((await findEjercicioById(ej2025))?.estadosConfirmado).toBe(false)
  })

  it('MANUAL: tocar la columna anterior anula la autorización; la actual no', async () => {
    const socM = await db.sociedad.create({
      data: {
        estudioId: ctx.estudioId,
        razonSocial: 'Flujo Manual S.R.L.',
        cuit: `30${Date.now().toString().slice(-8)}5`,
      },
    })
    const ejM = ok(await crearEjercicio(socM.id, inputEjercicio({ modoAnterior: 'MANUAL' }))).id
    await cargarCuentas(ejM, [['ACT-CTE-01', 'Caja', 500_000]])
    ok(await crearItemFlujoAction(ejM, socM.id, 'ACTIVIDADES_OPERATIVAS', 'Cobros por ventas'))
    const autorizar = () =>
      db.ejercicioContable.update({
        where: { id: ejM },
        data: { comparativoAutorizadoEn: new Date(), comparativoAutorizadoPor: 'Ana Pérez' },
      })
    await autorizar()

    const f = (await findFlujo(ejM))!
    ok(await guardarFlujoAction(ejM, socM.id, { ...f, items: [{ ...f.items[0]!, importe: 10 }] }))
    expect((await findEjercicioById(ejM))?.comparativoAutorizadoEn).not.toBeNull()

    const g = (await findFlujo(ejM))!
    ok(
      await guardarFlujoAction(ejM, socM.id, {
        ...g,
        items: [{ ...g.items[0]!, importeAnterior: 7 }],
      }),
    )
    expect((await findFlujo(ejM))!.items[0]!.importeAnterior).toBe(7)
    expect((await findEjercicioById(ejM))?.comparativoAutorizadoEn).toBeNull()

    await autorizar()
    const h = (await findFlujo(ejM))!
    ok(await guardarFlujoAction(ejM, socM.id, { ...h, saldoInicialAnterior: 50 }))
    expect((await findEjercicioById(ejM))?.comparativoAutorizadoEn).toBeNull()
  })
})
