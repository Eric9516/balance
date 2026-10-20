'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import {
  updateNota,
  deleteNota,
  esNotaDelEjercicio,
  renumerarNotas,
  createDetalle,
  updateDetalle,
  deleteDetalle,
  generarNotasDesdeRubros,
  type CambiosDetalle,
  type CambiosNota,
} from '../repository/notas.repository'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { marcarComparativoModificado } from '@/modules/ejercicios/repository/ejercicio.repository'
import type { NotaDTO, DetalleNotaDTO } from '../domain/types'
import { AdopcionRT54, CriteriosBienesCambio } from '@prisma/client'
import { importe } from '@/lib/importe'

function revalPath(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/notas`)
}

// Lo que se edita de una nota y de un detalle. zod descarta cualquier otra clave que mande la
// pantalla: el repositorio nunca recibe el objeto tal cual.
const textoOpcional = z.string().nullable().optional()
const CambiosNotaSchema = z.object({
  titulo: z.string().trim().min(1, 'El título de la nota no puede quedar vacío.').optional(),
  numero: z.number().int().nullable().optional(),
  criterioMedicion: textoOpcional,
  textoApertura: textoOpcional,
})
const importeNota = z.number().finite().optional()
const CambiosDetalleSchema = z.object({
  concepto: z.string().optional(),
  importeActual: importeNota,
  importeAnterior: importeNota,
})
const ConfigNotaISchema = z.object({
  adopcionRT54: z.nativeEnum(AdopcionRT54).nullable().optional(),
  criteriosBienesCambio: z.nativeEnum(CriteriosBienesCambio).nullable().optional(),
  hechosPosterioress: z.boolean().nullable().optional(),
  hechosPosterioressTexto: textoOpcional,
})

function errorFormulario(issues: { message: string; path: PropertyKey[] }[]): AppError {
  return {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    codigo: 'FORM-001',
    mensaje: issues[0]?.message ?? 'Datos inválidos en la nota.',
    campo: issues[0]?.path.join('.'),
  }
}

const NOTA_NO_ENCONTRADA: AppError = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'No se encontró esa nota en este ejercicio. Recargá la página y volvé a intentar.',
}

const DETALLE_NO_ENCONTRADO: AppError = {
  ...NOTA_NO_ENCONTRADA,
  mensaje:
    'No se encontró esa fila de la nota en este ejercicio. Recargá la página y volvé a intentar.',
}

// ─── Nota CRUD ────────────────────────────────────────────────────────────────

export async function actualizarNotaAction(
  notaId: string,
  ejercicioId: string,
  sociedadId: string,
  data: CambiosNota,
): Promise<ActionResult<NotaDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = CambiosNotaSchema.safeParse(data)
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues))
    const nota = await updateNota(ejercicioId, notaId, parsed.data)
    if (!nota) return actionError(NOTA_NO_ENCONTRADA)
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
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!(await deleteNota(ejercicioId, notaId))) return actionError(NOTA_NO_ENCONTRADA)
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
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!(await esNotaDelEjercicio(ejercicioId, notaId))) return actionError(NOTA_NO_ENCONTRADA)
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
      importeActual: importe(det.importeActual),
      importeAnterior: importe(det.importeAnterior),
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
  data: CambiosDetalle,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = CambiosDetalleSchema.safeParse(data)
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues))
    if (!(await updateDetalle(ejercicioId, detalleId, parsed.data))) {
      return actionError(DETALLE_NO_ENCONTRADO)
    }
    // La columna "ejercicio anterior" de una nota forma parte del comparativo: tocarla
    // invalida la autorización de saldos del ejercicio anterior.
    if (parsed.data.importeAnterior !== undefined) await marcarComparativoModificado(ejercicioId)
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
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!(await deleteDetalle(ejercicioId, detalleId))) return actionError(DETALLE_NO_ENCONTRADO)
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
  dataRecibida: {
    adopcionRT54?: AdopcionRT54 | null
    criteriosBienesCambio?: CriteriosBienesCambio | null
    hechosPosterioress?: boolean | null
    hechosPosterioressTexto?: string | null
  },
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    // Nunca se copia el objeto recibido en el ejercicio: podría traer el estado, la confirmación
    // de los estados o cualquier otra columna.
    const parsed = ConfigNotaISchema.safeParse(dataRecibida)
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues))
    const data = parsed.data

    // 1. Guardar config en el ejercicio
    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data: {
        adopcionRT54: data.adopcionRT54,
        criteriosBienesCambio: data.criteriosBienesCambio,
        hechosPosterioress: data.hechosPosterioress,
        hechosPosterioressTexto: data.hechosPosterioressTexto,
      },
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
