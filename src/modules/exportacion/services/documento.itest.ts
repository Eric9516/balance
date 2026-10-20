/**
 * Integración (PostgreSQL real): el documento imprimible muestra exactamente lo que
 * calculan los servicios de estados, E.E.P.N., flujo y compuerta, e incluye solo
 * los anexos aceptados.
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
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import type { CreateEjercicioInput } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { evaluarAutorizacionSinPersistir } from '@/modules/ejercicios/services/autorizacion.service'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { sumarSecciones, SSP_STRUCTURE } from '@/modules/estados/domain/estructuraSSP'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { guardarTodoCostoVentasAction } from '@/modules/costo-ventas/actions/costo-ventas.actions'
import { guardarEvolucionPNAction } from '@/modules/patrimonio-neto/actions/patrimonio-neto.actions'
import { PN_MOVIMIENTOS, type EvolucionPNInput } from '@/modules/patrimonio-neto/domain/types'
import { cargarDocumentoBalance } from './documento.service'

type Ctx = { estudioId: string; auditorId: string; sociedadId: string; rubro: Map<string, string> }
const ctx = {} as Ctx

function inputEjercicio(partial: Partial<CreateEjercicioInput>): CreateEjercicioInput {
  return {
    fechaInicio: '2025-01-01',
    fechaCierre: '2025-12-31',
    denominacion: '',
    numeroEjercicio: '3',
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

/** E.E.P.N.: saldo al inicio con capital 200.000 y resultados no asignados 30.000. */
function filasPN(): EvolucionPNInput[] {
  return PN_MOVIMIENTOS.map((m) => ({
    tipo: m.tipo,
    orden: m.orden,
    capitalSuscripto: m.tipo === 'SALDO_INICIO' ? 200_000 : 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: m.tipo === 'SALDO_INICIO' ? 30_000 : 0,
    totalAnterior: 0,
  }))
}

