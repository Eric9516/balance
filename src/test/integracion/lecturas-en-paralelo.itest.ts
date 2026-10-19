/**
 * Integración (PostgreSQL real) de las lecturas que se optimizaron para hacer menos viajes a la
 * base (ver docs/RENDIMIENTO.md): las relaciones se piden en paralelo en vez de con `include`,
 * y la cadena de anteriores es una sola consulta recursiva. Estas pruebas fijan que el resultado
 * sea exactamente el mismo que antes: contenido, orden y casos borde.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))

import { db } from '@/lib/db'
import {
  findCadenaAnterior,
  findEjercicioById,
  findEjerciciosBySociedad,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { findGastosDinamicos } from '@/modules/gastos/repository/gastos-dinamico.repository'

type Ctx = {
  sociedadId: string
  e1: string
  e2: string
  e3: string
  cicloX: string
  cicloY: string
  rubroA: { id: string; nombre: string }
  rubroGrupo: { id: string; nombre: string }
  grupoId: string
}
const ctx = {} as Ctx

const ejercicio = (estudioId: string, sociedadId: string, anio: number) => ({
  estudioId,
  sociedadId,
  fechaInicio: new Date(Date.UTC(anio, 0, 1)),
  fechaCierre: new Date(Date.UTC(anio, 11, 31)),
  denominacion: `Ejercicio ${anio}`,
})

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio lecturas',
      cuit: `30${Date.now().toString().slice(-8)}9`,
      razonSocial: 'Estudio lecturas',
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Lecturas SA',
      cuit: `30${Date.now().toString().slice(-8)}8`,
    },
  })
  const otra = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Ciclo SA',
      cuit: `30${Date.now().toString().slice(-8)}7`,
    },
  })

  const e1 = await db.ejercicioContable.create({ data: ejercicio(estudio.id, sociedad.id, 2023) })
  const e2 = await db.ejercicioContable.create({
    data: {
      ...ejercicio(estudio.id, sociedad.id, 2024),
      auditorId: auditor.id,
      modoAnterior: 'VINCULADO',
      ejercicioAnteriorId: e1.id,
    },
  })
  const e3 = await db.ejercicioContable.create({
    data: {
      ...ejercicio(estudio.id, sociedad.id, 2025),
      auditorId: auditor.id,
      modoAnterior: 'VINCULADO',
      ejercicioAnteriorId: e2.id,
    },
  })

  // Dos ejercicios que se apuntan entre sí (dato corrupto): la cadena tiene que cortar.
  const x = await db.ejercicioContable.create({ data: ejercicio(estudio.id, otra.id, 2020) })
  const y = await db.ejercicioContable.create({
    data: { ...ejercicio(estudio.id, otra.id, 2021), ejercicioAnteriorId: x.id },
  })
  await db.ejercicioContable.update({ where: { id: x.id }, data: { ejercicioAnteriorId: y.id } })

  // Un rubro de gastos de administración queda en su sección (legacy) y uno de comercialización
  // pasa a un grupo de gasto propio del estudio.
  const rubroDe = (seccionEERR: 'GASTOS_ADM' | 'GASTOS_COM') =>
    db.rubroBase.findFirstOrThrow({
      where: { seccionEERR, activo: true, rubroGrupoId: null },
      select: { id: true, nombre: true },
      orderBy: { orden: 'asc' },
    })
  const [rubroA, rubroGrupo] = await Promise.all([rubroDe('GASTOS_ADM'), rubroDe('GASTOS_COM')])
  const grupo = await db.rubroGrupo.create({
    data: { nombre: 'Gastos del personal', esGasto: true, aparecEnEERR: true, orden: 1 },
  })
  await db.rubroBase.update({ where: { id: rubroGrupo.id }, data: { rubroGrupoId: grupo.id } })

  Object.assign(ctx, {
    sociedadId: sociedad.id,
    e1: e1.id,
    e2: e2.id,
    e3: e3.id,
    cicloX: x.id,
    cicloY: y.id,
    rubroA,
    rubroGrupo,
    grupoId: grupo.id,
  })
})

afterAll(async () => {
  // El catálogo de rubros es compartido con las otras pruebas: se deja como estaba.
  if (!ctx.grupoId) return
  await db.rubroBase.updateMany({
    where: { rubroGrupoId: ctx.grupoId },
    data: { rubroGrupoId: null },
  })
  await db.rubroGrupo.delete({ where: { id: ctx.grupoId } }).catch(() => {})
})

describe('findCadenaAnterior (una consulta recursiva)', () => {
  it('devuelve los anteriores del más cercano al más lejano', async () => {
    expect(await findCadenaAnterior(ctx.e3)).toEqual([ctx.e2, ctx.e1])
    expect(await findCadenaAnterior(ctx.e2)).toEqual([ctx.e1])
  })

  it('sin anterior o con un id inexistente devuelve una lista vacía', async () => {
    expect(await findCadenaAnterior(ctx.e1)).toEqual([])
    expect(await findCadenaAnterior('no-existe')).toEqual([])
  })

  it('corta en el primer id repetido si hay un ciclo, igual que antes', async () => {
    expect(await findCadenaAnterior(ctx.cicloX)).toEqual([ctx.cicloY, ctx.cicloX])
    expect(await findCadenaAnterior(ctx.cicloY)).toEqual([ctx.cicloX, ctx.cicloY])
  })
})

describe('ejercicios con su auditor (en paralelo)', () => {
  it('findEjercicioById arma el nombre del auditor o null si no tiene', async () => {
    expect((await findEjercicioById(ctx.e3))?.auditorNombre).toBe('Pérez, Ana')
    expect((await findEjercicioById(ctx.e1))?.auditorNombre).toBeNull()
    expect(await findEjercicioById('no-existe')).toBeNull()
  })

  it('findEjerciciosBySociedad ordena por cierre descendente con el auditor de cada uno', async () => {
    const lista = await findEjerciciosBySociedad(ctx.sociedadId)
    expect(lista.map((e) => [e.id, e.auditorNombre])).toEqual([
      [ctx.e3, 'Pérez, Ana'],
      [ctx.e2, 'Pérez, Ana'],
      [ctx.e1, null],
    ])
  })
})

describe('findCuentasByEjercicio (rubros en paralelo)', () => {
  it('ordena por código y pone el nombre del rubro, o null si la cuenta no está clasificada', async () => {
    await db.cuentaContable.createMany({
      data: [
        { ejercicioId: ctx.e1, codigo: '3.01', nombre: 'Sin clasificar', saldoFinal: 1 },
        {
          ejercicioId: ctx.e1,
          codigo: '1.01',
          nombre: 'Uno',
          rubroBaseId: ctx.rubroA.id,
          saldoFinal: 2,
        },
        {
          ejercicioId: ctx.e1,
          codigo: '2.01',
          nombre: 'Dos',
          rubroBaseId: ctx.rubroGrupo.id,
          saldoFinal: 3,
        },
      ],
    })
    const cuentas = await findCuentasByEjercicio(ctx.e1)
    expect(cuentas.map((c) => [c.codigo, c.rubroNombre, c.saldoFinal])).toEqual([
      ['1.01', ctx.rubroA.nombre, 2],
      ['2.01', ctx.rubroGrupo.nombre, 3],
      ['3.01', null, 1],
    ])
  })
})

describe('findNotasByEjercicio (detalles en paralelo)', () => {
  it('ordena notas y detalles por orden, y una nota sin detalles queda con lista vacía', async () => {
    const segunda = await db.notaEjercicio.create({
      data: { ejercicioId: ctx.e2, titulo: 'Segunda', tipo: 'CUANTITATIVA', orden: 1 },
    })
    const primera = await db.notaEjercicio.create({
      data: { ejercicioId: ctx.e2, titulo: 'Primera', tipo: 'INFORMATIVA', orden: 0 },
    })
    await db.detalleNota.createMany({
      data: [
        { notaEjercicioId: segunda.id, orden: 1, concepto: 'B', importeActual: 20 },
        { notaEjercicioId: segunda.id, orden: 0, concepto: 'A', importeActual: 10 },
      ],
    })
    const notas = await findNotasByEjercicio(ctx.e2)
    expect(notas.map((n) => n.id)).toEqual([primera.id, segunda.id])
    expect(notas[0]!.detalles).toEqual([])
    expect(notas[1]!.detalles.map((d) => d.concepto)).toEqual(['A', 'B'])
  })
})

describe('findGastosDinamicos (rubros del catálogo en la misma oleada)', () => {
  it('agrupa por grupo de gasto y por sección, con el importe del ejercicio anterior', async () => {
    await db.cuentaContable.createMany({
      data: [
        {
          ejercicioId: ctx.e3,
          codigo: 'g1',
          nombre: 'Sueldos',
          rubroBaseId: ctx.rubroGrupo.id,
          saldoFinal: 100,
        },
        {
          ejercicioId: ctx.e3,
          codigo: 'l1',
          nombre: 'Papelería',
          rubroBaseId: ctx.rubroA.id,
          saldoFinal: 50,
        },
        {
          ejercicioId: ctx.e2,
          codigo: 'g1',
          nombre: 'Sueldos',
          rubroBaseId: ctx.rubroGrupo.id,
          saldoFinal: 80,
        },
        {
          ejercicioId: ctx.e2,
          codigo: 'l1',
          nombre: 'Papelería',
          rubroBaseId: ctx.rubroA.id,
          saldoFinal: 30,
        },
      ],
    })
    const { secciones } = await findGastosDinamicos(ctx.e3, ctx.e2)
    const grupo = secciones.find((s) => s.key === `grupo:${ctx.grupoId}`)
    const legacy = secciones.find((s) => s.key === 'legacy:GASTOS_ADM')
    expect(grupo?.filas.map((f) => [f.cuentaNombre, f.importe, f.importeAnterior])).toEqual([
      ['Sueldos', 100, 80],
    ])
    expect(legacy?.filas.map((f) => [f.cuentaNombre, f.importe, f.importeAnterior])).toEqual([
      ['Papelería', 50, 30],
    ])
  })
})
