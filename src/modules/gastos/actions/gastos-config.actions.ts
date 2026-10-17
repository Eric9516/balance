'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { toggleEsGastoGrupo, swapOrdenGrupos, toggleAparecEnEERRGrupo } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'

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
    await toggleEsGastoGrupo(grupoId, esGasto)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'toggle-gasto-seccion' }))
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
    if (key.startsWith('grupo:')) {
      await toggleAparecEnEERRGrupo(key.replace('grupo:', ''), aparecEnEERR)
    } else {
      await db.gastoSeccionConfig.upsert({
        where: { clave: key },
        update: { aparecEnEERR },
        create: { clave: key, aparecEnEERR },
      })
    }
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'toggle-aparec-eerr' }))
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
    const getOrden = async (key: string) => {
      if (key.startsWith('grupo:')) {
        const g = await db.rubroGrupo.findUnique({ where: { id: key.replace('grupo:', '') }, select: { orden: true } })
        return g?.orden ?? 9999
      } else {
        const c = await db.gastoSeccionConfig.findUnique({ where: { clave: key }, select: { orden: true } })
        return c?.orden ?? 9999
      }
    }
    const setOrden = async (key: string, orden: number) => {
      if (key.startsWith('grupo:')) {
        await db.rubroGrupo.update({ where: { id: key.replace('grupo:', '') }, data: { orden } })
      } else {
        await db.gastoSeccionConfig.upsert({
          where: { clave: key },
          update: { orden },
          create: { clave: key, orden },
        })
      }
    }

    const [ordenA, ordenB] = await Promise.all([getOrden(keyA), getOrden(keyB)])
    await Promise.all([setOrden(keyA, ordenB), setOrden(keyB, ordenA)])
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'reordenar-seccion' }))
  }
}
