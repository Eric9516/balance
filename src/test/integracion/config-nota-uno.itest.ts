/**
 * "Configurar Nota I": cada respuesta hace lo que explica su símbolo (?) en la pantalla
 * (src/modules/ayuda/domain/opciones.ts). El criterio de bienes de cambio cambia solo esa nota; con
 * hechos posteriores la nota lleva el texto escrito, que es obligatorio (NEG-007); con "No" se quita.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { guardarConfigNotaIAction } from '@/modules/notas/actions/notas.actions'
import { TITULO_HECHOS } from '@/modules/notas/domain/regeneracion'

const ctx = { estudioId: '', sociedadId: '', ej: '' }

const criterioDe = async (titulo: string) =>
  (
    await db.notaEjercicio.findFirstOrThrow({
      where: { ejercicioId: ctx.ej, titulo },
      select: { criterioMedicion: true },
    })
  ).criterioMedicion

const notaHechos = () =>
  db.notaEjercicio.findFirst({
    where: { ejercicioId: ctx.ej, titulo: TITULO_HECHOS },
    select: { textoApertura: true, numero: true },
  })

const configurar = (hechos: {
  hechosPosterioress: boolean
  hechosPosterioressTexto: string | null
}) =>
  guardarConfigNotaIAction(ctx.ej, ctx.sociedadId, {
    adopcionRT54: 'APLICACION_CONTINUADA',
    criteriosBienesCambio: 'COSTO_ADQUISICION',
    ...hechos,
  })

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Configuración Nota I',
      cuit: '30888888884',
      razonSocial: 'Estudio Configuración Nota I',
      createdAt: new Date('1995-01-01T00:00:00Z'),
    },
  })
  ctx.estudioId = estudio.id
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
  })
  ctx.sociedadId = (
    await db.sociedad.create({
      data: { estudioId: estudio.id, razonSocial: 'Configura S.A.', cuit: '30888888892' },
    })
  ).id
  const r = await crearEjercicio(ctx.sociedadId, {
    fechaInicio: '2025-01-01',
    fechaCierre: '2025-12-31',
    denominacion: '',
    numeroEjercicio: '3',
    auditorId: auditor.id,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2026-04-15',
    indiceInflacionAnterior: '100',
    indiceInflacionActual: '131.55',
  })
  if (!r.ok) throw new Error(r.error.mensaje)
  ctx.ej = r.data.id
  await db.notaEjercicio.createMany({
    data: [
      ['BIENES DE CAMBIO', 'costo de reposición'],
      ['BIENES INTANGIBLES', 'valor nominal'],
      ['OTROS BIENES', 'valor nominal'],
    ].map(([titulo, criterioMedicion], i) => ({
      ejercicioId: ctx.ej,
      titulo: titulo!,
      tipo: 'CUANTITATIVA' as const,
      numero: i + 2,
      orden: i + 1,
      criterioMedicion,
      textoApertura: 'El saldo del rubro a fecha de cierre, está compuesto por:',
    })),
  })
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Configurar Nota I', () => {
  it('"Sí" sin descripción: NEG-007 y no guarda nada', async () => {
    const r = await configurar({ hechosPosterioress: true, hechosPosterioressTexto: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.codigo).toBe('NEG-007')
    const ej = await db.ejercicioContable.findUniqueOrThrow({ where: { id: ctx.ej } })
    expect(ej.criteriosBienesCambio).toBeNull()
    expect(await notaHechos()).toBeNull()
  })

  it('el criterio de bienes de cambio cambia solo la nota de bienes de cambio', async () => {
    const r = await configurar({ hechosPosterioress: false, hechosPosterioressTexto: null })
    expect(r.ok).toBe(true)
    expect(await criterioDe('BIENES DE CAMBIO')).toBe('costo de adquisición')
    expect(await criterioDe('BIENES INTANGIBLES')).toBe('valor nominal')
    expect(await criterioDe('OTROS BIENES')).toBe('valor nominal')
  })

  it('con hechos posteriores la nota lleva el texto escrito; con "No" se quita', async () => {
    const texto = 'El 10/02/2026 un incendio destruyó el depósito; el efecto no puede estimarse.'
    expect(
      (await configurar({ hechosPosterioress: true, hechosPosterioressTexto: texto })).ok,
    ).toBe(true)
    expect(await notaHechos()).toEqual({ textoApertura: texto, numero: 5 })

    expect(
      (await configurar({ hechosPosterioress: false, hechosPosterioressTexto: null })).ok,
    ).toBe(true)
    expect(await notaHechos()).toBeNull()
  })
})
