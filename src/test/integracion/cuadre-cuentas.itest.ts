/**
 * Integración (PostgreSQL real): corregir o borrar una cuenta en el paso Clasificar controla el
 * cuadre del balance de sumas y saldos en el servidor. Un cambio que lo descuadra (o agranda el
 * descuadre) no se guarda sin confirmar (NEG-069); confirmado, sí. Dos cambios a la vez no se
 * controlan cada uno sin ver el otro.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import {
  actualizarCuentaAction,
  eliminarCuentaAction,
} from '@/modules/importaciones/actions/clasificacion.actions'
import { db } from '@/lib/db'
import { comoPlataforma } from '@/lib/contexto-base'
import { sesionDePruebas } from '@/lib/sesion'
import { importe, restar, sumarPor } from '@/lib/importe'

const ctx = { estudio: '', sociedad: '', ejercicio: '', dueno: '' }

beforeAll(async () => {
  await comoPlataforma(async () => {
    const estudio = await db.estudio.create({
      data: {
        nombre: 'Cuadre de cuentas',
        cuit: '30916000001',
        razonSocial: 'Cuadre de cuentas',
        createdAt: new Date('2095-01-01T00:00:00Z'),
      },
    })
    ctx.estudio = estudio.id
    const sociedad = await db.sociedad.create({
      data: { estudioId: estudio.id, razonSocial: 'Sociedad cuadre', cuit: '30916000002' },
    })
    ctx.sociedad = sociedad.id
    const [ejercicio, dueno] = await Promise.all([
      db.ejercicioContable.create({
        data: {
          estudioId: estudio.id,
          sociedadId: sociedad.id,
          fechaInicio: new Date('2025-01-01'),
          fechaCierre: new Date('2025-12-31'),
          denominacion: 'Ejercicio 2025',
        },
      }),
      db.usuario.create({
        data: { estudioId: estudio.id, nombre: 'Dueño', email: 'dueno@cuadre.test', rol: 'DUENO' },
      }),
    ])
    ctx.ejercicio = ejercicio.id
    ctx.dueno = dueno.id
  })
  // Las acciones leen la sesión del pedido: en las pruebas, la de un dueño de este estudio.
  sesionDePruebas(async () => ({
    usuarioId: ctx.dueno,
    estudioId: ctx.estudio,
    rol: 'DUENO',
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

/** Un balance que cuadra: Caja 100 al debe, Capital 100 al haber y una cuenta en cero. */
const cuentas = { caja: '', capital: '', cero: '' }
beforeEach(async () => {
  await comoPlataforma(async () => {
    await db.cuentaContable.deleteMany({ where: { ejercicioId: ctx.ejercicio } })
    const crear = (codigo: string, nombre: string, debe: number, haber: number) =>
      db.cuentaContable.create({
        data: {
          ejercicioId: ctx.ejercicio,
          codigo,
          nombre,
          saldoDeudor: debe,
          saldoAcreedor: haber,
          saldoFinal: restar(debe, haber),
        },
        select: { id: true },
      })
    const [caja, capital, cero] = await Promise.all([
      crear('1.1', 'Caja', 100, 0),
      crear('3.1', 'Capital', 0, 100),
      crear('5.9', 'Sin movimiento', 0, 0),
    ])
    cuentas.caja = caja.id
    cuentas.capital = capital.id
    cuentas.cero = cero.id
  })
})

const args = () => [ctx.ejercicio, ctx.sociedad] as const

async function enBase() {
  return comoPlataforma(async () => {
    const filas = await db.cuentaContable.findMany({
      where: { ejercicioId: ctx.ejercicio },
      select: { id: true, saldoDeudor: true, saldoAcreedor: true },
    })
    return {
      ids: filas.map((f) => f.id),
      caja: importe(filas.find((f) => f.id === cuentas.caja)?.saldoDeudor),
      diferencia: restar(
        sumarPor(filas, (f) => f.saldoDeudor),
        sumarPor(filas, (f) => f.saldoAcreedor),
      ),
    }
  })
}

