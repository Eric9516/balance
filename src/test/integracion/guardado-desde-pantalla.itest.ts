/**
 * Integración (PostgreSQL real): el servidor guarda SOLO las columnas que carga el usuario. Nunca
 * copia el objeto que manda la pantalla, que puede traer campos calculados (Prisma los rechaza y el
 * usuario ve "Error de base de datos") o, en una petición manipulada, otro ejercicio u otro orden.
 *
 * Tampoco modifica ni borra por identificador una fila que no sea del ejercicio o del estudio
 * actual: una petición manipulada puede mandar el identificador de una fila ajena.
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
import { getCurrentEstudioId } from '@/lib/estudio-context'
import type { ActionResult } from '@/modules/errores/types'
import { CreateEjercicioSchema } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import { createEjercicio } from '@/modules/ejercicios/repository/ejercicio.repository'
import { calcularCierre, type BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import {
  crearBienDeUsoAction,
  eliminarBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import {
  crearAjusteTransicionAction,
  guardarLoteAjustesTransicionAction,
} from '@/modules/transicion-rt54/actions/ajustes.actions'
import type { AjusteTransicionInput } from '@/modules/transicion-rt54/domain/types'

const ctx = {} as {
  sociedadId: string
  ejercicioId: string
  otroEjercicioId: string
  /** Otro estudio de la misma base, con su sociedad y su ejercicio: nada de eso es del actual. */
  estudioAjenoId: string
  sociedadAjenaId: string
  ejercicioAjenoId: string
}

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

/** Código del error de una acción que tiene que fallar. */
function fallo<T>(r: ActionResult<T>): string {
  if (r.ok) throw new Error('La acción tenía que fallar y respondió bien')
  return r.error.codigo
}

async function nuevoEjercicio(estudioId: string, cierre: string, sociedadId = ctx.sociedadId) {
  const auditor = await db.auditor.create({
    data: { estudioId, nombre: 'Ana', apellido: 'Pérez' },
  })
  const input = CreateEjercicioSchema.parse({
    fechaInicio: `${Number(cierre.slice(0, 4))}-01-01`,
    fechaCierre: cierre,
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: auditor.id,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: `${Number(cierre.slice(0, 4)) + 1}-03-15`,
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '125',
  })
  return createEjercicio(sociedadId, estudioId, input)
}

beforeAll(async () => {
  // Las acciones trabajan sobre el estudio actual (el primero activo): si la base está vacía, se crea.
  if (!(await db.estudio.findFirst({ where: { activo: true } }))) {
    const cuit = `34${Date.now().toString().slice(-8)}1`
    await db.estudio.create({ data: { nombre: 'Estudio BDU', cuit, razonSocial: 'Estudio BDU' } })
  }
  const estudioId = await getCurrentEstudioId()
  const sociedad = await db.sociedad.create({
    data: {
      estudioId,
      razonSocial: 'Bienes de Uso SA',
      cuit: `34${Date.now().toString().slice(-8)}0`,
    },
  })
  ctx.sociedadId = sociedad.id
  ctx.ejercicioId = (await nuevoEjercicio(estudioId, '2025-12-31')).id
  ctx.otroEjercicioId = (await nuevoEjercicio(estudioId, '2024-12-31')).id

  // Creado después del actual: el estudio actual sigue siendo el primero activo.
  const ajeno = await db.estudio.create({
    data: {
      nombre: 'Estudio ajeno',
      cuit: `30${Date.now().toString().slice(-8)}2`,
      razonSocial: 'Estudio ajeno',
    },
  })
  expect(await getCurrentEstudioId()).not.toBe(ajeno.id)
  ctx.estudioAjenoId = ajeno.id
  const sociedadAjena = await db.sociedad.create({
    data: {
      estudioId: ajeno.id,
      razonSocial: 'Ajena SA',
      cuit: `30${Date.now().toString().slice(-8)}3`,
    },
  })
  ctx.sociedadAjenaId = sociedadAjena.id
  ctx.ejercicioAjenoId = (await nuevoEjercicio(ajeno.id, '2025-12-31', sociedadAjena.id)).id
})

afterAll(async () => {
  const sociedades = [ctx.sociedadId, ctx.sociedadAjenaId]
  await db.ejercicioContable.deleteMany({ where: { sociedadId: { in: sociedades } } })
  await db.sociedad.deleteMany({ where: { id: { in: sociedades } } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioAjenoId } })
})

