'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { actionError, actionOk, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { validarAcento, type PreferenciasEstudio } from '../domain/preferencias'
import { guardarPreferenciasEstudio } from '../repository/preferencias.repository'
import { faltaPermiso } from '@/lib/estudio-context'

const PreferenciasSchema = z.object({
  colorPrimario: z.string().optional(),
  densidadTablas: z.enum(['COMODA', 'COMPACTA']).optional(),
  anexoBienesUso: z.enum(['UN_CUADRO', 'DOS_CUADROS']).optional(),
})

/**
 * Guarda las preferencias de visualización del estudio activo. El acento se valida
 * en dominio (formato y contraste) antes de persistirse: se inyecta en el CSS.
 */
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
    const { colorPrimario, densidadTablas, anexoBienesUso } = parsed.data
    if (colorPrimario !== undefined) {
      const motivo = validarAcento(colorPrimario)
      if (motivo) {
        return actionError({
          tipo: 'FORMULARIO',
          severidad: 'BAJO',
          codigo: 'FORM-001',
          mensaje: motivo,
          campo: 'colorPrimario',
        })
      }
    }
    const estudioId = await getCurrentEstudioId()
    const prefs = await guardarPreferenciasEstudio(estudioId, {
      ...(colorPrimario !== undefined ? { colorPrimario: colorPrimario.toUpperCase() } : {}),
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
