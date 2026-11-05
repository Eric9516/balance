'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import {
  CreateEjercicioSchema,
  UpdateEjercicioSchema,
  type CreateEjercicioInput,
  type UpdateEjercicioInput,
} from '../schemas/ejercicio.schemas'
import {
  createEjercicio,
  updateEjercicio,
  cambiarEstado,
  deleteEjercicio,
  findEjercicioById,
  findSucesorId,
  aplicarEfectosCambioModo,
  autorizarComparativo,
  formatoAnexoDelAnterior,
} from '../repository/ejercicio.repository'
import { efectosCambioModo } from '../domain/ejercicioAnterior'
import { faltaConfirmarParaAvanzar } from '../domain/avance'
import { validarConfiguracionAnterior } from '../services/ejercicio-anterior.service'
import {
  compuertaAutorizacion,
  evaluarAutorizacionEjercicio,
  type EvaluacionAutorizacion,
} from '../services/autorizacion.service'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { esAuditorDelEstudio } from '@/modules/auditores/repository/auditor.repository'
import { ESTADO_LABELS, type EjercicioContableDTO } from '../domain/types'
import type { EstadoEjercicio } from '@prisma/client'
import { faltaPermiso } from '@/lib/estudio-context'

const VALID_TRANSITIONS: Record<EstadoEjercicio, EstadoEjercicio[]> = {
  BORRADOR: ['EN_PROCESO'],
  EN_PROCESO: ['REVISION'],
  REVISION: ['CERRADO', 'EN_PROCESO'],
  CERRADO: [],
}

const EJERCICIO_NO_ENCONTRADO: AppError = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'Ejercicio no encontrado',
}

/** Estados a los que solo se llega con la compuerta de autorización aprobada. */
const ESTADOS_CON_COMPUERTA: EstadoEjercicio[] = ['REVISION', 'CERRADO']

function formError(parsed: { error: { issues: { message: string; path: PropertyKey[] }[] } }) {
  return actionError({
    tipo: 'FORMULARIO' as const,
    severidad: 'BAJO' as const,
    codigo: 'FORM-001',
    mensaje: 'Datos inválidos',
    detalle: parsed.error.issues[0]?.message,
    campo: parsed.error.issues[0]?.path.join('.'),
  })
}

/** El auditor viene de la pantalla: tiene que ser del estudio actual (sale en el informe). */
async function validarAuditor(
  estudioId: string,
  input: CreateEjercicioInput,
): Promise<ActionResult<never> | null> {
  if (!input.auditorId || (await esAuditorDelEstudio(estudioId, input.auditorId))) return null
  return actionError({
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    codigo: 'FORM-001',
    mensaje: 'El auditor elegido no es de este estudio. Elegí otro de la lista.',
    campo: 'auditorId',
  })
}

async function validarAnterior(
  sociedadId: string,
  actualId: string | null,
  input: CreateEjercicioInput,
): Promise<ActionResult<never> | null> {
  const { errores } = await validarConfiguracionAnterior({
    sociedadId,
    actualId,
    fechaInicio: new Date(input.fechaInicio),
    modoAnterior: input.modoAnterior,
    ejercicioAnteriorId:
      input.modoAnterior === 'VINCULADO' ? input.ejercicioAnteriorId || null : null,
  })
  if (errores.length === 0) return null
  return actionError({
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    codigo: 'NEG-010',
    mensaje: errores[0] ?? 'Configuración del ejercicio anterior inválida',
    campo: 'ejercicioAnteriorId',
  })
}

export async function crearEjercicio(
  sociedadId: string,
  input: CreateEjercicioInput,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    const parsed = CreateEjercicioSchema.safeParse(input)
    if (!parsed.success) return formError(parsed)
    // La sociedad viene de la pantalla: tiene que ser del estudio actual.
    // El formato del Anexo de Bienes de Uso se hereda del balance anterior de la sociedad.
    const [sociedad, estudioId, formatoAnterior] = await Promise.all([
      findSociedadById(sociedadId),
      getCurrentEstudioId(),
      formatoAnexoDelAnterior(sociedadId, new Date(parsed.data.fechaInicio)),
    ])
    if (!sociedad || sociedad.estudioId !== estudioId) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Sociedad no encontrada en este estudio. Recargá la página y volvé a intentar.',
      })
    }
    const invalido =
      (await validarAuditor(estudioId, parsed.data)) ??
      (await validarAnterior(sociedadId, null, parsed.data))
    if (invalido) return invalido

    const ejercicio = await createEjercicio(
      sociedadId,
      estudioId,
      parsed.data,
      formatoAnterior ?? undefined,
    )
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'crear' }))
  }
}

