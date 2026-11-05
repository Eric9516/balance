import { cache } from 'react'
import { db } from '@/lib/db'
import type { DensidadTablas, FormatoAnexoBienesUso } from '@prisma/client'
import {
  acentoSeguro,
  PREFERENCIAS_DEFAULT,
  type PreferenciasEstudio,
} from '../domain/preferencias'

/**
 * Preferencias de visualización del estudio. Memoizado por request: el layout y
 * cualquier página que las necesite comparten una sola consulta.
 * Sin fila de configuración → defaults (no se crea nada al leer).
 */
export const findPreferenciasEstudio = cache(
  async (estudioId: string): Promise<PreferenciasEstudio> => {
    const cfg = await db.estudioConfiguracion.findUnique({
      where: { estudioId },
      select: { colorPrimario: true, densidadTablas: true, anexoBienesUso: true },
    })
    if (!cfg) return PREFERENCIAS_DEFAULT
    return {
      colorPrimario: acentoSeguro(cfg.colorPrimario),
      densidadTablas: cfg.densidadTablas,
      anexoBienesUso: cfg.anexoBienesUso,
    }
  },
)

/** Upsert parcial de las preferencias (crea la fila de configuración si no existe). */
export async function guardarPreferenciasEstudio(
  estudioId: string,
  data: Partial<{
    colorPrimario: string
    densidadTablas: DensidadTablas
    anexoBienesUso: FormatoAnexoBienesUso
  }>,
): Promise<PreferenciasEstudio> {
  const row = await db.estudioConfiguracion.upsert({
    where: { estudioId },
    create: { estudioId, ...data },
    update: data,
    select: { colorPrimario: true, densidadTablas: true, anexoBienesUso: true },
  })
  return {
    colorPrimario: acentoSeguro(row.colorPrimario),
    densidadTablas: row.densidadTablas,
    anexoBienesUso: row.anexoBienesUso,
  }
}
