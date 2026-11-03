/**
 * Integración (PostgreSQL real): una nota sin cuentas de este año se ubica como fila del Estado de
 * Resultados. Toma el total de la nota, entra en los subtotales de la columna anterior, se ajusta al
 * autorizar y la columna del ejercicio actual no cambia. Con los importes de un balance presentado.
 */
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
import { sumar } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'
import type { ActionResult } from '@/modules/errores/types'
import { agregarDocumentoManualAction } from '@/modules/documentos/actions/documento.actions'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import {
  autorizarComparativo,
  findEjercicioById,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { armarLineasEERR } from '@/modules/estados/domain/lineasEERR'
import { cargarEstadosConPN, totalesAnteriorSSP } from '@/modules/estados/services/estados.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import {
  actualizarDetalleAction,
  crearDetalleAction,
  generarNotasAutomaticasAction,
  ubicarNotaEnEERRAction,
  ubicarNotaEnSSPAction,
} from '@/modules/notas/actions/notas.actions'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'

const TITULO = 'Otros ingresos y egresos'
const ANTES_DE_LA_NOTA = 5_288_322.87
const SALDO_BANCO = 500

const ctx = {} as { estudioId: string; sociedadId: string; ejercicioId: string; notaId: string }

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

const ejercicio = async () => (await findEjercicioById(ctx.ejercicioId))!

async function estados() {
  return cargarEstadosConPN(await ejercicio(), await findCuentasByEjercicio(ctx.ejercicioId))
}

