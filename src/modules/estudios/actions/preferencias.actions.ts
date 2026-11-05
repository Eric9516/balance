'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { actionError, actionOk, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { PreferenciasEstudio } from '../domain/preferencias'
import { guardarPreferenciasEstudio } from '../repository/preferencias.repository'
import { faltaPermiso } from '@/lib/estudio-context'

// El color de la app no se configura (decisión del dueño del producto, 2026-11-05): si alguien
// manda uno, no se acepta.
const PreferenciasSchema = z
  .object({
    densidadTablas: z.enum(['COMODA', 'COMPACTA']).optional(),
    anexoBienesUso: z.enum(['UN_CUADRO', 'DOS_CUADROS']).optional(),
  })
  .strict()

/** Guarda las preferencias de visualización del estudio activo. */
export async function guardarPreferenciasAction(
  input: z.infer<typeof PreferenciasSchema>,
): Promise<ActionResult<PreferenciasEstudio>> {
  try {
    const sinPermiso = await faltaPermiso('configurar_estudio')
    if (sinPermiso) return actionError(sinPermiso)
    const parsed = PreferenciasSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const { densidadTablas, anexoBienesUso } = parsed.data
    const estudioId = await getCurrentEstudioId()
    const prefs = await guardarPreferenciasEstudio(estudioId, {
      ...(densidadTablas !== undefined ? { densidadTablas } : {}),
      ...(anexoBienesUso !== undefined ? { anexoBienesUso } : {}),
    })
    // Las preferencias afectan todo el layout principal.
    revalidatePath('/', 'layout')
    return actionOk(prefs)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'CONFIGURACION_ESTUDIO', operacion: 'guardar_preferencias' }),
    )
  }
}