describe('Anexo I — Bienes de uso', () => {
  it('guarda lo que manda la pantalla aunque traiga el neto residual calculado', async () => {
    const fila = ok(await crearBienDeUsoAction(ctx.ejercicioId, ctx.sociedadId, 'Muebles y útiles'))
    // Lo mismo que hace la pantalla al editar una celda: agrega al borrador los campos calculados.
    const editada = { ...fila, costoInicioReexpresado: 6_500_000, depEjercicio: 782_003.48 }
    const borrador = { ...editada, ...calcularCierre(editada) } as BienDeUsoDTO
    expect(borrador).toHaveProperty('netoResidual')

    const [guardada] = ok(
      await guardarLoteBienesAction(ctx.ejercicioId, ctx.sociedadId, [borrador]),
    )
    expect(guardada).toMatchObject({
      costoInicioReexpresado: 6_500_000,
      depEjercicio: 782_003.48,
      costoFinReexpresado: 6_500_000,
      depAcumFin: 782_003.48,
    })
  })

  it('no cambia el ejercicio, el orden ni los totales de cierre aunque la pantalla los mande', async () => {
    const fila = ok(await crearBienDeUsoAction(ctx.ejercicioId, ctx.sociedadId, 'Rodados'))
    const manipulada: BienDeUsoDTO = {
      ...fila,
      ejercicioId: ctx.otroEjercicioId,
      orden: 99,
      altas: 1_000,
      costoFinReexpresado: 123, // el cierre lo calcula el servidor
      depAcumFin: 456,
    }
    ok(await guardarLoteBienesAction(ctx.ejercicioId, ctx.sociedadId, [manipulada]))

    const enBase = await db.bienDeUsoCategoria.findUniqueOrThrow({ where: { id: fila.id } })
    expect(enBase.ejercicioId).toBe(ctx.ejercicioId)
    expect(enBase.orden).toBe(fila.orden)
    expect(enBase.altas.toString()).toBe('1000')
    expect(enBase.costoFinReexpresado.toString()).toBe('1000')
    expect(enBase.depAcumFin.toString()).toBe('0')
    expect(await findBienesDeUso(ctx.otroEjercicioId)).toEqual([])
  })

  it('no agrega categorías a un ejercicio de otro estudio', async () => {
    const r = await crearBienDeUsoAction(ctx.ejercicioAjenoId, ctx.sociedadAjenaId, 'Inmuebles')
    expect(fallo(r)).toBe('AUTH-001')
    expect(await findBienesDeUso(ctx.ejercicioAjenoId)).toEqual([])
  })

  it('no borra una categoría de otro ejercicio', async () => {
    const ajena = ok(
      await crearBienDeUsoAction(ctx.otroEjercicioId, ctx.sociedadId, 'Instalaciones'),
    )
    const r = await eliminarBienDeUsoAction(ajena.id, ctx.ejercicioId, ctx.sociedadId)
    expect(fallo(r)).toBe('TECH-002')
    expect(await db.bienDeUsoCategoria.findUnique({ where: { id: ajena.id } })).not.toBeNull()
  })
})

describe('Ajustes de transición a la RT 54', () => {
  const partida = (concepto: string): Omit<AjusteTransicionInput, 'orden'> => ({
    tipo: 'AJUSTE_MEDICION',
    concepto,
    descripcion: null,
    componentePN: 'RDOS_NO_ASIGNADOS',
    importePN: 1_500.25,
    importeResultadoAnterior: 0,
    rubroOrigen: null,
    rubroDestino: null,
    importeReclasificado: 0,
  })

  it('el alta ignora campos de más y el ejercicio que mande la pantalla', async () => {
    const manipulada = { ...partida('Alta'), ejercicioId: ctx.otroEjercicioId, extra: 'x' }
    const creada = ok(
      await crearAjusteTransicionAction(ctx.ejercicioId, ctx.sociedadId, manipulada),
    )
    expect(creada).toMatchObject({
      ejercicioId: ctx.ejercicioId,
      concepto: 'Alta',
      importePN: 1_500.25,
    })
  })

  it('el guardado en lote no toca una partida de otro ejercicio', async () => {
    const ajena = ok(
      await crearAjusteTransicionAction(ctx.otroEjercicioId, ctx.sociedadId, partida('Ajena')),
    )
    ok(
      await guardarLoteAjustesTransicionAction(ctx.ejercicioId, ctx.sociedadId, [
        { ...partida('Pisada'), orden: 1, id: ajena.id },
      ]),
    )
    const enBase = await db.ajusteTransicionRT54.findUniqueOrThrow({ where: { id: ajena.id } })
    expect(enBase).toMatchObject({ ejercicioId: ctx.otroEjercicioId, concepto: 'Ajena' })
  })
})
