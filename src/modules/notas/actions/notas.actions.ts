'use server'

import { deleteDocumentoManualDeNota } from '@/modules/documentos/repository/documento.repository'
import { esUuid } from '@/lib/utils/uuid'
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
  ubicarNota,
  createDetalle,
  updateDetalle,
  deleteDetalle,
  aplicarRegeneracion,
  findNotasByEjercicio,
  type CambiosDetalle,
  type CambiosNota,
} from '../repository/notas.repository'
import {
  CRITERIO_LABEL,
  OPCIONES_POR_DEFECTO,
  PALABRAS_BIENES_DE_CAMBIO,
  planificarRegeneracion,
  resumirPlan,
  TITULO_HECHOS,
  textoNotaHechos,
  type OpcionesRegeneracion,
  type PlanRegeneracion,
  type ResumenRegeneracion,
} from '../domain/regeneracion'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import {
  findConfigAnterior,
  findEjercicioById,
  guardarNotaUno,
  marcarComparativoModificado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
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
// El importe del ejercicio actual no se edita: sale del saldo de cada cuenta en el balance (lo
// pone la generación de notas). zod lo descarta si la pantalla lo manda.
const CambiosDetalleSchema = z.object({
  concepto: z.string().optional(),
  importeAnterior: z.number().finite().optional(),
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
    const titulo = (await findNotasByEjercicio(ejercicioId)).find((n) => n.id === notaId)?.titulo
    if (!(await deleteNota(ejercicioId, notaId))) return actionError(NOTA_NO_ENCONTRADA)
    // Si se agregó a mano en Anexos → Configuración, también se va de esa lista.
    if (titulo) await deleteDocumentoManualDeNota(ejercicioId, titulo)
    await renumerarNotas(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'eliminar_nota' }))
  }
}

/** Ubica la nota debajo de otra (null: primera). Cambia su número, en el balance y en los estados. */
export async function moverNotaAction(
  notaId: string,
  ejercicioId: string,
  sociedadId: string,
  debajoDe: string | null,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!esUuid(notaId) || (debajoDe !== null && !esUuid(debajoDe))) {
      return actionError(NOTA_NO_ENCONTRADA)
    }
    if (!(await ubicarNota(ejercicioId, notaId, debajoDe))) return actionError(NOTA_NO_ENCONTRADA)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'mover_nota' }))
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
    // La columna anterior solo se carga a mano en modo MANUAL: en VINCULADO sale del ejercicio
    // anterior y, sin anterior, no hay columna.
    if (
      parsed.data.importeAnterior !== undefined &&
      (await findConfigAnterior(ejercicioId))?.modoAnterior !== 'MANUAL'
    ) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-012',
        mensaje:
          'La columna "Ejercicio anterior" de las notas solo se carga a mano cuando el ejercicio está en modo "Carga manual". Si está vinculado, sale del ejercicio anterior.',
      })
    }
    // Ya ajustado, lo que manda la pantalla es el valor ajustado: lo cargado no se toca.
    const importeAnterior =
      parsed.data.importeAnterior !== undefined &&
      (await findConfigAnterior(ejercicioId))?.anteriorAjustadoEn
        ? undefined
        : parsed.data.importeAnterior
    if (!(await updateDetalle(ejercicioId, detalleId, { ...parsed.data, importeAnterior }))) {
      return actionError(DETALLE_NO_ENCONTRADO)
    }
    // La columna "ejercicio anterior" de una nota forma parte del comparativo: tocarla
    // invalida la autorización de saldos del ejercicio anterior.
    if (importeAnterior !== undefined) await marcarComparativoModificado(ejercicioId)
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
    const textoHechos = data.hechosPosterioressTexto?.trim() || null
    if (data.hechosPosterioress === true && textoHechos === null) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-007',
        mensaje:
          'Elegiste que hay hechos posteriores al cierre pero no escribiste cuáles. Describilos o elegí una de las opciones "No".',
        campo: 'hechosPosterioressTexto',
      })
    }

    // 1. Guardar config en el ejercicio
    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data: {
        adopcionRT54: data.adopcionRT54,
        criteriosBienesCambio: data.criteriosBienesCambio,
        hechosPosterioress: data.hechosPosterioress,
        // undefined: no cambia; vacío: null (con "No", sin nota)
        hechosPosterioressTexto:
          data.hechosPosterioressTexto === undefined ? undefined : textoHechos,
      },
    })

    // 2. Actualizar criterio de bienes de cambio en notas existentes (solo la de bienes de cambio:
    // "bienes de uso" o "bienes intangibles" conservan el suyo)
    if (data.criteriosBienesCambio) {
      const nuevoCriterio = CRITERIO_LABEL[data.criteriosBienesCambio]
      if (nuevoCriterio) {
        await db.notaEjercicio.updateMany({
          where: {
            ejercicioId,
            AND: PALABRAS_BIENES_DE_CAMBIO.map((p) => ({
              titulo: { contains: p, mode: 'insensitive' as const },
            })),
            tipo: 'CUANTITATIVA',
            criterioMedicion: { not: null },
          },
          data: { criterioMedicion: nuevoCriterio },
        })
      }
    }

    // 3. Sincronizar nota de Hechos Posteriores: va si hay texto (ver textoNotaHechos)
    if (data.hechosPosterioress !== undefined) {
      const textoNota = textoNotaHechos({
        hechosPosterioress: data.hechosPosterioress,
        hechosPosterioressTexto: textoHechos,
      })
      const notaExistente = await db.notaEjercicio.findFirst({
        where: { ejercicioId, titulo: TITULO_HECHOS },
        select: { id: true, orden: true },
      })

      if (textoNota !== null) {
        if (notaExistente) {
          // Actualizar texto de la nota existente
          await db.notaEjercicio.update({
            where: { id: notaExistente.id },
            data: { textoApertura: textoNota },
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
              textoApertura: textoNota,
            },
          })
        }
      } else if (notaExistente) {
        // Eliminar la nota y renumerar
        await db.notaEjercicio.delete({ where: { id: notaExistente.id } })
        await renumerarNotas(ejercicioId)
      }
    }

    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'guardar_config_nota_i' }))
  }
}

