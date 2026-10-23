'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import {
  findEjercicioById,
  marcarComparativoModificado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import {
  createBienDeUso,
  updateBienesLote,
  deleteBienDeUso,
  findBienesDeUso,
} from '../repository/bienes-de-uso.repository'
import { aplicarArrastreBienesDeUso, derivarArrastreBienesDeUso } from '../domain/saldosInicio'
import { getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import type { BienDeUsoDTO } from '../domain/types'

function revalPath(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

/**
 * Guarda todo el Anexo I de una vez. Lo que manda el cliente se SANEA: en modo
 * VINCULADO, las columnas de inicio de las categorías con fuente en el anterior se
 * recalculan desde ese anexo. En MANUAL, cambiar el neto anterior invalida la
 * autorización del comparativo.
 */
export async function guardarLoteBienesAction(
  ejercicioId: string,
  sociedadId: string,
  bienes: BienDeUsoDTO[],
): Promise<ActionResult<BienDeUsoDTO[]>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Ejercicio no encontrado',
      })
    }
    const modo = modoEfectivo(ejercicio)
    const anteriorId = idAnteriorDerivable(ejercicio)
    const [bienesAnterior, actuales] = await Promise.all([
      anteriorId ? findBienesDeUso(anteriorId) : Promise.resolve([]),
      findBienesDeUso(ejercicioId),
    ])
    // Solo filas que pertenecen a este ejercicio.
    const propios = new Set(actuales.map((b) => b.id))
    const recibidos = bienes.filter((b) => propios.has(b.id))

    const arrastre = aplicarArrastreBienesDeUso(
      recibidos,
      anteriorId
        ? derivarArrastreBienesDeUso(bienesAnterior, getCoeficienteComparativo(ejercicio))
        : null,
      modo,
    )
    const rows = await updateBienesLote(arrastre.bienes)

    if (modo === 'MANUAL') {
      const previo = new Map(actuales.map((b) => [b.id, b.netoResidualAnteriorManual]))
      const cambioAnterior = rows.some(
        (b) => (previo.get(b.id) ?? null) !== b.netoResidualAnteriorManual,
      )
      if (cambioAnterior) await marcarComparativoModificado(ejercicioId)
    }

    revalPath(sociedadId, ejercicioId)
    return actionOk(rows)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_lote_bienes' }),
    )
  }
}

export async function crearBienDeUsoAction(
  ejercicioId: string,
  sociedadId: string,
  categoria: string,
): Promise<ActionResult<BienDeUsoDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const existing = await findBienesDeUso(ejercicioId)
    const orden = existing.length + 1
    const row = await createBienDeUso(ejercicioId, categoria, orden)
    revalPath(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'crear_bien_de_uso' }),
    )
  }
}

export async function eliminarBienDeUsoAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!(await deleteBienDeUso(ejercicioId, id))) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje:
          'No se encontró esa categoría en el Anexo I de este ejercicio. Recargá la página y volvé a intentar.',
      })
    }
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'eliminar_bien_de_uso' }),
    )
  }
}