function ok<T>(
  r: { ok: true; data: T } | { ok: false; error: { codigo: string; mensaje: string } },
): T {
  if (!r.ok) throw new Error(`Esperaba ok y vino ${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

// Activo 780 = Pasivo 390 + PN 390 (capital 200 + rdos 30 + resultado 160)
const CUENTAS: [string, string, number][] = [
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

beforeAll(async () => {
  // El más antiguo, para que sea el estudio actual (el primero activo) mientras corre este archivo:
  // crearEjercicio exige que la sociedad y el auditor sean del estudio actual. Otros archivos de
  // pruebas pueden dejar estudios creados antes.
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Doc',
      cuit: `30${Date.now().toString().slice(-8)}4`,
      razonSocial: 'Estudio Doc',
      createdAt: new Date('2000-01-01T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: {
      estudioId: estudio.id,
      nombre: 'Ana',
      apellido: 'Pérez',
      esDefault: true,
      textoFirma: 'Ana Pérez\nContadora Pública\nMat. 10.1234.5',
    },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Impresora S.A.',
      cuit: `30${Date.now().toString().slice(-8)}5`,
    },
  })
  const rubros = await db.rubroBase.findMany({ select: { id: true, codigo: true } })
  Object.assign(ctx, {
    estudioId: estudio.id,
    auditorId: auditor.id,
    sociedadId: sociedad.id,
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

describe('cargarDocumentoBalance', () => {
  let ejercicioId = ''

  it('devuelve null si el ejercicio no existe', async () => {
    expect(await cargarDocumentoBalance('no-existe')).toBeNull()
  })

  it('muestra los mismos totales que los servicios de estados y sin anexos no aceptados', async () => {
    const e = ok(await crearEjercicio(ctx.sociedadId, inputEjercicio({})))
    ejercicioId = e.id
    await cargarCuentas(ejercicioId, CUENTAS)
    ok(await guardarEvolucionPNAction(ejercicioId, ctx.sociedadId, filasPN(), 160_000))

    const doc = await cargarDocumentoBalance(ejercicioId)
    expect(doc).not.toBeNull()
    if (!doc) return

    expect(doc.secciones.map((s) => s.tipo)).toEqual([
      'caratula',
      'ssp',
      'eerr',
      'eepn',
      'flujo',
      'notas',
      'pendiente',
      'pendiente',
    ])
    expect(doc.columnas.mostrarAnterior).toBe(false)
    expect(doc.encabezado.linea).toBe('Estados contables al 31/12/2025 · Ejercicio económico N° 3')
    expect(doc.firmas.auditor?.lineas).toEqual(['Ana Pérez', 'Contadora Pública', 'Mat. 10.1234.5'])

    // Mismos números que la pantalla de Estados.
    const ejercicio = (await findEjercicioById(ejercicioId))!
    const estados = await cargarEstadosConPN(ejercicio, await findCuentasByEjercicio(ejercicioId))
    const ssp = doc.secciones.find((s) => s.tipo === 'ssp')
    if (ssp?.tipo !== 'ssp') throw new Error('sin SSP')
    const activo = sumarSecciones(ssp.estados.sspRubros, SSP_STRUCTURE[0].sections, 'actual')
    expect(activo).toBe(780_000)
    expect(ssp.estados.patrimonioNetoFinal).toBe(estados.pnData.totalActual)
    expect(ssp.estados.patrimonioNetoFinal).toBe(390_000)

    const eerr = doc.secciones.find((s) => s.tipo === 'eerr')
    if (eerr?.tipo !== 'eerr') throw new Error('sin EERR')
    expect(eerr.lineas.at(-1)?.valor).toBe(estados.estadosData.eerr.utilidadEjercicio)
    expect(eerr.lineas.at(-1)?.valor).toBe(160_000)

    // Compuerta: primer ejercicio sin flujo cargado → solo advertencias, no borrador.
    const evaluacion = await evaluarAutorizacionSinPersistir(ejercicio)
    expect(evaluacion.bloqueantes).toHaveLength(0)
    expect(doc.borrador.es).toBe(false)
    expect(doc.advertencias.some((a) => a.includes('Flujo de Efectivo'))).toBe(true)
  })

  it('incluye el Anexo II cuando está aceptado y cargado, y el EERR lo referencia', async () => {
    ok(
      await guardarTodoCostoVentasAction(ejercicioId, ctx.sociedadId, {
        existenciaInicial: 150_000,
        compras: 530_000,
        gastosFabricacion: 0,
        existenciaFinal: 180_000,
      }),
    )
    await db.documentoEjercicio.create({
      data: {
        ejercicioId,
        reglaClave: 'ANEXO_COSTO_VENTAS',
        tipo: 'ANEXO',
        titulo: 'Anexo de Costo de Ventas',
        estado: 'ACEPTADO',
      },
    })
    const doc = (await cargarDocumentoBalance(ejercicioId))!
    const anexo = doc.secciones.find((s) => s.tipo === 'anexo-costo-ventas')
    if (anexo?.tipo !== 'anexo-costo-ventas') throw new Error('sin Anexo II')
    expect(anexo.anexo.datos?.compras).toBe(530_000)
    const eerr = doc.secciones.find((s) => s.tipo === 'eerr')
    if (eerr?.tipo !== 'eerr') throw new Error('sin EERR')
    expect(eerr.lineas[1]?.etiqueta).toContain('(Anexo II)')
    expect(eerr.lineas[1]?.valor).toBe(500_000)
  })

  it('en carga manual sin autorizar sale en borrador con columna comparativa', async () => {
    const e = ok(
      await crearEjercicio(
        ctx.sociedadId,
        inputEjercicio({
          fechaInicio: '2026-01-01',
          fechaCierre: '2026-12-31',
          numeroEjercicio: '4',
          modoAnterior: 'MANUAL',
        }),
      ),
    )
    await cargarCuentas(e.id, CUENTAS)
    const doc = (await cargarDocumentoBalance(e.id))!
    expect(doc.columnas).toMatchObject({ mostrarAnterior: true, anteriorManual: true })
    expect(doc.columnas.fechaCierreAnterior?.toISOString()).toBe('2025-12-31T00:00:00.000Z')
    expect(doc.borrador.es).toBe(true)
    expect(doc.borrador.motivos.some((m) => m.includes('no fueron autorizados'))).toBe(true)
  })
})
