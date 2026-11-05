import { cache } from 'react'
import { db } from '@/lib/db'
import type { DensidadTablas } from '@prisma/client'
import { PREFERENCIAS_DEFAULT, type PreferenciasEstudio } from '../domain/preferencias'

/**
 * Preferencias de visualización del estudio. Memoizado por request: el layout y
 * cualquier página que las necesite comparten una sola consulta.
 * Sin fila de configuración → defaults (no se crea nada al leer).
 */
export const findPreferenciasEstudio = cache(
  async (estudioId: string): Promise<PreferenciasEstudio> => {
    const cfg = await db.estudioConfiguracion.findUnique({
      where: { estudioId },
      select: { densidadTablas: true },
    })
    return cfg ?? PREFERENCIAS_DEFAULT
  },
)

/** Upsert parcial de las preferencias (crea la fila de configuración si no existe). */
export async function guardarPreferenciasEstudio(
  estudioId: string,
  data: Partial<{ densidadTablas: DensidadTablas }>,
): Promise<PreferenciasEstudio> {
  return db.estudioConfiguracion.upsert({
    where: { estudioId },
    create: { estudioId, ...data },
    update: data,
    select: { densidadTablas: true },
  })
}