// ─── Generación y regeneración ────────────────────────────────────────────────

const SIN_CUENTAS: AppError = {
  tipo: 'NEGOCIO',
  severidad: 'MEDIO',
  codigo: 'NEG-020',
  mensaje: 'No hay cuentas clasificadas. Importá y clasificá las cuentas primero.',
}

/** Plan de regeneración del ejercicio (todas las lecturas en un solo viaje). */
async function planDelEjercicio(
  estudioId: string,
  ejercicioId: string,
): Promise<PlanRegeneracion | null> {
  const [cuentas, rubros, ejercicio, notas] = await Promise.all([
    findCuentasByEjercicio(ejercicioId),
    findRubrosBase(estudioId),
    db.ejercicioContable.findUnique({
      where: { id: ejercicioId },
      select: {
        criteriosBienesCambio: true,
        hechosPosterioress: true,
        hechosPosterioressTexto: true,
      },
    }),
    findNotasByEjercicio(ejercicioId),
  ])
  if (cuentas.length === 0) return null
  return planificarRegeneracion({
    notas,
    rubros,
    cuentas,
    config: {
      criteriosBienesCambio: ejercicio?.criteriosBienesCambio ?? null,
      hechosPosterioress: ejercicio?.hechosPosterioress ?? null,
      hechosPosterioressTexto: ejercicio?.hechosPosterioressTexto ?? null,
    },
  })
}

/** Qué cambiaría al regenerar las notas, para que el usuario elija. No modifica nada. */
export async function previsualizarRegeneracionAction(
  ejercicioId: string,
): Promise<ActionResult<ResumenRegeneracion>> {
  try {
    const estudioId = await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const plan = await planDelEjercicio(estudioId, ejercicioId)
    if (!plan) return actionError(SIN_CUENTAS)
    return actionOk(resumirPlan(plan))
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'previsualizar_regeneracion' }),
    )
  }
}

const OpcionesSchema = z.object({
  notasNuevas: z.boolean().optional(),
  filasNuevas: z.boolean().optional(),
  importesActuales: z.boolean().optional(),
  quitarFilasSinCuenta: z.boolean().optional(),
  quitarFilasConAnterior: z.boolean().optional(),
  restaurarTextos: z.boolean().optional(),
})

/**
 * Genera las notas o las regenera con lo que elija el usuario. Sin opciones: lo que agrega o
 * actualiza desde el balance, sí; lo que borra o pisa algo cargado a mano, no. El plan se vuelve a
 * calcular acá: de la pantalla solo se toman las opciones.
 */
export async function generarNotasAutomaticasAction(
  ejercicioId: string,
  sociedadId: string,
  opciones?: Partial<OpcionesRegeneracion>,
): Promise<ActionResult<void>> {
  try {
    const estudioId = await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = OpcionesSchema.safeParse(opciones ?? {})
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues))
    const plan = await planDelEjercicio(estudioId, ejercicioId)
    if (!plan) return actionError(SIN_CUENTAS)

    const { quitoAnterior } = await aplicarRegeneracion(ejercicioId, plan, {
      ...OPCIONES_POR_DEFECTO,
      ...parsed.data,
    })
    // Quitar una fila con importe anterior cambia la columna comparativa autorizada.
    if (quitoAnterior) await marcarComparativoModificado(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'generar_automaticas' }))
  }
}

// ─── Nota 1 ───────────────────────────────────────────────────────────────────

/** Largo máximo de la Nota 1 escrita por el contador (la base lo controla igual). */
const MAX_NOTA_UNO = 50_000

/**
 * Guarda la Nota 1 escrita por el contador. `null` o un texto vacío vuelve al texto que genera la
 * app con los datos del ejercicio (que se mantiene al día solo).
 */
export async function guardarNotaUnoAction(
  ejercicioId: string,
  sociedadId: string,
  texto: string | null,
): Promise<ActionResult<{ texto: string | null }>> {
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
    if (ejercicio.estado === 'CERRADO') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-005',
        mensaje: 'El ejercicio está cerrado: la Nota 1 ya no se modifica.',
      })
    }
    const limpio = texto?.trim() ? texto.trim() : null
    if (limpio !== null && limpio.length > MAX_NOTA_UNO) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-006',
        mensaje: `La Nota 1 tiene ${limpio.length} caracteres y el máximo es 50.000. Acortala.`,
      })
    }
    await guardarNotaUno(ejercicioId, limpio)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk({ texto: limpio })
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'NOTAS', operacion: 'guardar_nota_uno' }))
  }
}
