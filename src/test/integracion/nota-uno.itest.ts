/**
 * Nota 1 (bases de preparación): la arma la app con los datos del ejercicio y el contador puede
 * reemplazarla por su texto. Se prueba el guardado, volver al texto generado, el bloqueo con el
 * ejercicio cerrado, las reglas de la base y que el documento imprima lo mismo que la pantalla.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { guardarNotaUnoAction } from '@/modules/notas/actions/notas.actions'
import { cargarDocumentoBalance } from '@/modules/exportacion/services/documento.service'

const ctx = { estudioId: '', sociedadId: '', ej: '' }

const ejercicioEnBase = () => db.ejercicioContable.findUniqueOrThrow({ where: { id: ctx.ej } })

async function notaUnoDelDocumento() {
  const doc = await cargarDocumentoBalance(ctx.ej)
  const notas = doc?.secciones.find((s) => s.tipo === 'notas')
  return notas?.tipo === 'notas' ? notas.notaUno : null
}

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Nota 1',
      cuit: '30555555551',
      razonSocial: 'Estudio Nota 1',
      createdAt: new Date('1996-01-01T00:00:00Z'),
    },
  })
  ctx.estudioId = estudio.id
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez', esDefault: true },
  })
  ctx.sociedadId = (
    await db.sociedad.create({
      data: {
        estudioId: estudio.id,
        razonSocial: 'Nota Uno S.A.S.',
        cuit: '30555555578',
        provincia: 'Córdoba',
      },
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
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Nota 1', () => {
  it('sin texto propio, el documento imprime la nota armada con los datos del ejercicio', async () => {
    const nota = await notaUnoDelDocumento()
    expect(nota?.texto).toContain('1.1. Bases de preparación')
    expect(nota?.texto).toContain('Córdoba mediante Resolución N° 35/24')
    expect(nota?.texto).toContain('fue del 31,55%.')
    expect(nota?.texto).toContain('Entidad pequeña')
  })

  it('el texto del contador se guarda, se imprime y se puede volver al generado', async () => {
    const r = await guardarNotaUnoAction(ctx.ej, ctx.sociedadId, '  1.1. Bases\n\nTexto propio.  ')
    expect(r.ok && r.data.texto).toBe('1.1. Bases\n\nTexto propio.')
    const guardado = await ejercicioEnBase()
    expect(guardado.notaUnoTexto).toBe('1.1. Bases\n\nTexto propio.')
    expect(guardado.notaUnoEditadaEn).toBeInstanceOf(Date)
    expect((await notaUnoDelDocumento())?.texto).toBe('1.1. Bases\n\nTexto propio.')

    // Vacío = volver al texto generado.
    const vuelta = await guardarNotaUnoAction(ctx.ej, ctx.sociedadId, '   ')
    expect(vuelta.ok && vuelta.data.texto).toBeNull()
    const despues = await ejercicioEnBase()
    expect(despues.notaUnoTexto).toBeNull()
    expect(despues.notaUnoEditadaEn).toBeNull()
    expect((await notaUnoDelDocumento())?.texto).toContain('1.1. Bases de preparación')
  })

  it('la base exige texto y fecha juntos, y un largo razonable', async () => {
    await expect(
      db.ejercicioContable.update({ where: { id: ctx.ej }, data: { notaUnoTexto: 'Sin fecha' } }),
    ).rejects.toThrow()
    await expect(
      db.ejercicioContable.update({
        where: { id: ctx.ej },
        data: { notaUnoTexto: 'x'.repeat(50_001), notaUnoEditadaEn: new Date() },
      }),
    ).rejects.toThrow()
    const largo = await guardarNotaUnoAction(ctx.ej, ctx.sociedadId, 'x'.repeat(50_001))
    expect(!largo.ok && largo.error.codigo).toBe('NEG-006')
  })

  it('con el ejercicio cerrado no se modifica', async () => {
    await db.ejercicioContable.update({ where: { id: ctx.ej }, data: { estado: 'CERRADO' } })
    const r = await guardarNotaUnoAction(ctx.ej, ctx.sociedadId, 'Otro texto.')
    expect(!r.ok && r.error.codigo).toBe('NEG-005')
    expect((await ejercicioEnBase()).notaUnoTexto).toBeNull()
  })
})
