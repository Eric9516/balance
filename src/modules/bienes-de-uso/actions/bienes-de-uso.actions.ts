'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import type { FormatoAnexoBienesUso } from '@prisma/client'
import { exigirSesion } from '@/lib/estudio-context'
import {
  actualizarFormatoAnexoBienesUso,
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
import { getIndicesReexpresion } from '@/modules/estados/lib/ajuste'
import { netoAnteriorManualBDU, type BienDeUsoDTO } from '../domain/types'

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
        ? derivarArrastreBienesDeUso(bienesAnterior, getIndicesReexpresion(ejercicio))
        : null,
      modo,
    )
    const rows = await updateBienesLote(arrastre.bienes)

    if (modo === 'MANUAL') {
      // El neto anterior sale del comienzo: cambiar el comienzo también cambia el anterior.
      const previo = new Map(actuales.map((b) => [b.id, netoAnteriorManualBDU(b)]))
      const cambioAnterior = rows.some(
        (b) => (previo.get(b.id) ?? null) !== netoAnteriorManualBDU(b),
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

/**
 * Cómo sale el Anexo de Bienes de Uso en el documento de este balance (paso Bienes de Uso →
 * Apariencia): un solo cuadro o dos. Los números son los mismos. Lo elige el dueño o un contador
 * (la base lo controla también); en un balance cerrado no se cambia.
 */
export async function cambiarFormatoAnexoAction(
  ejercicioId: string,
  sociedadId: string,
  formato: FormatoAnexoBienesUso,
): Promise<ActionResult<void>> {
  try {
    if (formato !== 'UN_CUADRO' && formato !== 'DOS_CUADROS') {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Elegí "Un solo cuadro" o "Dos cuadros".',
      })
    }
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const [sesion, ejercicio] = await Promise.all([exigirSesion(), findEjercicioById(ejercicioId)])
    if (sesion.rol === 'ASISTENTE') {
      return actionError({
        tipo: 'AUTORIZACION',
        severidad: 'MEDIO',
        codigo: 'AUTH-007',
        mensaje:
          'Un asistente no puede cambiar el formato del Anexo de Bienes de Uso: lo elige el dueño o un contador.',
      })
    }
    if (!ejercicio) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-063',
        mensaje: 'No se encontró el ejercicio. Recargá la página y volvé a intentar.',
      })
    }
    if (ejercicio.estado === 'CERRADO') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-068',
        mensaje:
          'Este balance está cerrado: el Anexo de Bienes de Uso queda con el formato con que se emitió. Podés ver la vista previa, pero no cambiarlo.',
      })
    }
    await actualizarFormatoAnexoBienesUso(ejercicioId, formato)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'formato_anexo_bienes_uso' }),
    )
  }
}
