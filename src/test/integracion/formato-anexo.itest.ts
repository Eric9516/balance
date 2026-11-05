/**
 * El formato del Anexo de Bienes de Uso en cada balance (migración 20261105120000): un balance
 * nuevo hereda el del anterior de la sociedad, la base no deja que un asistente lo cambie, y la
 * acción del paso Bienes de Uso (Apariencia) lo guarda en un balance abierto y no en uno cerrado.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { cambiarFormatoAnexoAction } from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { db } from '@/lib/db'
import { comoPlataforma, conEstudio } from '@/lib/contexto-base'
import {
  actualizarFormatoAnexoBienesUso,
  formatoAnexoDelAnterior,
} from '@/modules/ejercicios/repository/ejercicio.repository'

const ctx = { estudio: '', sociedad: '', ej2024: '', ej2025: '', contador: '', asistente: '' }

beforeAll(async () => {
  await comoPlataforma(async () => {
    const estudio = await db.estudio.create({
      data: {
        nombre: 'Formato anexo',
        cuit: '30915000001',
        razonSocial: 'Formato anexo',
        createdAt: new Date('2095-01-01T00:00:00Z'),
      },
    })
    ctx.estudio = estudio.id
    const e = estudio.id
    const sociedad = await db.sociedad.create({
      data: { estudioId: e, razonSocial: 'Sociedad formato', cuit: '30915000002' },
    })
    ctx.sociedad = sociedad.id
    const [ej2024, contador, asistente] = await Promise.all([
      db.ejercicioContable.create({
        data: {
          estudioId: e,
          sociedadId: sociedad.id,
          fechaInicio: new Date('2024-01-01'),
          fechaCierre: new Date('2024-12-31'),
          denominacion: 'Ejercicio 2024',
          anexoBienesUso: 'DOS_CUADROS',
        },
      }),
      db.usuario.create({
        data: { estudioId: e, nombre: 'Contador', email: 'contador@formato.test', rol: 'CONTADOR' },
      }),
      db.usuario.create({
        data: {
          estudioId: e,
          nombre: 'Asistente',
          email: 'asistente@formato.test',
          rol: 'ASISTENTE',
        },
      }),
    ])
    ctx.ej2024 = ej2024.id
    ctx.contador = contador.id
    ctx.asistente = asistente.id
    // Un dueño, para que el estudio no quede sin dueño (lo exige la base)
    await db.usuario.create({
      data: { estudioId: e, nombre: 'Dueño', email: 'dueno@formato.test', rol: 'DUENO' },
    })
  })
})

afterAll(async () => {
  await comoPlataforma(async () => {
    await db.ejercicioContable.deleteMany({ where: { sociedadId: ctx.sociedad } })
    await db.sociedad.deleteMany({ where: { id: ctx.sociedad } })
    await db.estudio.deleteMany({ where: { id: ctx.estudio } })
  })
})

describe('El formato del Anexo de Bienes de Uso en cada balance', () => {
  it('los balances que ya existían quedan con un solo cuadro, el de por defecto', async () => {
    const ej = await comoPlataforma(() =>
      db.ejercicioContable.create({
        data: {
          estudioId: ctx.estudio,
          sociedadId: ctx.sociedad,
          fechaInicio: new Date('2023-01-01'),
          fechaCierre: new Date('2023-12-31'),
          denominacion: 'Ejercicio 2023',
        },
        select: { anexoBienesUso: true },
      }),
    )
    expect(ej.anexoBienesUso).toBe('UN_CUADRO')
  })

  it('un balance nuevo hereda el formato del último anterior de la sociedad', async () => {
    const heredado = await conEstudio(ctx.estudio, () =>
      formatoAnexoDelAnterior(ctx.sociedad, new Date('2025-01-01')),
    )
    // El último que cierra antes de 2025 es el 2024 (DOS_CUADROS), no el 2023
    expect(heredado).toBe('DOS_CUADROS')
    const sinAnterior = await conEstudio(ctx.estudio, () =>
      formatoAnexoDelAnterior(ctx.sociedad, new Date('2020-01-01')),
    )
    expect(sinAnterior).toBeNull()
  })

  it('un contador lo cambia', async () => {
    await conEstudio(ctx.estudio, () => actualizarFormatoAnexoBienesUso(ctx.ej2024, 'UN_CUADRO'), {
      usuarioId: ctx.contador,
      rol: 'CONTADOR',
    })
    const ej = await comoPlataforma(() =>
      db.ejercicioContable.findUniqueOrThrow({
        where: { id: ctx.ej2024 },
        select: { anexoBienesUso: true },
      }),
    )
    expect(ej.anexoBienesUso).toBe('UN_CUADRO')
  })

  it('la base no deja que un asistente lo cambie', async () => {
    await expect(
      conEstudio(ctx.estudio, () => actualizarFormatoAnexoBienesUso(ctx.ej2024, 'DOS_CUADROS'), {
        usuarioId: ctx.asistente,
        rol: 'ASISTENTE',
      }),
    ).rejects.toThrow(/asistente no puede cambiar el formato del Anexo de Bienes de Uso/)
  })

  // La sesión de las pruebas es la de un dueño del estudio activo más viejo: el de este archivo
  // (src/test/contexto-pruebas.ts).
  it('desde Apariencia, el dueño lo guarda en un balance abierto', async () => {
    const r = await cambiarFormatoAnexoAction(ctx.ej2024, ctx.sociedad, 'DOS_CUADROS')
    expect(r.ok).toBe(true)
    const ej = await comoPlataforma(() =>
      db.ejercicioContable.findUniqueOrThrow({
        where: { id: ctx.ej2024 },
        select: { anexoBienesUso: true },
      }),
    )
    expect(ej.anexoBienesUso).toBe('DOS_CUADROS')
  })

  it('en un balance cerrado no se cambia (NEG-068)', async () => {
    await comoPlataforma(() =>
      db.ejercicioContable.update({ where: { id: ctx.ej2024 }, data: { estado: 'CERRADO' } }),
    )
    const r = await cambiarFormatoAnexoAction(ctx.ej2024, ctx.sociedad, 'UN_CUADRO')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.codigo).toBe('NEG-068')
  })

  it('un formato que no existe se rechaza', async () => {
    const r = await cambiarFormatoAnexoAction(ctx.ej2024, ctx.sociedad, 'TRES_CUADROS' as never)
    expect(r.ok).toBe(false)
  })
})
