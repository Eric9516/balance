/**
 * Integración (PostgreSQL real) de los identificadores UUIDv7 generados por la base.
 * Ver docs/decisiones/0008-claves-uuid-v7.md.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))

import { db } from '@/lib/db'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import {
  findEjercicioById,
  findEjerciciosBySociedad,
  findResumenesBySociedad,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findAuditorById } from '@/modules/auditores/repository/auditor.repository'

/** Milisegundos Unix guardados en los primeros 48 bits de un UUIDv7. */
const milisegundosDe = (uuid: string) => parseInt(uuid.replace(/-/g, '').slice(0, 12), 16)

describe('uuidv7() en la base', () => {
  it('genera UUID versión 7, variante RFC 9562, con la hora actual y sin repetir', async () => {
    const antes = Date.now()
    const filas = await db.$queryRaw<{ id: string }[]>`
      SELECT uuidv7()::text AS id FROM generate_series(1, 2000)`
    const despues = Date.now()
    const ids = filas.map((f) => f.id)
    expect(new Set(ids).size).toBe(2000)
    for (const id of ids) {
      expect(id[14], id).toBe('7') // versión
      expect('89ab', id).toContain(id[19]) // variante
      const ms = milisegundosDe(id)
      expect(ms).toBeGreaterThanOrEqual(antes - 1000)
      expect(ms).toBeLessThanOrEqual(despues + 1000)
    }
  })

  it('los identificadores sucesivos no retroceden en el tiempo', async () => {
    const filas = await db.$queryRaw<{ id: string }[]>`
      SELECT uuidv7()::text AS id FROM generate_series(1, 500)`
    const tiempos = filas.map((f) => milisegundosDe(f.id))
    for (let i = 1; i < tiempos.length; i++)
      expect(tiempos[i]).toBeGreaterThanOrEqual(tiempos[i - 1]!)
  })

  it('las filas nuevas reciben un UUIDv7 de la base, sin que la app lo genere', async () => {
    const antes = Date.now()
    const estudio = await db.estudio.create({
      data: {
        nombre: 'Estudio UUID',
        cuit: `30${Date.now().toString().slice(-8)}4`,
        razonSocial: 'Estudio UUID',
      },
    })
    expect(estudio.id[14]).toBe('7')
    expect(Math.abs(milisegundosDe(estudio.id) - antes)).toBeLessThan(60_000)
  })
})

describe('identificadores mal formados', () => {
  const malos = ['cmpt32szg0000wwbvct74pikd', 'no-existe', "x' OR '1'='1", '']

  it('las búsquedas desde la dirección de una página responden "no encontrado"', async () => {
    for (const id of malos) {
      expect(await findSociedadById(id), id).toBeNull()
      expect(await findEjercicioById(id), id).toBeNull()
      expect(await findAuditorById(id), id).toBeNull()
      expect(await findEjerciciosBySociedad(id), id).toEqual([])
      expect(await findResumenesBySociedad(id), id).toEqual([])
    }
  })

  it('los controles de permisos responden "sin permiso", no un error de la base', async () => {
    for (const id of malos) {
      await expect(assertEjercicioBelongsToCurrentEstudio(id), id).rejects.toMatchObject({
        codigo: 'AUTH-001',
      })
    }
  })
})