export async function actualizarEjercicio(
  id: string,
  sociedadId: string,
  input: UpdateEjercicioInput,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    const parsed = UpdateEjercicioSchema.safeParse(input)
    if (!parsed.success) return formError(parsed)
    await assertEjercicioBelongsToCurrentEstudio(id)
    const existing = await findEjercicioById(id)
    if (!existing) return actionError(EJERCICIO_NO_ENCONTRADO)
    // El anterior se valida contra la sociedad guardada, no contra la que mande la pantalla.
    const invalido =
      (await validarAuditor(existing.estudioId, parsed.data)) ??
      (await validarAnterior(existing.sociedadId, id, parsed.data))
    if (invalido) return invalido

    const ejercicio = await updateEjercicio(id, parsed.data)
    // Cambiar modo o vínculo invalida lo que dependía del anterior.
    const efectos = efectosCambioModo(
      { modoAnterior: existing.modoAnterior, ejercicioAnteriorId: existing.ejercicioAnteriorId },
      { modoAnterior: ejercicio.modoAnterior, ejercicioAnteriorId: ejercicio.ejercicioAnteriorId },
    )
    await aplicarEfectosCambioModo(id, efectos)
    // Con otros índices cambia el ajuste: lo autorizado se vuelve a revisar y a autorizar.
    if (
      existing.anteriorAjustadoEn &&
      (existing.indiceInflacionAnterior !== ejercicio.indiceInflacionAnterior ||
        existing.indiceInflacionActual !== ejercicio.indiceInflacionActual)
    ) {
      await aplicarEfectosCambioModo(id, {
        limpiarComparativosManuales: false,
        anularAutorizacion: true,
        desconfirmar: true,
      })
    }

    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${id}/cuentas`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'actualizar' }))
  }
}

export async function avanzarEstadoEjercicio(
  id: string,
  sociedadId: string,
  estadoActual: EstadoEjercicio,
  nuevoEstado: EstadoEjercicio,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    // Más allá de empezar (Borrador → En proceso), cambiar de estado es confirmar o cerrar
    if (!(estadoActual === 'BORRADOR' && nuevoEstado === 'EN_PROCESO')) {
      const sinPermiso = await faltaPermiso('confirmar_y_cerrar')
      if (sinPermiso) return actionError(sinPermiso)
    }
    await assertEjercicioBelongsToCurrentEstudio(id)
    const existing = await findEjercicioById(id)
    if (!existing) return actionError(EJERCICIO_NO_ENCONTRADO)
    // La transición se valida contra el estado guardado y no contra el que muestra la pantalla:
    // si no, una petición manipulada podría reabrir un ejercicio cerrado.
    const estado = existing.estado
    if (estado !== estadoActual) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-001',
        mensaje: `El ejercicio está en estado "${ESTADO_LABELS[estado]}" y no "${ESTADO_LABELS[estadoActual] ?? estadoActual}". Recargá la página para ver su estado actual.`,
      })
    }
    const validos = VALID_TRANSITIONS[estado]
    if (!validos.includes(nuevoEstado)) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-001',
        mensaje: `Transición de estado inválida: ${estado} → ${nuevoEstado}`,
      })
    }
    if (ESTADOS_CON_COMPUERTA.includes(nuevoEstado)) {
      const faltan = faltaConfirmarParaAvanzar(existing)
      if (faltan.length > 0) {
        return actionError({
          tipo: 'NEGOCIO',
          severidad: 'MEDIO',
          codigo: 'NEG-004',
          mensaje: `No se puede pasar el ejercicio a ${ESTADO_LABELS[nuevoEstado]}: falta confirmar ${faltan.join(' y ')}. Confirmalos en sus pasos y volvé a intentar.`,
        })
      }
      const bloqueo = await compuertaAutorizacion(id)
      if (bloqueo) return actionError(bloqueo)
    }
    const ejercicio = await cambiarEstado(id, estado, nuevoEstado)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'cambiar_estado' }))
  }
}

export async function eliminarEjercicio(
  id: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('confirmar_y_cerrar')
    if (sinPermiso) return actionError(sinPermiso)
    await assertEjercicioBelongsToCurrentEstudio(id)
    const existing = await findEjercicioById(id)
    if (!existing) return actionError(EJERCICIO_NO_ENCONTRADO)
    if (existing.estado !== 'BORRADOR') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-002',
        mensaje: 'Solo se pueden eliminar ejercicios en estado Borrador',
      })
    }
    // Borrarlo dejaría al sucesor sin saldos de inicio ni comparativo (SET NULL silencioso).
    const sucesorId = await findSucesorId(id)
    if (sucesorId) {
      const sucesor = await findEjercicioById(sucesorId)
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-003',
        mensaje: `No se puede eliminar: ${sucesor?.denominacion ?? 'otro ejercicio'} lo usa como ejercicio anterior. Desvinculalo primero desde "Editar ejercicio".`,
      })
    }
    await deleteEjercicio(id)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'eliminar' }))
  }
}

// ─── Ejercicio anterior en modo MANUAL: autorización explícita ───────────────

/** Re-evalúa la compuerta (para refrescar el checklist) sin cambiar nada. */
export async function evaluarAutorizacionAction(
  ejercicioId: string,
): Promise<ActionResult<EvaluacionAutorizacion>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const evaluacion = await evaluarAutorizacionEjercicio(ejercicioId)
    if (!evaluacion) return actionError(EJERCICIO_NO_ENCONTRADO)
    return actionOk(evaluacion)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ejercicios', operacion: 'evaluar_autorizacion' }),
    )
  }
}

/**
 * El contador declara que los saldos del ejercicio anterior cargados a mano
 * corresponden a los estados contables del período previo. Solo en modo MANUAL y
 * solo si el anterior cuadra y es consistente (misma compuerta, sin exigirse a sí misma).
 */
/**
 * Quita la autorización y el ajuste del anterior cargado a mano, para corregir lo cargado. Después
 * se autoriza de nuevo. Lo que se había confirmado se confirma de nuevo: sus números cambian.
 */
export async function corregirAnteriorAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)
    if (ejercicio.estado === 'CERRADO') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-065',
        mensaje: 'Este ejercicio está cerrado: no se pueden corregir los saldos del anterior.',
      })
    }
    await aplicarEfectosCambioModo(ejercicioId, {
      limpiarComparativosManuales: false,
      anularAutorizacion: true,
      desconfirmar: true,
    })
    await evaluarAutorizacionEjercicio(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ejercicios', operacion: 'corregir_anterior' }),
    )
  }
}

export async function autorizarComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  autorizadoPor: string,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('confirmar_y_cerrar')
    if (sinPermiso) return actionError(sinPermiso)
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const nombre = autorizadoPor.trim()
    if (!nombre) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Indicá quién autoriza los saldos del ejercicio anterior.',
        campo: 'autorizadoPor',
      })
    }
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)
    if (ejercicio.modoAnterior !== 'MANUAL') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-011',
        mensaje:
          'La autorización de saldos solo aplica cuando el ejercicio anterior se carga manualmente.',
      })
    }
    if (!ejercicio.indiceInflacionAnterior || !ejercicio.indiceInflacionActual) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-064',
        mensaje:
          'No se pueden autorizar los saldos del ejercicio anterior porque faltan los índices de inflación, y sin ellos no se pueden ajustar. Cargalos en "Editar ejercicio".',
      })
    }
    const bloqueo = await compuertaAutorizacion(ejercicioId, { ignorarCodigos: ['AUT-010'] })
    if (bloqueo) return actionError(bloqueo)

    await autorizarComparativo(
      ejercicioId,
      nombre,
      ejercicio.indiceInflacionAnterior !== ejercicio.indiceInflacionActual,
    )
    // Dejar el checklist consistente (AUT-010 desaparece).
    await evaluarAutorizacionEjercicio(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ejercicios', operacion: 'autorizar_comparativo' }),
    )
  }
}
