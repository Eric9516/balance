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
import {
  actualizarEjercicio,
  avanzarEstadoEjercicio,
  crearEjercicio,
  eliminarEjercicio,
} from '@/modules/ejercicios/actions/ejercicio.actions'
import { calcularCierre, type BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import {
  crearBienDeUsoAction,
  eliminarBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import {
  crearAjusteTransicionAction,
  eliminarAjusteTransicionAction,
  guardarLoteAjustesTransicionAction,
} from '@/modules/transicion-rt54/actions/ajustes.actions'
import type { AjusteTransicionInput } from '@/modules/transicion-rt54/domain/types'
import {
  actualizarAuditor,
  desactivarAuditor,
  reactivarAuditor,
} from '@/modules/auditores/actions/auditor.actions'
import {
  actualizarSociedad,
  desactivarSociedad,
  reactivarSociedad,
} from '@/modules/sociedades/actions/sociedad.actions'
import {
  aceptarDocumentoAction,
  agregarDocumentoManualAction,
  eliminarDocumentoManualAction,
} from '@/modules/documentos/actions/documento.actions'
import { actualizarEstudio } from '@/modules/estudios/actions/estudio.actions'
import {
  actualizarCuentaAction,
  asignarRubroAction,
  asignarRubrosBulkAction,
  eliminarCuentaAction,
} from '@/modules/importaciones/actions/clasificacion.actions'
import type { CambiosCuenta } from '@/modules/importaciones/repository/cuentas.repository'
import {
  actualizarDetalleAction,
  actualizarNotaAction,
  crearDetalleAction,
  eliminarDetalleAction,
  eliminarNotaAction,
  guardarConfigNotaIAction,
} from '@/modules/notas/actions/notas.actions'
import type { CambiosDetalle, CambiosNota } from '@/modules/notas/repository/notas.repository'

const ctx = {} as {
  sociedadId: string
  ejercicioId: string
  otroEjercicioId: string
  /** Otra sociedad del mismo estudio, con un ejercicio al 31/12/2024. */
  otraSociedadId: string
  ejercicioOtraSociedadId: string
  /** Otro estudio de la misma base, con su sociedad y su ejercicio: nada de eso es del actual. */
  estudioAjenoId: string
  sociedadAjenaId: string
  ejercicioAjenoId: string
  auditorAjenoId: string
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

async function inputEjercicio(estudioId: string, cierre: string) {
  const auditor = await db.auditor.create({
    data: { estudioId, nombre: 'Ana', apellido: 'Pérez' },
  })
  return CreateEjercicioSchema.parse({
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
}

async function nuevoEjercicio(estudioId: string, cierre: string, sociedadId = ctx.sociedadId) {
  return createEjercicio(sociedadId, estudioId, await inputEjercicio(estudioId, cierre))
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
  const otraSociedad = await db.sociedad.create({
    data: {
      estudioId,
      razonSocial: 'Otra Sociedad SA',
      cuit: `34${Date.now().toString().slice(-8)}4`,
    },
  })
  ctx.otraSociedadId = otraSociedad.id
  ctx.ejercicioOtraSociedadId = (await nuevoEjercicio(estudioId, '2024-12-31', otraSociedad.id)).id

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
  const ejercicioAjeno = await nuevoEjercicio(ajeno.id, '2025-12-31', sociedadAjena.id)
  ctx.ejercicioAjenoId = ejercicioAjeno.id
  ctx.auditorAjenoId = ejercicioAjeno.auditorId!
})

afterAll(async () => {
  const sociedades = [ctx.sociedadId, ctx.otraSociedadId, ctx.sociedadAjenaId]
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

  it('no borra una partida de otro ejercicio', async () => {
    const ajena = ok(
      await crearAjusteTransicionAction(ctx.otroEjercicioId, ctx.sociedadId, partida('No borrar')),
    )
    const r = await eliminarAjusteTransicionAction(ajena.id, ctx.ejercicioId, ctx.sociedadId)
    expect(fallo(r)).toBe('TECH-002')
    expect(await db.ajusteTransicionRT54.findUnique({ where: { id: ajena.id } })).not.toBeNull()
  })
})

describe('Auditores', () => {
  it('no modifica un auditor de otro estudio', async () => {
    const r = await actualizarAuditor(ctx.auditorAjenoId, { nombre: 'Pisado', apellido: 'X' })
    expect(fallo(r)).toBe('TECH-002')
    const enBase = await db.auditor.findUniqueOrThrow({ where: { id: ctx.auditorAjenoId } })
    expect(enBase).toMatchObject({ nombre: 'Ana', apellido: 'Pérez' })
  })

  it('no desactiva ni reactiva un auditor de otro estudio', async () => {
    expect(fallo(await desactivarAuditor(ctx.auditorAjenoId))).toBe('TECH-002')
    const enBase = await db.auditor.findUniqueOrThrow({ where: { id: ctx.auditorAjenoId } })
    expect(enBase.activo).toBe(true)

    await db.auditor.update({ where: { id: ctx.auditorAjenoId }, data: { activo: false } })
    expect(fallo(await reactivarAuditor(ctx.auditorAjenoId))).toBe('TECH-002')
    const despues = await db.auditor.findUniqueOrThrow({ where: { id: ctx.auditorAjenoId } })
    expect(despues.activo).toBe(false)
  })
})

describe('Sociedades', () => {
  it('no modifica una sociedad de otro estudio', async () => {
    const r = await actualizarSociedad(ctx.sociedadAjenaId, {
      razonSocial: 'Pisada SA',
      cuit: '30-71234567-1',
      tipoPersona: 'JURIDICA',
      domicilioLegal: 'Calle 1',
      localidad: 'Rosario',
      provincia: 'Santa Fe',
      codigoPostal: '2000',
      actividadPpal: 'Servicios',
      categoriaEnte: 'PEQUENA',
      fechaInscripcion: '2020-01-01',
      matriculaPJ: '123',
      plazoDuracion: '2099-01-01',
    })
    expect(fallo(r)).toBe('TECH-002')
    const enBase = await db.sociedad.findUniqueOrThrow({ where: { id: ctx.sociedadAjenaId } })
    expect(enBase.razonSocial).toBe('Ajena SA')
  })

  it('no desactiva ni reactiva una sociedad de otro estudio', async () => {
    expect(fallo(await desactivarSociedad(ctx.sociedadAjenaId))).toBe('TECH-002')
    const enBase = await db.sociedad.findUniqueOrThrow({ where: { id: ctx.sociedadAjenaId } })
    expect(enBase.activo).toBe(true)

    await db.sociedad.update({ where: { id: ctx.sociedadAjenaId }, data: { activo: false } })
    expect(fallo(await reactivarSociedad(ctx.sociedadAjenaId))).toBe('TECH-002')
    const despues = await db.sociedad.findUniqueOrThrow({ where: { id: ctx.sociedadAjenaId } })
    expect(despues.activo).toBe(false)
    await db.sociedad.update({ where: { id: ctx.sociedadAjenaId }, data: { activo: true } })
  })
})

describe('Documentos del ejercicio', () => {
  it('no acepta ni agrega documentos en un ejercicio de otro estudio', async () => {
    const aceptar = await aceptarDocumentoAction(
      ctx.ejercicioAjenoId,
      ctx.sociedadAjenaId,
      'ANEXO_BIENES_USO',
    )
    expect(fallo(aceptar)).toBe('AUTH-001')
    const agregar = await agregarDocumentoManualAction(
      ctx.ejercicioAjenoId,
      ctx.sociedadAjenaId,
      'NOTA',
      'Ajeno',
    )
    expect(fallo(agregar)).toBe('AUTH-001')
    expect(
      await db.documentoEjercicio.count({ where: { ejercicioId: ctx.ejercicioAjenoId } }),
    ).toBe(0)
  })

  it('no borra un documento de otro ejercicio ni uno sugerido', async () => {
    const ajeno = ok(
      await agregarDocumentoManualAction(ctx.otroEjercicioId, ctx.sociedadId, 'NOTA', 'Otro'),
    )
    const r = await eliminarDocumentoManualAction(ctx.ejercicioId, ctx.sociedadId, ajeno.id)
    expect(fallo(r)).toBe('TECH-002')
    expect(await db.documentoEjercicio.findUnique({ where: { id: ajeno.id } })).not.toBeNull()

    const sugerido = ok(
      await aceptarDocumentoAction(ctx.ejercicioId, ctx.sociedadId, 'ANEXO_BIENES_USO'),
    )
    const r2 = await eliminarDocumentoManualAction(ctx.ejercicioId, ctx.sociedadId, sugerido.id)
    expect(fallo(r2)).toBe('TECH-002')
    expect(await db.documentoEjercicio.findUnique({ where: { id: sugerido.id } })).not.toBeNull()
  })
})

describe('Ejercicios', () => {
  it('no crea un ejercicio en una sociedad de otro estudio', async () => {
    const input = await inputEjercicio(await getCurrentEstudioId(), '2026-12-31')
    expect(fallo(await crearEjercicio(ctx.sociedadAjenaId, input))).toBe('TECH-002')
    expect(await db.ejercicioContable.count({ where: { sociedadId: ctx.sociedadAjenaId } })).toBe(1)
  })

  it('no acepta un auditor de otro estudio', async () => {
    const input = await inputEjercicio(await getCurrentEstudioId(), '2026-12-31')
    const r = await crearEjercicio(ctx.sociedadId, { ...input, auditorId: ctx.auditorAjenoId })
    expect(fallo(r)).toBe('FORM-001')
    expect(await db.ejercicioContable.count({ where: { auditorId: ctx.auditorAjenoId } })).toBe(1)
  })

  it('valida el ejercicio anterior contra la sociedad guardada y no contra la que manda la pantalla', async () => {
    const input = await inputEjercicio(await getCurrentEstudioId(), '2025-12-31')
    const r = await actualizarEjercicio(ctx.ejercicioId, ctx.otraSociedadId, {
      ...input,
      modoAnterior: 'VINCULADO',
      ejercicioAnteriorId: ctx.ejercicioOtraSociedadId,
    })
    expect(fallo(r)).toBe('NEG-010')
    const enBase = await db.ejercicioContable.findUniqueOrThrow({ where: { id: ctx.ejercicioId } })
    expect(enBase.ejercicioAnteriorId).toBeNull()
  })

  it('no cambia de estado ni borra un ejercicio de otro estudio', async () => {
    const avanzar = await avanzarEstadoEjercicio(
      ctx.ejercicioAjenoId,
      ctx.sociedadAjenaId,
      'BORRADOR',
      'EN_PROCESO',
    )
    expect(fallo(avanzar)).toBe('AUTH-001')
    expect(fallo(await eliminarEjercicio(ctx.ejercicioAjenoId, ctx.sociedadAjenaId))).toBe(
      'AUTH-001',
    )
    const enBase = await db.ejercicioContable.findUnique({ where: { id: ctx.ejercicioAjenoId } })
    expect(enBase?.estado).toBe('BORRADOR')
  })

  it('no reabre un ejercicio cerrado aunque la pantalla diga que está en borrador', async () => {
    await db.ejercicioContable.update({
      where: { id: ctx.otroEjercicioId },
      data: { estado: 'CERRADO' },
    })
    const r = await avanzarEstadoEjercicio(
      ctx.otroEjercicioId,
      ctx.sociedadId,
      'BORRADOR',
      'EN_PROCESO',
    )
    expect(fallo(r)).toBe('NEG-001')
    const enBase = await db.ejercicioContable.findUniqueOrThrow({
      where: { id: ctx.otroEjercicioId },
    })
    expect(enBase.estado).toBe('CERRADO')
    await db.ejercicioContable.update({
      where: { id: ctx.otroEjercicioId },
      data: { estado: 'BORRADOR' },
    })
  })
})

describe('Estudios', () => {
  it('no modifica otro estudio que el actual', async () => {
    const r = await actualizarEstudio(ctx.estudioAjenoId, {
      tipoPersona: 'JURIDICA',
      nombre: 'Pisado',
      cuit: '30-71234567-1',
      razonSocial: 'Pisado SA',
    })
    expect(fallo(r)).toBe('TECH-002')
    const enBase = await db.estudio.findUniqueOrThrow({ where: { id: ctx.estudioAjenoId } })
    expect(enBase.nombre).toBe('Estudio ajeno')
  })
})

describe('Clasificación de cuentas', () => {
  const cuenta = (ejercicioId: string, codigo: string) =>
    db.cuentaContable.create({ data: { ejercicioId, codigo, nombre: `Cuenta ${codigo}` } })

  it('guarda solo el nombre y los saldos aunque la pantalla mande otras columnas', async () => {
    const c = await cuenta(ctx.ejercicioId, '1.1.01')
    const manipulada = {
      saldoFinal: 1_234.5,
      ejercicioId: ctx.otroEjercicioId,
      codigo: '9.9.99',
    } as CambiosCuenta
    ok(await actualizarCuentaAction(c.id, manipulada, ctx.ejercicioId, ctx.sociedadId))

    const enBase = await db.cuentaContable.findUniqueOrThrow({ where: { id: c.id } })
    expect(enBase).toMatchObject({ ejercicioId: ctx.ejercicioId, codigo: '1.1.01' })
    expect(enBase.saldoFinal.toString()).toBe('1234.5')
  })

  it('no modifica, clasifica ni borra una cuenta de otro ejercicio', async () => {
    const ajena = await cuenta(ctx.otroEjercicioId, '1.1.02')
    const rubro = await db.rubroBase.findFirstOrThrow({ select: { id: true } })
    const args = [ctx.ejercicioId, ctx.sociedadId] as const

    expect(fallo(await actualizarCuentaAction(ajena.id, { nombre: 'Pisada' }, ...args))).toBe(
      'TECH-002',
    )
    expect(fallo(await asignarRubroAction(ajena.id, rubro.id, ...args))).toBe('TECH-002')
    ok(await asignarRubrosBulkAction([ajena.id], rubro.id, ...args))
    expect(fallo(await eliminarCuentaAction(ajena.id, ...args))).toBe('TECH-002')

    const enBase = await db.cuentaContable.findUniqueOrThrow({ where: { id: ajena.id } })
    expect(enBase).toMatchObject({ nombre: 'Cuenta 1.1.02', rubroBaseId: null })
  })
})

describe('Notas', () => {
  const nota = (ejercicioId: string, titulo: string) =>
    db.notaEjercicio.create({
      data: {
        ejercicioId,
        titulo,
        tipo: 'CUANTITATIVA',
        orden: 1,
        detalles: {
          create: { concepto: 'Caja', importeActual: 100, importeAnterior: 0, orden: 1 },
        },
      },
      include: { detalles: true },
    })

  it('guarda solo las columnas editables de la nota y del detalle', async () => {
    const propia = await nota(ctx.ejercicioId, 'CAJA Y BANCOS')
    const otra = await nota(ctx.ejercicioId, 'CRÉDITOS')
    const args = [ctx.ejercicioId, ctx.sociedadId] as const

    const cambiosNota = { textoApertura: 'Nuevo', ejercicioId: ctx.otroEjercicioId, orden: 99 }
    ok(await actualizarNotaAction(propia.id, ...args, cambiosNota as CambiosNota))
    const cambiosDetalle = {
      importeAnterior: 250.75,
      importeActual: 999, // sale del balance: la pantalla no lo cambia
      notaEjercicioId: otra.id,
      esTotal: true,
    }
    ok(
      await actualizarDetalleAction(
        propia.detalles[0]!.id,
        ...args,
        cambiosDetalle as CambiosDetalle,
      ),
    )

    const enBase = await db.notaEjercicio.findUniqueOrThrow({
      where: { id: propia.id },
      include: { detalles: true },
    })
    expect(enBase).toMatchObject({ ejercicioId: ctx.ejercicioId, orden: 1, textoApertura: 'Nuevo' })
    expect(enBase.detalles).toHaveLength(1)
    expect(enBase.detalles[0]!.esTotal).toBe(false)
    expect(enBase.detalles[0]!.importeAnterior.toString()).toBe('250.75')
    expect(enBase.detalles[0]!.importeActual.toString()).toBe('100')
  })

  it('no modifica ni borra notas o detalles de otro ejercicio', async () => {
    const ajena = await nota(ctx.otroEjercicioId, 'AJENA')
    const detalleId = ajena.detalles[0]!.id
    const args = [ctx.ejercicioId, ctx.sociedadId] as const

    expect(fallo(await actualizarNotaAction(ajena.id, ...args, { textoApertura: 'x' }))).toBe(
      'TECH-002',
    )
    expect(fallo(await crearDetalleAction(ajena.id, ...args, 2))).toBe('TECH-002')
    expect(fallo(await actualizarDetalleAction(detalleId, ...args, { concepto: 'x' }))).toBe(
      'TECH-002',
    )
    expect(fallo(await eliminarDetalleAction(detalleId, ...args))).toBe('TECH-002')
    expect(fallo(await eliminarNotaAction(ajena.id, ...args))).toBe('TECH-002')

    const enBase = await db.notaEjercicio.findUniqueOrThrow({
      where: { id: ajena.id },
      include: { detalles: true },
    })
    expect(enBase.textoApertura).toBeNull()
    expect(enBase.detalles.map((d) => d.concepto)).toEqual(['Caja'])
  })

  it('la configuración de la Nota I no toca otras columnas del ejercicio', async () => {
    const manipulada = {
      adopcionRT54: 'APLICACION_CONTINUADA',
      estado: 'CERRADO',
      estadosConfirmado: true,
    } as Parameters<typeof guardarConfigNotaIAction>[2]
    ok(await guardarConfigNotaIAction(ctx.ejercicioId, ctx.sociedadId, manipulada))

    const enBase = await db.ejercicioContable.findUniqueOrThrow({ where: { id: ctx.ejercicioId } })
    expect(enBase).toMatchObject({
      adopcionRT54: 'APLICACION_CONTINUADA',
      estado: 'BORRADOR',
      estadosConfirmado: false,
    })
  })
})
