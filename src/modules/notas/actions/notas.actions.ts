'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  assertDetalleNotaBelongsToCurrentEstudio,
  assertEjercicioBelongsToCurrentEstudio,
  assertNotaBelongsToCurrentEstudio,
} from '@/lib/authz'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import {
  updateNota,
  deleteNota,
  renumerarNotas,
  createDetalle,
  updateDetalle,
  deleteDetalle,
  generarNotasDesdeRubros,
} from '../repository/notas.repository'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { marcarComparativoModificado } from '@/modules/ejercicios/repository/ejercicio.repository'
import type { NotaDTO, DetalleNotaDTO } from '../domain/types'
import type { AdopcionRT54, CriteriosBienesCambio } from '@prisma/client'

function revalPath(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/notas`)
}

// ─── Nota CRUD ────────────────────────────────────────────────────────────────

export async function actualizarNotaAction(
  notaId: string,
  ejercicioId: string,
  sociedadId: string,
  data: {
    titulo?: string
    numero?: number | null
    criterioMedicion?: string | null
    textoApertura?: string | null
  },
): Promise<ActionResult<NotaDTO>> {
  try {
    await assertNotaBelongsToCurrentEstudio(notaId)
    const nota = await updateNota(notaId, data)
    revalPath(sociedadId, ejercicioId)
    return actionOk(nota)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'actualizar_nota' }))
  }
}

export async function eliminarNotaAction(
  notaId: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertNotaBelongsToCurrentEstudio(notaId)
    await deleteNota(notaId)
    await renumerarNotas(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'eliminar_nota' }))
  }
}

// ─── Detalle CRUD ─────────────────────────────────────────────────────────────

export async function crearDetalleAction(
  notaId: string,
  ejercicioId: string,
  sociedadId: string,
  orden: number,
): Promise<ActionResult<DetalleNotaDTO>> {
  try {
    await assertNotaBelongsToCurrentEstudio(notaId)
    const det = await createDetalle({
      notaEjercicioId: notaId,
      concepto: '',
      importeActual: 0,
      importeAnterior: 0,
      esTotal: false,
      orden,
    })
    revalPath(sociedadId, ejercicioId)
    return actionOk({
      id: det.id,
      notaEjercicioId: det.notaEjercicioId,
      orden: det.orden,
      concepto: det.concepto,
      importeActual: Number(det.importeActual),
      importeAnterior: Number(det.importeAnterior),
      esTotal: det.esTotal,
    })
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'crear_detalle' }))
  }
}

export async function actualizarDetalleAction(
  detalleId: string,
  ejercicioId: string,
  sociedadId: string,
  data: { concepto?: string; importeActual?: number; importeAnterior?: number },
): Promise<ActionResult<void>> {
  try {
    await assertDetalleNotaBelongsToCurrentEstudio(detalleId)
    await updateDetalle(detalleId, data)
    // La columna "ejercicio anterior" de una nota forma parte del comparativo: tocarla
    // invalida la autorización de saldos del ejercicio anterior.
    if (data.importeAnterior !== undefined) await marcarComparativoModificado(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'actualizar_detalle' }))
  }
}

export async function eliminarDetalleAction(
  detalleId: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertDetalleNotaBelongsToCurrentEstudio(detalleId)
    await deleteDetalle(detalleId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'eliminar_detalle' }))
  }
}

// ─── Configuración Nota I ─────────────────────────────────────────────────────

const CRITERIO_LABEL: Record<string, string> = {
  COSTO_ADQUISICION: 'costo de adquisición',
  ULTIMA_COMPRA: 'costo de la última compra',
  COSTO_REPOSICION: 'costo de reposición',
}

const TEXTO_HECHOS_DEFAULT =
  'No existen acontecimientos u operaciones ocurridos entre la fecha de cierre del ejercicio y la de emisión de los presentes estados contables que puedan modificar significativamente la situación patrimonial y financiera de la entidad a la fecha de cierre ni los resultados del presente ejercicio.'

const TITULO_HECHOS = 'HECHOS POSTERIORES AL CIERRE DEL EJERCICIO'

export async function guardarConfigNotaIAction(
  ejercicioId: string,
  sociedadId: string,
  data: {
    adopcionRT54?: AdopcionRT54 | null
    criteriosBienesCambio?: CriteriosBienesCambio | null
    hechosPosterioress?: boolean | null
    hechosPosterioressTexto?: string | null
  },
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    // 1. Guardar config en el ejercicio
    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data,
    })

    // 2. Actualizar criterio de bienes de cambio en notas existentes
    if (data.criteriosBienesCambio) {
      const nuevoCriterio = CRITERIO_LABEL[data.criteriosBienesCambio]
      if (nuevoCriterio) {
        await db.notaEjercicio.updateMany({
          where: {
            ejercicioId,
            titulo: { contains: 'BIEN', mode: 'insensitive' },
            tipo: 'CUANTITATIVA',
            criterioMedicion: { not: null },
          },
          data: { criterioMedicion: nuevoCriterio },
        })
      }
    }

    // 3. Sincronizar nota de Hechos Posteriores
    if (data.hechosPosterioress !== undefined) {
      const textoHechos = data.hechosPosterioress
        ? data.hechosPosterioressTexto?.trim() || TEXTO_HECHOS_DEFAULT
        : null

      const notaExistente = await db.notaEjercicio.findFirst({
        where: { ejercicioId, titulo: TITULO_HECHOS },
        select: { id: true, orden: true },
      })

      if (data.hechosPosterioress && textoHechos) {
        if (notaExistente) {
          // Actualizar texto de la nota existente
          await db.notaEjercicio.update({
            where: { id: notaExistente.id },
            data: { textoApertura: textoHechos },
          })
        } else {
          // Crear la nota al final de la lista
          const ultimaNota = await db.notaEjercicio.findFirst({
            where: { ejercicioId },
            orderBy: { orden: 'desc' },
            select: { numero: true, orden: true },
          })
          const numero = (ultimaNota?.numero ?? 1) + 1
          const orden = (ultimaNota?.orden ?? 0) + 1
          await db.notaEjercicio.create({
            data: {
              ejercicioId,
              titulo: TITULO_HECHOS,
              tipo: 'INFORMATIVA',
              numero,
              orden,
              criterioMedicion: null,
              textoApertura: textoHechos,
            },
          })
        }
      } else if (!data.hechosPosterioress && notaExistente) {
        // Eliminar la nota y renumerar
        await db.notaEjercicio.delete({ where: { id: notaExistente.id } })
        await renumerarNotas(ejercicioId)
      }
    } else if (data.hechosPosterioress === true && data.hechosPosterioressTexto !== undefined) {
      // Solo cambió el texto (ya existe la nota)
      const notaExistente = await db.notaEjercicio.findFirst({
        where: { ejercicioId, titulo: TITULO_HECHOS },
        select: { id: true },
      })
      if (notaExistente) {
        await db.notaEjercicio.update({
          where: { id: notaExistente.id },
          data: { textoApertura: data.hechosPosterioressTexto?.trim() || TEXTO_HECHOS_DEFAULT },
        })
      }
    }

    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'guardar_config_nota_i' }))
  }
}

// ─── Auto-generación ──────────────────────────────────────────────────────────

export async function generarNotasAutomaticasAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const [cuentas, rubros, ejercicio] = await Promise.all([
      findCuentasByEjercicio(ejercicioId),
      findRubrosBase(),
      db.ejercicioContable.findUnique({
        where: { id: ejercicioId },
        select: {
          criteriosBienesCambio: true,
          hechosPosterioress: true,
          hechosPosterioressTexto: true,
        },
      }),
    ])

    if (cuentas.length === 0) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-020',
        mensaje: 'No hay cuentas clasificadas. Importá y clasificá las cuentas primero.',
      })
    }

    await generarNotasDesdeRubros(ejercicioId, rubros, cuentas, {
      criteriosBienesCambio: ejercicio?.criteriosBienesCambio ?? null,
      hechosPosterioress: ejercicio?.hechosPosterioress ?? null,
      hechosPosterioressTexto: ejercicio?.hechosPosterioressTexto ?? null,
    })
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'generar_automaticas' }))
  }
}