const ubicar = (debajoDe: string | null, resta = true) =>
  ubicarNotaEnEERRAction(ctx.notaId, ctx.ejercicioId, ctx.sociedadId, debajoDe, resta)

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Nota en Estado',
      cuit: `30${Date.now().toString().slice(-8)}6`,
      razonSocial: 'Estudio Nota en Estado',
      createdAt: new Date('2000-01-04T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Nota en Estado SA',
      cuit: `30${Date.now().toString().slice(-8)}7`,
    },
  })
  const rubro = await db.rubroBase.findFirstOrThrow({
    where: { estudioId: estudio.id, codigo: 'ACT-CTE-01' },
    select: { id: true },
  })
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
      indiceInflacionAnterior: '7694.0075',
      indiceInflacionActual: '10121.3715',
    }),
  )
  Object.assign(ctx, { estudioId: estudio.id, sociedadId: sociedad.id, ejercicioId: creado.id })
  await db.cuentaContable.create({
    data: {
      ejercicioId: creado.id,
      codigo: '1103',
      nombre: 'BCO NACION',
      rubroBaseId: rubro.id,
      saldoDeudor: SALDO_BANCO,
      saldoFinal: SALDO_BANCO,
      clasificadaManual: true,
    },
  })
  ok(await generarNotasAutomaticasAction(creado.id, sociedad.id))
  ok(
    await guardarLoteComparativoAction(creado.id, sociedad.id, [
      {
        modulo: 'EERR',
        clave: 'INGRESOS',
        label: 'Ingresos',
        valor: ANTES_DE_LA_NOTA,
        esHuerfano: false,
        orden: 0,
      },
    ]),
  )
  ok(await agregarDocumentoManualAction(creado.id, sociedad.id, 'NOTA', TITULO))
  ctx.notaId = (await findNotasByEjercicio(creado.id)).find((n) => n.titulo === TITULO)!.id
  const fila = ok(await crearDetalleAction(ctx.notaId, creado.id, sociedad.id, 0))
  ok(
    await actualizarDetalleAction(fila.id, creado.id, sociedad.id, {
      concepto: TITULO,
      importeAnterior: -316_904.13,
    }),
  )
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Nota como fila del Estado de Resultados', () => {
  it('para elegir aparece solo la nota sin cuentas de este año, con su total', async () => {
    const { notasParaUbicar, estadosData } = await estados()
    expect(notasParaUbicar).toEqual([
      expect.objectContaining({ id: ctx.notaId, titulo: TITULO, totalAnt: -316_904.13 }),
    ])
    expect(estadosData.eerr.resultadoAntesIGAnt).toBe(ANTES_DE_LA_NOTA)
  })

  it('con el +, entra en los subtotales de abajo y da lo del balance presentado', async () => {
    ok(await ubicar('RESULTADOS_FINANCIEROS'))
    const { eerr } = (await estados()).estadosData
    expect(eerr.utilidadBrutaAnt).toBe(ANTES_DE_LA_NOTA)
    expect(eerr.resultadoAntesIGAnt).toBe(4_971_418.74)
    expect(eerr.utilidadEjercicioAnt).toBe(4_971_418.74)
    expect(eerr.utilidadEjercicio).toBe(0)
    const lineas = armarLineasEERR(eerr)
    const i = lineas.findIndex((l) => l.clave === 'RESULTADOS_FINANCIEROS')
    expect(lineas[i + 1]).toMatchObject({ etiqueta: TITULO, valor: 0, valorAnt: -316_904.13 })
    expect((await estados()).notasParaUbicar).toEqual([])
  })

  it('si se elige que sume, cambia el signo y el resultado', async () => {
    ok(await ubicar('RESULTADOS_FINANCIEROS', false))
    const { eerr } = (await estados()).estadosData
    expect(eerr.lineasNota?.[0]?.totalAnt).toBe(316_904.13)
    expect(eerr.resultadoAntesIGAnt).toBe(5_605_227)
  })

  it('se saca y la nota sigue existiendo', async () => {
    ok(await ubicar(null))
    const { estadosData, notasParaUbicar } = await estados()
    expect(estadosData.eerr.lineasNota).toBeUndefined()
    expect(estadosData.eerr.resultadoAntesIGAnt).toBe(ANTES_DE_LA_NOTA)
    expect(notasParaUbicar?.map((n) => n.id)).toEqual([ctx.notaId])
    const guardada = (await findNotasByEjercicio(ctx.ejercicioId)).find((n) => n.id === ctx.notaId)
    expect(guardada?.lineaEerrResta).toBeNull()
  })

  it('agregarla anula la autorización y la confirmación: cambió el anterior', async () => {
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: {
        comparativoAutorizadoEn: new Date(),
        comparativoAutorizadoPor: 'Ana',
        estadosConfirmado: true,
      },
    })
    ok(await ubicar('RESULTADOS_FINANCIEROS'))
    const e = await ejercicio()
    expect(e.comparativoAutorizadoEn).toBeNull()
    expect(e.estadosConfirmado).toBe(false)
  })

  it('una nota de afuera no se puede ubicar', async () => {
    const r = await ubicarNotaEnEERRAction(
      '00000000-0000-7000-8000-000000000000',
      ctx.ejercicioId,
      ctx.sociedadId,
      'INGRESOS',
      false,
    )
    expect(r.ok).toBe(false)
  })

  it('una nota usada en un estado no se puede usar en el otro', async () => {
    const r = await ubicarNotaEnSSPAction(ctx.notaId, ctx.ejercicioId, ctx.sociedadId, {
      seccion: 'ACTIVO_CORRIENTE',
      debajoDe: null,
      resta: false,
    })
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-067')
    expect((await estados()).notasParaUbicar).toEqual([])
  })

  it('en el estado patrimonial va debajo del rubro y entra en el total del activo', async () => {
    ok(await ubicar(null))
    const antes = await estados()
    const activoAntes = totalesAnteriorSSP(antes.estadosData, antes.pnData).activo
    const banco = antes.estadosData.sspRubros.find((r) => r.seccionSSP === 'ACTIVO_CORRIENTE')!

    ok(
      await ubicarNotaEnSSPAction(ctx.notaId, ctx.ejercicioId, ctx.sociedadId, {
        seccion: 'ACTIVO_CORRIENTE',
        debajoDe: banco.id,
        resta: false,
      }),
    )
    const { estadosData, pnData, notasParaUbicar } = await estados()
    const i = estadosData.sspRubros.findIndex((r) => r.id === banco.id)
    expect(estadosData.sspRubros[i + 1]).toMatchObject({
      id: `nota:${ctx.notaId}`,
      seccionSSP: 'ACTIVO_CORRIENTE',
      displayValue: 0,
      displayValueAnt: 316_904.13,
    })
    expect(totalesAnteriorSSP(estadosData, pnData).activo).toBe(sumar(activoAntes, 316_904.13))
    expect(estadosData.eerr.lineasNota).toBeUndefined()
    expect(notasParaUbicar).toEqual([])

    const r = await ubicar('INGRESOS')
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-067')
  })

  it('la base no deja que una nota esté en los dos estados', async () => {
    await expect(
      db.notaEjercicio.update({
        where: { id: ctx.notaId },
        data: { lineaEerrDebajoDe: 'INGRESOS', lineaEerrResta: false },
      }),
    ).rejects.toThrow()
  })

  it('en el patrimonio neto no se ubica', async () => {
    const r = await ubicarNotaEnSSPAction(ctx.notaId, ctx.ejercicioId, ctx.sociedadId, {
      seccion: 'PATRIMONIO_NETO',
      debajoDe: null,
      resta: false,
    })
    expect(r.ok).toBe(false)
  })

  it('se saca del estado patrimonial y vuelve a estar disponible', async () => {
    ok(await ubicarNotaEnSSPAction(ctx.notaId, ctx.ejercicioId, ctx.sociedadId, null))
    const { estadosData, notasParaUbicar } = await estados()
    expect(estadosData.sspRubros.some((r) => r.notaFila)).toBe(false)
    expect(notasParaUbicar?.map((n) => n.id)).toEqual([ctx.notaId])
    ok(await ubicar('RESULTADOS_FINANCIEROS'))
  })

  it('al autorizar se ajusta, lo cargado se ve y ya no se cambia', async () => {
    await autorizarComparativo(ctx.ejercicioId, 'Ana', true)
    const { estadosData, cargado } = await estados()
    const fila = estadosData.eerr.lineasNota![0]!
    expect(formatCurrency(fila.totalAnt)).toBe('(416.883,45)')
    expect(cargado?.estadosData.eerr.lineasNota?.[0]?.totalAnt).toBe(-316_904.13)
    expect(cargado?.estadosData.eerr.resultadoAntesIGAnt).toBe(4_971_418.74)
    expect(estadosData.eerr.utilidadEjercicio).toBe(0)

    const r = await ubicar(null)
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-065')
  })

  it('sin carga manual no se ubica', async () => {
    await db.ejercicioContable.update({
      where: { id: ctx.ejercicioId },
      data: { modoAnterior: 'SIN_ANTERIOR', anteriorAjustadoEn: null },
    })
    const r = await ubicar(null)
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-012')
    expect((await estados()).estadosData.eerr.lineasNota).toBeUndefined()
  })
})
