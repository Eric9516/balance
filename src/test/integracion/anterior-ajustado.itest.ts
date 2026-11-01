/**
 * Integración (PostgreSQL real): el anterior cargado a mano se ajusta por inflación al autorizarlo.
 * Lo cargado no se pisa: se ve al lado y se corrige; un guardado de la pantalla nunca escribe un
 * valor ajustado; sin autorización no hay ajuste; el documento no muestra la columna de lo cargado.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))
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
import { conEstudio } from '@/lib/contexto-base'
import type { ActionResult } from '@/modules/errores/types'
import {
  autorizarComparativoAction,
  corregirAnteriorAction,
  crearEjercicio,
} from '@/modules/ejercicios/actions/ejercicio.actions'
import {
  autorizarComparativo,
  findEjercicioById,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import {
  actualizarDetalleAction,
  crearDetalleAction,
  generarNotasAutomaticasAction,
} from '@/modules/notas/actions/notas.actions'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { cargarNotas } from '@/modules/notas/services/notas.service'
import { guardarEvolucionPNAction } from '@/modules/patrimonio-neto/actions/patrimonio-neto.actions'
import { findMovimientosPN } from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import {
  crearItemFlujoAction,
  guardarFlujoAction,
} from '@/modules/flujo-efectivo/actions/flujo.actions'
import { findFlujo } from '@/modules/flujo-efectivo/repository/flujo.repository'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'

const ctx = {} as {
  estudioId: string
  sociedadId: string
  ejercicioId: string
  rubro: string
  detalleId: string
  itemFlujoId: string
}

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

const ejercicio = async () => (await findEjercicioById(ctx.ejercicioId))!

async function estados() {
  return cargarEstadosConPN(await ejercicio(), await findCuentasByEjercicio(ctx.ejercicioId))
}

const SIN_MOVIMIENTO = {
  orden: 0,
  capitalSuscripto: 0,
  ajusteCapital: 0,
  aportesIrrevocables: 0,
  reservaLegal: 0,
  otrasReservas: 0,
  rdosNoAsignados: 0,
}

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Ajuste',
      cuit: `30${Date.now().toString().slice(-8)}4`,
      razonSocial: 'Estudio Ajuste',
      createdAt: new Date('2000-01-02T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Ajuste SA',
      cuit: `30${Date.now().toString().slice(-8)}5`,
    },
  })
  const rubros = await db.rubroBase.findMany({
    where: { estudioId: estudio.id },
    select: { id: true, codigo: true },
  })
  const rubroNota = rubros.find((r) => r.codigo === 'ACT-CTE-01')!.id
  const creado = ok(
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
  Object.assign(ctx, {
    estudioId: estudio.id,
    sociedadId: sociedad.id,
    ejercicioId: creado.id,
    // Un rubro que solo existió en el anterior: su importe se escribe en el estado
    rubro: 'huerfano:1',
  })
  await db.cuentaContable.create({
    data: {
      ejercicioId: creado.id,
      codigo: '1103',
      nombre: 'BCO NACION',
      rubroBaseId: rubroNota,
      saldoDeudor: 500,
      saldoFinal: 500,
      clasificadaManual: true,
    },
  })
  ok(await generarNotasAutomaticasAction(creado.id, sociedad.id))
  const nota = (await findNotasByEjercicio(creado.id))[0]!
  const detalle = nota.detalles.find((d) => !d.esTotal)
  ctx.detalleId = detalle?.id ?? ok(await crearDetalleAction(nota.id, creado.id, sociedad.id, 0)).id
  ok(
    await actualizarDetalleAction(ctx.detalleId, creado.id, sociedad.id, { importeAnterior: 1000 }),
  )
  ok(
    await guardarLoteComparativoAction(creado.id, sociedad.id, [
      { modulo: 'SSP', clave: ctx.rubro, label: 'Rubro', valor: 800, esHuerfano: true, orden: 0 },
      {
        modulo: 'COSTO_VENTAS',
        clave: 'existenciaFinal',
        label: 'Existencia final',
        valor: 100,
        esHuerfano: false,
        orden: 1,
      },
      {
        modulo: 'COSTO_VENTAS',
        clave: 'compras',
        label: 'Compras',
        valor: 400,
        esHuerfano: false,
        orden: 0,
      },
    ]),
  )
  ok(
    await guardarEvolucionPNAction(
      creado.id,
      sociedad.id,
      [{ ...SIN_MOVIMIENTO, tipo: 'SALDO_INICIO', totalAnterior: 200 }],
      0,
    ),
  )
  ctx.itemFlujoId = ok(
    await crearItemFlujoAction(creado.id, sociedad.id, 'ACTIVIDADES_OPERATIVAS', 'Cobros'),
  ).id
  const flujo = (await findFlujo(creado.id))!
  ok(
    await guardarFlujoAction(creado.id, sociedad.id, {
      ...flujo,
      saldoInicialAnterior: 40,
      items: flujo.items.map((i) => ({ ...i, importeAnterior: 80 })),
    }),
  )
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Anterior cargado a mano', () => {
  it('sin autorizar se ve como se cargó', async () => {
    const { estadosData, cargado } = await estados()
    expect(estadosData.sspRubros.find((r) => r.id === ctx.rubro)?.displayValueAnt).toBe(800)
    expect(cargado).toBeNull()
    expect((await cargarNotas(await ejercicio()))[0]!.detalles[0]!.importeAnterior).toBe(1000)
  })

  it('sin índices no se puede autorizar', async () => {
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { indiceInflacionActual: null },
    })
    const r = await autorizarComparativoAction(ctx.ejercicioId, ctx.sociedadId, 'Ana')
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-064')
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { indiceInflacionActual: 125 },
    })
  })

  it('al autorizar, todo se ajusta y lo cargado se puede ver', async () => {
    // La compuerta completa la cubren guardado-desde-pantalla y la auditoría
    await autorizarComparativo(ctx.ejercicioId, 'Ana', true)
    const e = await ejercicio()
    expect(e.anteriorAjustadoEn).not.toBeNull()

    const { estadosData, pnData, cargado } = await estados()
    expect(estadosData.sspRubros.find((r) => r.id === ctx.rubro)?.displayValueAnt).toBe(1000)
    expect(cargado?.estadosData.sspRubros.find((r) => r.id === ctx.rubro)?.displayValueAnt).toBe(
      800,
    )

    const fila = (await cargarNotas(e))[0]!.detalles.find((d) => d.id === ctx.detalleId)!
    expect(fila.importeAnterior).toBe(1250)
    expect(fila.anteriorCargado).toBe(1000)

    expect(pnData.movimientos.find((m) => m.tipo === 'SALDO_INICIO')?.totalAnterior).toBe(250)
    expect(pnData.bloqueo.totalAnterior).toBe(true)
    expect(cargado?.pnData.movimientos.find((m) => m.tipo === 'SALDO_INICIO')?.totalAnterior).toBe(
      200,
    )

    const flujo = await cargarFlujo(e, estadosData)
    expect(flujo.guardado.saldoInicialAnterior).toBe(50)
    expect(flujo.guardado.items[0]!.importeAnterior).toBe(100)
    expect(flujo.cargado?.saldoInicialAnterior).toBe(40)
    expect(flujo.editarAnterior).toBe(false)
    // La columna anterior se ajusta; la del ejercicio actual, no
    expect(flujo.guardado.saldoFinalAnterior).toBe(1250)
    expect(flujo.guardado.saldoInicial).toBe(1000)
    expect(flujo.actual.variacionNeta).toBe(-500)
    expect(flujo.cargado?.saldoFinalAnterior).toBe(1000)

    const costo = await cargarCostoVentas(e)
    expect(costo.datosAnteriores?.compras).toBe(500)
    expect(costo.cargado?.anterior?.compras).toBe(400)
    expect(costo.datosAnteriores?.existenciaFinal).toBe(125)
    expect(costo.existenciaInicialDerivada).toBe(100)

    expect((await cargarGastos(e)).cargado).toBeDefined()
  })

  it('los guardados de la pantalla no pisan lo cargado con un valor ajustado', async () => {
    const r = await guardarLoteComparativoAction(ctx.ejercicioId, ctx.sociedadId, [
      { modulo: 'SSP', clave: ctx.rubro, label: 'Rubro', valor: 1, esHuerfano: true, orden: 0 },
    ])
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-065')

    // Lo que vuelve de la pantalla trae los valores ajustados
    ok(
      await guardarEvolucionPNAction(
        ctx.ejercicioId,
        ctx.sociedadId,
        [{ ...SIN_MOVIMIENTO, tipo: 'SALDO_INICIO', totalAnterior: 250 }],
        0,
      ),
    )
    const movs = await findMovimientosPN(ctx.ejercicioId)
    expect(movs.find((m) => m.tipo === 'SALDO_INICIO')?.totalAnterior).toBe(200)

    const flujo = (await findFlujo(ctx.ejercicioId))!
    ok(
      await guardarFlujoAction(ctx.ejercicioId, ctx.sociedadId, {
        ...flujo,
        saldoInicialAnterior: 50,
        items: flujo.items.map((i) => ({ ...i, importeAnterior: 100 })),
      }),
    )
    const guardado = (await findFlujo(ctx.ejercicioId))!
    expect(guardado.saldoInicialAnterior).toBe(40)
    expect(guardado.items[0]!.importeAnterior).toBe(80)

    ok(
      await actualizarDetalleAction(ctx.detalleId, ctx.ejercicioId, ctx.sociedadId, {
        importeAnterior: 1250,
      }),
    )
    const notas = await findNotasByEjercicio(ctx.ejercicioId)
    const fila = notas.flatMap((n) => n.detalles).find((d) => d.id === ctx.detalleId)
    expect(fila?.importeAnterior).toBe(1000)

    // Nada de eso anuló la autorización
    expect((await ejercicio()).anteriorAjustadoEn).not.toBeNull()
  })

  it('un asistente no puede ajustar, y la base no deja un ajuste sin autorización', async () => {
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { comparativoAutorizadoEn: null, comparativoAutorizadoPor: null },
    })
    await expect(
      conEstudio(
        ctx.estudioId,
        () =>
          db.ejercicioContable.update({
            where: { id: ctx.ejercicioId },
            data: { anteriorAjustadoEn: new Date(), comparativoAutorizadoEn: new Date() },
          }),
        { usuarioId: ctx.ejercicioId, rol: 'ASISTENTE' },
      ),
    ).rejects.toThrow(/asistente/)
    await expect(
      db.ejercicioContable.update({
        where: { id: ctx.ejercicioId },
        data: { anteriorAjustadoEn: new Date() },
      }),
    ).rejects.toThrow()
    await autorizarComparativo(ctx.ejercicioId, 'Ana', true)
  })

  it('corregir quita el ajuste y la autorización, y se vuelve a ver lo cargado', async () => {
    ok(await corregirAnteriorAction(ctx.ejercicioId, ctx.sociedadId))
    const e = await ejercicio()
    expect(e.anteriorAjustadoEn).toBeNull()
    expect(e.comparativoAutorizadoEn).toBeNull()
    expect(e.estadosConfirmado).toBe(false)
    const { estadosData, cargado } = await estados()
    expect(estadosData.sspRubros.find((r) => r.id === ctx.rubro)?.displayValueAnt).toBe(800)
    expect(cargado).toBeNull()
    ok(
      await guardarLoteComparativoAction(ctx.ejercicioId, ctx.sociedadId, [
        { modulo: 'SSP', clave: ctx.rubro, label: 'Rubro', valor: 900, esHuerfano: true, orden: 0 },
      ]),
    )
  })

  it('anular la autorización por cualquier camino quita el ajuste', async () => {
    await autorizarComparativo(ctx.ejercicioId, 'Ana', true)
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { comparativoAutorizadoEn: null },
    })
    expect((await ejercicio()).anteriorAjustadoEn).toBeNull()
  })

  it('el documento no usa la columna de lo cargado', () => {
    const carpeta = join(process.cwd(), 'src/modules/exportacion')
    const archivos = readdirSync(carpeta, { recursive: true, encoding: 'utf8' }).filter((a) =>
      /\.tsx?$/.test(a),
    )
    for (const a of archivos) {
      const texto = readFileSync(join(carpeta, a), 'utf8')
      expect(texto, a).not.toMatch(/ColumnaCargado|anteriorCargado|netoCargado/)
    }
  })
})
