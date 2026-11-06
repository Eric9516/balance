/**
 * Integración (PostgreSQL real): la propuesta del Estado de Flujo de Efectivo desde el balance y la
 * revisión del RECPAM (migración 20261106120000).
 *
 * - "Usar esta propuesta" pone las líneas de la app con los importes que calcula el servidor, adopta
 *   la línea que el contador ya había escrito con el mismo nombre y no toca las suyas.
 * - El RECPAM es la diferencia para que cierre y queda pendiente hasta que alguien lo revisa.
 * - La base pone quién lo revisó desde la sesión y no deja que un asistente lo haga.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import {
  aplicarPropuestaFlujoAction,
  cargarPropuestaFlujoAction,
  crearItemFlujoAction,
  guardarFlujoAction,
  revisarRecpamAction,
} from '@/modules/flujo-efectivo/actions/flujo.actions'
import { findFlujo } from '@/modules/flujo-efectivo/repository/flujo.repository'
import { SIN_ELECCIONES } from '@/modules/flujo-efectivo/domain/propuesta'
import { db } from '@/lib/db'
import { comoPlataforma, conEstudio } from '@/lib/contexto-base'
import { sesionDePruebas } from '@/lib/sesion'
import type { ActionResult } from '@/modules/errores/types'
import { restar } from '@/lib/importe'

const ctx = { estudio: '', sociedad: '', ejercicio: '', dueno: '', contador: '', asistente: '' }
const sesion = { usuarioId: '', rol: 'DUENO' as 'DUENO' | 'CONTADOR' | 'ASISTENTE' }

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`Esperaba ok y vino ${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

beforeAll(async () => {
  await comoPlataforma(async () => {
    const estudio = await db.estudio.create({
      data: {
        nombre: 'Flujo propuesta',
        cuit: '30917000001',
        razonSocial: 'Flujo propuesta',
        createdAt: new Date('2095-01-01T00:00:00Z'),
      },
    })
    const e = estudio.id
    ctx.estudio = e
    const usuario = (nombre: string, rol: 'DUENO' | 'CONTADOR' | 'ASISTENTE') =>
      db.usuario.create({
        data: { estudioId: e, nombre, email: `${rol.toLowerCase()}@flujo.test`, rol },
      })
    const [dueno, contador, asistente] = await Promise.all([
      usuario('Dueño', 'DUENO'),
      usuario('Contadora', 'CONTADOR'),
      usuario('Asistente', 'ASISTENTE'),
    ])
    ctx.dueno = dueno.id
    ctx.contador = contador.id
    ctx.asistente = asistente.id
    const sociedad = await db.sociedad.create({
      data: { estudioId: e, razonSocial: 'Sociedad flujo', cuit: '30917000002' },
    })
    ctx.sociedad = sociedad.id
    const ejercicio = await db.ejercicioContable.create({
      data: {
        estudioId: e,
        sociedadId: sociedad.id,
        fechaInicio: new Date('2025-01-01'),
        fechaCierre: new Date('2025-12-31'),
        denominacion: 'Ejercicio N° 1',
        numeroEjercicio: 1,
        modoAnterior: 'SIN_ANTERIOR',
      },
    })
    ctx.ejercicio = ejercicio.id

    // Primer ejercicio: caja 300, créditos 200, proveedores 100, ventas 800 y sueldos 400
    const rubro = async (codigo: string) =>
      (
        await db.rubroBase.findUniqueOrThrow({
          where: { estudioId_codigo: { estudioId: e, codigo } },
          select: { id: true },
        })
      ).id
    const cuentas: [string, string, string, number, number][] = [
      ['1.1', 'Caja', 'ACT-CTE-01', 300, 0],
      ['1.2', 'Deudores por ventas', 'ACT-CTE-03', 200, 0],
      ['2.1', 'Proveedores', 'PAS-CTE-01', 0, 100],
      ['4.1', 'Ventas', 'EERR-ING-01', 0, 800],
      ['5.1', 'Sueldos administración', 'EERR-GADM-01', 400, 0],
    ]
    for (const [codigo, nombre, cod, debe, haber] of cuentas) {
      await db.cuentaContable.create({
        data: {
          ejercicioId: ejercicio.id,
          codigo,
          nombre,
          rubroBaseId: await rubro(cod),
          saldoDeudor: debe,
          saldoAcreedor: haber,
          saldoFinal: restar(debe, haber),
        },
      })
    }
  })
  sesion.usuarioId = ctx.dueno
  sesionDePruebas(async () => ({
    usuarioId: sesion.usuarioId,
    estudioId: ctx.estudio,
    rol: sesion.rol,
    contrasenaProvisoria: false,
    faltaCodigo: false,
    codigoConfigurado: true,
  }))
})

afterAll(async () => {
  await comoPlataforma(async () => {
    await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedad } })
    await db.sociedad.deleteMany({ where: { id: ctx.sociedad } })
    await db.estudio.deleteMany({ where: { id: ctx.estudio } })
  })
})

const args = () => [ctx.ejercicio, ctx.sociedad] as const
const importeDe = async (origen: string) =>
  (await findFlujo(ctx.ejercicio))!.items.find((i) => i.origen === origen)?.importe

describe('Proponer el flujo desde el balance', () => {
  it('lee del balance lo que la propuesta necesita', async () => {
    const insumos = ok(await cargarPropuestaFlujoAction(ctx.ejercicio))
    expect(insumos.ingresos).toBe(800)
    expect(insumos.compras).toBeNull()
    expect(insumos.gastos.map((g) => [g.nombre, g.importe])).toEqual([
      ['Sueldos administración', 400],
    ])
    expect(insumos.rubros.find((r) => r.nombre === 'Caja y Bancos')?.motivoExcluido).toMatch(
      /efectivo/,
    )
  })

  it('usa la propuesta, adopta la línea del contador y no toca las suyas', async () => {
    // El contador ya había escrito los cobros y una línea propia
    ok(
      await crearItemFlujoAction(
        ...args(),
        'ACTIVIDADES_OPERATIVAS',
        'Cobros por ventas de bienes y servicios',
      ),
    )
    ok(await crearItemFlujoAction(...args(), 'ACTIVIDADES_OPERATIVAS', 'Pagos de intereses'))
    const f = (await findFlujo(ctx.ejercicio))!
    ok(
      await guardarFlujoAction(...args(), {
        ...f,
        items: f.items.map((i) =>
          i.concepto === 'Pagos de intereses' ? { ...i, importe: -10 } : i,
        ),
      }),
    )

    const g = ok(await aplicarPropuestaFlujoAction(...args(), SIN_ELECCIONES))
    const lineas = g.items.map((i) => [i.concepto, i.origen, i.importe])
    expect(lineas).toEqual([
      ['Cobros por ventas de bienes y servicios', 'COBROS_VENTAS', 800],
      ['Pagos al personal y cargas sociales', 'PAGOS_PERSONAL', -400],
      ['Disminución (aumento) de activos operativos', 'VARIACION_ACTIVOS', -200],
      ['Aumento (disminución) de pasivos operativos', 'VARIACION_PASIVOS', 100],
      ['Pagos de intereses', null, -10],
      // Variación 300 − (800 − 400 − 200 + 100 − 10) = 10
      [
        'Resultados financieros y por tenencia generados por el efectivo (incluye RECPAM)',
        'RECPAM',
        10,
      ],
    ])
    expect(g.recpamRevisado).toBeNull()
  })

  it('el importe lo calcula el servidor: la pantalla solo manda las elecciones', async () => {
    ok(
      await aplicarPropuestaFlujoAction(...args(), {
        ...SIN_ELECCIONES,
        tiposGasto: { otraCuenta: 'NO_ES_PAGO' },
        prestamosRecibidos: 50,
      }),
    )
    expect(await importeDe('PRESTAMOS_RECIBIDOS')).toBe(50)
    expect(await importeDe('RECPAM')).toBe(-40)
    // Volver a usarla pone al día las líneas de la app, sin duplicarlas
    ok(await aplicarPropuestaFlujoAction(...args(), SIN_ELECCIONES))
    const f = (await findFlujo(ctx.ejercicio))!
    expect(f.items.filter((i) => i.origen === 'COBROS_VENTAS')).toHaveLength(1)
    expect(await importeDe('PRESTAMOS_RECIBIDOS')).toBe(50) // no se cargó: no se toca
  })

  it('una elección inválida se rechaza', async () => {
    const r = await aplicarPropuestaFlujoAction(...args(), {
      ...SIN_ELECCIONES,
      tiposGasto: { x: 'CUALQUIERA' as never },
    })
    expect(r.ok).toBe(false)
  })
})

describe('Revisar el RECPAM', () => {
  it('un asistente no puede: ni desde la app ni directo en la base', async () => {
    sesion.usuarioId = ctx.asistente
    sesion.rol = 'ASISTENTE'
    const recpam = (await importeDe('RECPAM'))!
    expect((await revisarRecpamAction(...args(), recpam)).ok).toBe(false)
    sesion.usuarioId = ctx.dueno
    sesion.rol = 'DUENO'

    await expect(
      conEstudio(
        ctx.estudio,
        () =>
          db.flujoDeCajaEjercicio.update({
            where: { ejercicioId: ctx.ejercicio },
            data: { recpamRevisado: recpam },
          }),
        { usuarioId: ctx.asistente, rol: 'ASISTENTE' },
      ),
    ).rejects.toThrow(/asistente no puede dar por revisado el RECPAM/)
  })

  it('quién lo revisó lo pone la base desde la sesión, aunque se mande otro', async () => {
    const recpam = (await importeDe('RECPAM'))!
    await conEstudio(
      ctx.estudio,
      () =>
        db.flujoDeCajaEjercicio.update({
          where: { ejercicioId: ctx.ejercicio },
          data: { recpamRevisado: recpam, recpamRevisadoPor: ctx.dueno },
        }),
      { usuarioId: ctx.contador, rol: 'CONTADOR' },
    )
    const f = (await findFlujo(ctx.ejercicio))!
    expect(f.recpamRevisadoPor).toBe('Contadora')
    expect(f.recpamRevisadoEn).not.toBeNull()
  })

  it('el dueño lo revisa desde la app; un cambio en el balance lo deja pendiente', async () => {
    // En un pedido real la base sabe quién usa la app (sale de la sesión): acá se declara igual
    const recpam = (await importeDe('RECPAM'))!
    ok(
      await conEstudio(ctx.estudio, () => revisarRecpamAction(...args(), recpam), {
        usuarioId: ctx.dueno,
        rol: 'DUENO',
      }),
    )
    expect((await findFlujo(ctx.ejercicio))!.recpamRevisadoPor).toBe('Dueño')

    // Cambia la caja: el RECPAM cambia y ya no coincide con lo revisado
    await comoPlataforma(() =>
      db.cuentaContable.updateMany({
        where: { ejercicioId: ctx.ejercicio, codigo: '1.1' },
        data: { saldoDeudor: 310, saldoFinal: 310 },
      }),
    )
    const insumos = ok(await cargarPropuestaFlujoAction(ctx.ejercicio))
    expect(insumos.ingresos).toBe(800)
    const revisado = (await findFlujo(ctx.ejercicio))!.recpamRevisado
    const r = await revisarRecpamAction(...args(), revisado!)
    // Lo que se había revisado ya no es el RECPAM de ahora
    expect(!r.ok && r.error.codigo).toBe('NEG-071')
  })
})
