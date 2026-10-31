'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import {
  toggleEsGastoGrupo,
  toggleAparecEnEERRGrupo,
} from '@/modules/rubros-grupo/repository/rubro-grupo.repository'
import { faltaPermiso } from '@/lib/estudio-context'

function revalidate(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

export async function toggleGastoSeccionAction(
  grupoId: string,
  esGasto: boolean,
  sociedadId: string,
  ejercicioId: string,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('configurar_criterios')
    if (sinPermiso) return actionError(sinPermiso)
    await toggleEsGastoGrupo(await getCurrentEstudioId(), grupoId, esGasto)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'rubros-base', operacion: 'toggle-gasto-seccion' }),
    )
  }
}

// Toggle aparecEnEERR — funciona para custom (grupo:ID) y legacy (legacy:CLAVE)
export async function toggleAparecEnEERRAction(
  key: string,
  aparecEnEERR: boolean,
  sociedadId: string,
  ejercicioId: string,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('configurar_criterios')
    if (sinPermiso) return actionError(sinPermiso)
    const estudioId = await getCurrentEstudioId()
    if (key.startsWith('grupo:')) {
      await toggleAparecEnEERRGrupo(estudioId, key.replace('grupo:', ''), aparecEnEERR)
    } else {
      await db.gastoSeccionConfig.upsert({
        where: { estudioId_clave: { estudioId, clave: key } },
        update: { aparecEnEERR },
        create: { estudioId, clave: key, aparecEnEERR },
      })
    }
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'rubros-base', operacion: 'toggle-aparec-eerr' }),
    )
  }
}

// Reordenar — funciona para custom (grupo:ID) y legacy (legacy:CLAVE) e intermezcla
export async function reordenarGastoSeccionAction(
  keyA: string,
  keyB: string,
  sociedadId: string,
  ejercicioId: string,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('configurar_criterios')
    if (sinPermiso) return actionError(sinPermiso)
    const estudioId = await getCurrentEstudioId()
    const getOrden = async (key: string) => {
      if (key.startsWith('grupo:')) {
        const g = await db.rubroGrupo.findFirst({
          where: { id: key.replace('grupo:', ''), estudioId },
          select: { orden: true },
        })
        return g?.orden ?? 9999
      } else {
        const c = await db.gastoSeccionConfig.findUnique({
          where: { estudioId_clave: { estudioId, clave: key } },
          select: { orden: true },
        })
        return c?.orden ?? 9999
      }
    }
    const setOrden = async (key: string, orden: number) => {
      if (key.startsWith('grupo:')) {
        await db.rubroGrupo.updateMany({
          where: { id: key.replace('grupo:', ''), estudioId },
          data: { orden },
        })
      } else {
        await db.gastoSeccionConfig.upsert({
          where: { estudioId_clave: { estudioId, clave: key } },
          update: { orden },
          create: { estudioId, clave: key, orden },
        })
      }
    }

    const [ordenA, ordenB] = await Promise.all([getOrden(keyA), getOrden(keyB)])
    await Promise.all([setOrden(keyA, ordenB), setOrden(keyB, ordenA)])
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'rubros-base', operacion: 'reordenar-seccion' }),
    )
  }
}