describe('Cambiar o borrar una cuenta controla el cuadre', () => {
  it('un centavo de más al debe, sin confirmar, no se guarda (NEG-069)', async () => {
    const r = await actualizarCuentaAction(
      cuentas.caja,
      { saldoDeudor: 100.01, saldoFinal: 100.01 },
      ...args(),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.codigo).toBe('NEG-069')
      expect(r.error.contexto).toEqual({ antes: 0, despues: 0.01 })
    }
    expect(await enBase()).toMatchObject({ caja: 100, diferencia: 0 })
  })

  it('confirmado en el cartel, se guarda aunque descuadre', async () => {
    const r = await actualizarCuentaAction(
      cuentas.caja,
      { saldoDeudor: 100.01, saldoFinal: 100.01 },
      ...args(),
      { aceptarDescuadre: true },
    )
    expect(r.ok && r.data.efecto).toMatchObject({ antes: 0, despues: 0.01, descuadra: true })
    expect(await enBase()).toMatchObject({ caja: 100.01, diferencia: 0.01 })
  })

  it('el cambio que lo vuelve a cuadrar se guarda sin preguntar', async () => {
    await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 150 }, ...args(), {
      aceptarDescuadre: true,
    })
    const r = await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 100 }, ...args())
    expect(r.ok && r.data.efecto).toMatchObject({ antes: 50, despues: 0, arregla: true })
  })

  it('si ya no cuadraba, achicar la diferencia no pregunta y agrandarla sí', async () => {
    await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 150 }, ...args(), {
      aceptarDescuadre: true,
    })
    expect((await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 120 }, ...args())).ok).toBe(
      true,
    )
    const peor = await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 130 }, ...args())
    expect(!peor.ok && peor.error.codigo).toBe('NEG-069')
    expect(await enBase()).toMatchObject({ caja: 120, diferencia: 20 })
  })

  it('cambiar solo el nombre no toca el cuadre', async () => {
    const r = await actualizarCuentaAction(cuentas.caja, { nombre: 'Caja chica' }, ...args())
    expect(r.ok && r.data.efecto).toBeNull()
  })

  it('borrar una cuenta con saldo pide confirmación; confirmado, la borra', async () => {
    const sinConfirmar = await eliminarCuentaAction(cuentas.capital, ...args())
    expect(!sinConfirmar.ok && sinConfirmar.error.codigo).toBe('NEG-069')
    expect((await enBase()).ids).toContain(cuentas.capital)

    const confirmado = await eliminarCuentaAction(cuentas.capital, ...args(), {
      aceptarDescuadre: true,
    })
    expect(confirmado.ok).toBe(true)
    expect(await enBase()).toMatchObject({ diferencia: 100 })
    expect((await enBase()).ids).not.toContain(cuentas.capital)
  })

  it('borrar una cuenta en cero no pregunta', async () => {
    expect((await eliminarCuentaAction(cuentas.cero, ...args())).ok).toBe(true)
  })

  it('dos cambios a la vez: el segundo ve el primero y no descuadra sin confirmar', async () => {
    // Debe 150 contra haber 100: cada cambio por separado lo arregla, los dos juntos no.
    await actualizarCuentaAction(cuentas.caja, { saldoDeudor: 150 }, ...args(), {
      aceptarDescuadre: true,
    })
    const [a, b] = await Promise.all([
      actualizarCuentaAction(cuentas.caja, { saldoDeudor: 100 }, ...args()),
      actualizarCuentaAction(cuentas.capital, { saldoAcreedor: 150 }, ...args()),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    const rechazado = a.ok ? b : a
    expect(!rechazado.ok && rechazado.error.codigo).toBe('NEG-069')
    expect((await enBase()).diferencia).toBe(0)
  })
})
