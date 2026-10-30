/**
 * Carga manual del ejercicio anterior: cada dato se tipea una sola vez (lo encontró `pnpm auditoria`).
 *  - Anexo II: la existencia final del año anterior se propone desde la nota de bienes de cambio y
 *    la existencia al comienzo sale de ella (también al guardar).
 *  - E.E.P.N.: el resultado del año anterior sale del estado de resultados anterior.
 *  - Primera aplicación RT 54: la fila "Modificación de saldos al inicio" acompaña a los ajustes de
 *    medición, salvo que el contador la haya cambiado a mano.
 *  - Anexo I: el neto del año anterior es el valor al comienzo menos la amortización al comienzo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import {
  actualizarDetalleAction,
  generarNotasAutomaticasAction,
  guardarConfigNotaIAction,
} from '@/modules/notas/actions/notas.actions'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import { guardarTodoCostoVentasAction } from '@/modules/costo-ventas/actions/costo-ventas.actions'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { guardarEvolucionPNAction } from '@/modules/patrimonio-neto/actions/patrimonio-neto.actions'
import {
  crearAjusteTransicionAction,
  guardarLoteAjustesTransicionAction,
} from '@/modules/transicion-rt54/actions/ajustes.actions'
import {
  crearBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'

const ctx = { estudioId: '', sociedadId: '', ej: '' }

function ok<T>(
  r: { ok: true; data: T } | { ok: false; error: { codigo: string; mensaje: string } },
): T {
  if (!r.ok) throw new Error(`Esperaba ok y vino ${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

const ejercicio = async () => (await findEjercicioById(ctx.ej))!
const estados = async () =>
  cargarEstadosConPN(await ejercicio(), await findCuentasByEjercicio(ctx.ej))
const filaPN = async (tipo: string) =>
  (await estados()).pnData.movimientos.find((m) => m.tipo === tipo)!

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Una Carga',
      cuit: '30666666661',
      razonSocial: 'Estudio Una Carga',
      createdAt: new Date('1997-01-01T00:00:00Z'),
    },
  })
  ctx.estudioId = estudio.id
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
  })
  ctx.sociedadId = (
    await db.sociedad.create({
      data: { estudioId: estudio.id, razonSocial: 'Una Carga S.A.', cuit: '30666666688' },
    })
  ).id
  ctx.ej = ok(
    await crearEjercicio(ctx.sociedadId, {
      fechaInicio: '2025-01-01',
      fechaCierre: '2025-12-31',
      denominacion: '',
      numeroEjercicio: '3',
      auditorId: auditor.id,
      modoAnterior: 'MANUAL',
      ejercicioAnteriorId: '',
      categoriaEnte: 'PEQUENA',
      fechaInformeAuditor: '2026-03-15',
      indiceInflacionAnterior: '100',
      indiceInflacionActual: '100',
    }),
  ).id
  const rubro = new Map(
    (
      await db.rubroBase.findMany({
        where: { estudioId: estudio.id },
        select: { id: true, codigo: true },
      })
    ).map((r) => [r.codigo, r.id]),
  )
  const cuentas: [string, string, number][] = [
    ['ACT-CTE-09', 'Mercaderías de reventa', 4_800_000],
    ['ACT-NCTE-09', 'Rodados', 3_600_000],
    ['PN-01', 'Capital social', -8_400_000],
    ['EERR-ING-01', 'Ventas', -1_000_000],
    ['EERR-CST-01', 'Costo de mercaderías vendidas', 1_000_000],
  ]
  await db.cuentaContable.createMany({
    data: cuentas.map(([r, nombre, saldo], i) => ({
      ejercicioId: ctx.ej,
      codigo: String(100 + i),
      nombre,
      rubroBaseId: rubro.get(r)!,
      saldoDeudor: saldo > 0 ? saldo : 0,
      saldoAcreedor: saldo < 0 ? -saldo : 0,
      saldoFinal: saldo,
      clasificadaManual: true,
    })),
  })
  ok(
    await guardarConfigNotaIAction(ctx.ej, ctx.sociedadId, {
      adopcionRT54: 'PRIMERA_ADOPCION',
      criteriosBienesCambio: 'COSTO_REPOSICION',
      hechosPosterioress: false,
      hechosPosterioressTexto: null,
    }),
  )
  ok(await generarNotasAutomaticasAction(ctx.ej, ctx.sociedadId))
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Anterior cargado a mano: cada dato una sola vez', () => {
  it('Anexo II: la existencia final anterior sale de la nota y la del comienzo, de ella', async () => {
    // El anterior de bienes de cambio se carga en su nota, cuenta por cuenta.
    const cuenta = (await findCuentasByEjercicio(ctx.ej)).find(
      (c) => c.nombre === 'Mercaderías de reventa',
    )!
    const nota = (await findNotasByEjercicio(ctx.ej)).find((n) => n.id === cuenta.notaEjercicioId)!
    const detalle = nota.detalles.find((d) => d.concepto === 'Mercaderías de reventa')!
    ok(
      await actualizarDetalleAction(detalle.id, ctx.ej, ctx.sociedadId, {
        importeAnterior: 4_200_000.5,
      }),
    )

    // En el Anexo II del año anterior solo se cargan la existencia inicial y las compras.
    ok(
      await guardarLoteComparativoAction(ctx.ej, ctx.sociedadId, [
        {
          modulo: 'COSTO_VENTAS',
          clave: 'existenciaInicial',
          label: 'EI',
          valor: 3_800_000,
          esHuerfano: false,
          orden: 0,
        },
        {
          modulo: 'COSTO_VENTAS',
          clave: 'compras',
          label: 'Compras',
          valor: 16_000_000,
          esHuerfano: false,
          orden: 1,
        },
      ]),
    )
    const cv = await cargarCostoVentas(await ejercicio())
    expect(cv.existenciaFinalAnteriorPropuesta).toBe(4_200_000.5)
    expect(cv.datosAnteriores?.existenciaFinal).toBe(4_200_000.5)
    expect(cv.existenciaInicialBloqueada).toBe(true)
    expect(cv.existenciaInicialDerivada).toBe(4_200_000.5)

    // La pantalla manda otra existencia inicial: se guarda la del año anterior.
    ok(
      await guardarTodoCostoVentasAction(ctx.ej, ctx.sociedadId, {
        existenciaInicial: 1,
        compras: 1_600_000,
        gastosFabricacion: 0,
        existenciaFinal: 4_800_000,
      }),
    )
    expect((await findCostoVentas(ctx.ej))?.existenciaInicial).toBe(4_200_000.5)
  })

  it('E.E.P.N.: el resultado del año anterior es el del estado de resultados anterior', async () => {
    ok(
      await guardarLoteComparativoAction(ctx.ej, ctx.sociedadId, [
        {
          modulo: 'EERR',
          clave: 'INGRESOS',
          label: 'Ingresos',
          valor: 26_000_000,
          esHuerfano: false,
          orden: 0,
        },
      ]),
    )
    const { estadosData, pnData } = await estados()
    // Costo anterior: 3.800.000 + 16.000.000 − 4.200.000,50 = 15.599.999,50.
    expect(estadosData.eerr.utilidadEjercicioAnt).toBe(10_400_000.5)
    expect(pnData.movimientos.find((m) => m.tipo === 'RESULTADO_EJERCICIO')?.totalAnterior).toBe(
      10_400_000.5,
    )
  })

  it('RT 54: la modificación al inicio acompaña a los ajustes, salvo que se cambie a mano', async () => {
    const ajuste = {
      tipo: 'AJUSTE_MEDICION' as const,
      concepto: 'Provisión para vacaciones',
      descripcion: null,
      componentePN: 'RDOS_NO_ASIGNADOS' as const,
      importePN: -150_000,
      importeResultadoAnterior: 0,
      rubroOrigen: null,
      rubroDestino: null,
      importeReclasificado: 0,
    }
    const creado = ok(await crearAjusteTransicionAction(ctx.ej, ctx.sociedadId, ajuste))
    expect((await filaPN('MODIFICACION_INICIO')).rdosNoAsignados).toBe(-150_000)

    // Cambia el ajuste: la fila lo acompaña.
    ok(
      await guardarLoteAjustesTransicionAction(ctx.ej, ctx.sociedadId, [
        { ...creado, importePN: -200_000.25 },
      ]),
    )
    expect((await filaPN('MODIFICACION_INICIO')).rdosNoAsignados).toBe(-200_000.25)

    // El contador la cambia a mano (por ejemplo, una corrección de error): ya no se toca.
    const { pnData, estadosData } = await estados()
    ok(
      await guardarEvolucionPNAction(
        ctx.ej,
        ctx.sociedadId,
        pnData.movimientos.map((m) =>
          m.tipo === 'MODIFICACION_INICIO' ? { ...m, rdosNoAsignados: -170_000 } : m,
        ),
        estadosData.eerr.utilidadEjercicio,
      ),
    )
    ok(await crearAjusteTransicionAction(ctx.ej, ctx.sociedadId, { ...ajuste, importePN: -1 }))
    expect((await filaPN('MODIFICACION_INICIO')).rdosNoAsignados).toBe(-170_000)
  })

  it('Anexo I: el neto anterior es el valor al comienzo menos la amortización al comienzo', async () => {
    const rodados = ok(await crearBienDeUsoAction(ctx.ej, ctx.sociedadId, 'Rodados'))
    ok(
      await guardarLoteBienesAction(ctx.ej, ctx.sociedadId, [
        {
          ...rodados,
          costoInicioReexpresado: 6_000_000,
          depAcumInicio: 1_800_000.75,
          depEjercicio: 599_999.25,
        },
      ]),
    )
    const bdu = await cargarBienesDeUso(await ejercicio())
    expect(bdu.netoAnteriorMap.get('Rodados')).toBe(4_199_999.25)
    const rubro = (await estados()).estadosData.sspRubros.find((r) => r.codigo === 'ACT-NCTE-09')
    expect(rubro?.displayValueAnt).toBe(4_199_999.25)
    expect(rubro?.anteriorDesdeDetalle).toMatchObject({ fuente: 'ANEXO_I', estado: 'CARGADO' })
  })
})
