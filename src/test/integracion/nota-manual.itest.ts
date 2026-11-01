/**
 * Integración (PostgreSQL real): una nota agregada a mano en Anexos → Configuración es una nota de
 * verdad: aparece en Notas, se ubica donde se elige, se mueve y regenerar no la borra ni la cambia
 * de lugar.
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
import type { ActionResult } from '@/modules/errores/types'
import { crearEjercicio } from '@/modules/ejercicios/actions/ejercicio.actions'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  agregarDocumentoManualAction,
  eliminarDocumentoManualAction,
} from '@/modules/documentos/actions/documento.actions'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import {
  crearDetalleAction,
  eliminarNotaAction,
  generarNotasAutomaticasAction,
  moverNotaAction,
} from '@/modules/notas/actions/notas.actions'
import { cargarNotas } from '@/modules/notas/services/notas.service'

const ctx = {} as {
  estudioId: string
  sociedadId: string
  ejercicioId: string
  rubros: Map<string, string>
}

function ok<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(`${r.error.codigo}: ${r.error.mensaje}`)
  return r.data
}

async function notas() {
  const lista = await cargarNotas((await findEjercicioById(ctx.ejercicioId))!)
  return [...lista].sort((a, b) => a.orden - b.orden)
}

const agregar = (titulo: string, ubicacion?: string) =>
  agregarDocumentoManualAction(ctx.ejercicioId, ctx.sociedadId, 'NOTA', titulo, ubicacion)

const docManual = async (titulo: string) =>
  (await evaluarDocumentos(ctx.ejercicioId)).find((d) => d.titulo === titulo)

beforeAll(async () => {
  const estudio = await db.estudio.create({
    data: {
      nombre: 'Estudio Nota Manual',
      cuit: `30${Date.now().toString().slice(-8)}2`,
      razonSocial: 'Estudio Nota Manual',
      createdAt: new Date('2000-01-03T00:00:00Z'),
    },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  const sociedad = await db.sociedad.create({
    data: {
      estudioId: estudio.id,
      razonSocial: 'Nota Manual SA',
      cuit: `30${Date.now().toString().slice(-8)}3`,
    },
  })
  const rubros = await db.rubroBase.findMany({
    where: { estudioId: estudio.id },
    select: { id: true, codigo: true },
  })
  const ej = ok(
    await crearEjercicio(sociedad.id, {
      fechaInicio: '2025-01-01',
      fechaCierre: '2025-12-31',
      denominacion: '',
      numeroEjercicio: '2',
      auditorId: auditor.id,
      modoAnterior: 'SIN_ANTERIOR',
      ejercicioAnteriorId: '',
      categoriaEnte: 'PEQUENA',
      fechaInformeAuditor: '2026-03-15',
      indiceInflacionAnterior: '100',
      indiceInflacionActual: '100',
    }),
  )
  Object.assign(ctx, {
    estudioId: estudio.id,
    sociedadId: sociedad.id,
    ejercicioId: ej.id,
    rubros: new Map(rubros.map((r) => [r.codigo, r.id])),
  })
  await db.cuentaContable.createMany({
    data: [
      ['1103', 'ACT-CTE-01', 'Banco'],
      ['1301', 'ACT-CTE-03', 'Deudores'],
    ].map(([codigo, rubro, nombre]) => ({
      ejercicioId: ej.id,
      codigo: codigo!,
      nombre: nombre!,
      rubroBaseId: ctx.rubros.get(rubro!)!,
      saldoDeudor: 100,
      saldoFinal: 100,
      clasificadaManual: true,
    })),
  })
  ok(await generarNotasAutomaticasAction(ej.id, sociedad.id))
})

afterAll(async () => {
  await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedadId } })
  await db.sociedad.deleteMany({ where: { id: ctx.sociedadId } })
  await db.estudio.deleteMany({ where: { id: ctx.estudioId } })
})

describe('Nota agregada a mano', () => {
  it('aparece en Notas, al final por defecto, y queda en la lista de documentos', async () => {
    const antes = (await notas()).length
    ok(await agregar('Otros créditos'))
    const lista = await notas()
    expect(lista).toHaveLength(antes + 1)
    expect(lista.at(-1)).toMatchObject({ titulo: 'Otros créditos', numero: antes + 2 })
    expect(await docManual('Otros créditos')).toBeDefined()
  })

  it('no repite el título de otra nota', async () => {
    const r = await agregar('OTROS CRÉDITOS')
    expect(r.ok ? 'ok' : r.error.mensaje).toMatch(/Ya hay una nota/)
  })

  it('se ubica donde se elige: primera o debajo de otra', async () => {
    ok(await agregar('Primera manual', 'PRIMERA'))
    let lista = await notas()
    expect(lista[0]).toMatchObject({ titulo: 'Primera manual', numero: 2, orden: 1 })

    const referencia = lista[1]!
    ok(await agregar('Debajo de otra', referencia.id))
    lista = await notas()
    expect(lista[2]).toMatchObject({ titulo: 'Debajo de otra', numero: 4 })
    expect(lista.map((n) => n.numero)).toEqual(lista.map((_, i) => i + 2))
  })

  it('se mueve después, y regenerar respeta el lugar', async () => {
    const lista = await notas()
    const nota = lista.find((n) => n.titulo === 'Otros créditos')!
    ok(await moverNotaAction(nota.id, ctx.ejercicioId, ctx.sociedadId, lista[0]!.id))
    const movidas = await notas()
    expect(movidas[1]?.titulo).toBe('Otros créditos')

    const titulos = movidas.map((n) => n.titulo)
    ok(await generarNotasAutomaticasAction(ctx.ejercicioId, ctx.sociedadId))
    const regeneradas = await notas()
    for (const t of titulos) expect(regeneradas.map((n) => n.titulo)).toContain(t)
    expect(regeneradas.map((n) => n.titulo).filter((t) => titulos.includes(t))).toEqual(titulos)
  })

  it('una nota de otro ejercicio no se puede usar de referencia', async () => {
    const [nota] = await notas()
    const r = await moverNotaAction(
      nota!.id,
      ctx.ejercicioId,
      ctx.sociedadId,
      '00000000-0000-7000-8000-000000000000',
    )
    expect(r.ok).toBe(false)
  })

  it('desde Configuración se elimina si está vacía; con filas, solo desde Notas', async () => {
    const vacia = (await docManual('Debajo de otra'))!
    ok(await eliminarDocumentoManualAction(ctx.ejercicioId, ctx.sociedadId, vacia.documentoId!))
    let lista = await notas()
    expect(lista.map((n) => n.titulo)).not.toContain('Debajo de otra')
    expect(lista.map((n) => n.numero)).toEqual(lista.map((_, i) => i + 2))

    const conFilas = lista.find((n) => n.titulo === 'Primera manual')!
    ok(await crearDetalleAction(conFilas.id, ctx.ejercicioId, ctx.sociedadId, 0))
    const doc = (await docManual('Primera manual'))!
    const r = await eliminarDocumentoManualAction(ctx.ejercicioId, ctx.sociedadId, doc.documentoId!)
    expect(r.ok ? 'ok' : r.error.codigo).toBe('NEG-066')

    ok(await eliminarNotaAction(conFilas.id, ctx.ejercicioId, ctx.sociedadId))
    lista = await notas()
    expect(lista.map((n) => n.titulo)).not.toContain('Primera manual')
    expect(await docManual('Primera manual')).toBeUndefined()
  })
})
