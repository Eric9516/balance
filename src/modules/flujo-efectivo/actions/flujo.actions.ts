'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import {
  findEjercicioById,
  marcarComparativoModificado,
  resetEstadosConfirmado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { cambioColumnaAnterior, conceptoDuplicado, FLUJO_VACIO } from '../domain/calculo'
import {
  SECCION_FLUJO_LABELS,
  SECCIONES_FLUJO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type SeccionFlujo,
} from '../domain/types'
import {
  crearItemsFlujo,
  eliminarItemFlujo,
  findFlujo,
  guardarFlujoLote,
} from '../repository/flujo.repository'
import { cargarFlujo } from '../services/flujo.service'

const importe = z.number().finite()
const concepto = z
  .string()
  .trim()
  .min(1, 'El concepto no puede quedar vacío.')
  .max(200, 'El concepto no puede superar los 200 caracteres.')

const BorradorSchema = z.object({
  saldoInicial: importe,
  modificacionesEjAnt: importe,
  saldoInicialAnterior: importe,
  modificacionesEjAntAnt: importe,
  items: z.array(z.object({ id: z.string().min(1), concepto, importe, importeAnterior: importe })),
})

function revalPath(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

function errorFormulario(mensaje?: string): AppError {
  return {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    codigo: 'FORM-001',
    mensaje: mensaje ?? 'Datos inválidos en el Estado de Flujo de Efectivo.',
  }
}

function errorDuplicado(l: { seccion: SeccionFlujo; concepto: string }): AppError {
  return {
    tipo: 'NEGOCIO',
    severidad: 'BAJO',
    codigo: 'NEG-050',
    mensaje: `Ya hay una línea "${l.concepto.trim()}" en ${SECCION_FLUJO_LABELS[l.seccion]}. Usá un concepto distinto o cargá el importe en la existente.`,
    campo: 'concepto',
  }
}

const EJERCICIO_NO_ENCONTRADO: AppError = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'Ejercicio no encontrado',
}

async function cargarConEstados(ejercicio: EjercicioContableDTO, guardado?: FlujoGuardadoDTO) {
  const cuentas = await findCuentasByEjercicio(ejercicio.id)
  const { estadosData } = await cargarEstadosConPN(ejercicio, cuentas)
  return cargarFlujo(ejercicio, estadosData, guardado)
}

/**
 * Guarda todo el flujo de una vez. Lo que manda el cliente se SANEA con el mismo
 * armado que usa la pantalla: efectivo al inicio y al cierre salen del balance, y en
 * VINCULADO la columna anterior sale del flujo del anterior. Sección y orden de las
 * líneas no se toman del cliente. En MANUAL, tocar la columna anterior anula la
 * autorización del comparativo.
 */
export async function guardarFlujoAction(
  ejercicioId: string,
  sociedadId: string,
  borrador: FlujoGuardadoDTO,
): Promise<ActionResult<FlujoGuardadoDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = BorradorSchema.safeParse(borrador)
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues[0]?.message))

    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)

    const actual = (await findFlujo(ejercicioId)) ?? FLUJO_VACIO
    const recibidos = new Map(parsed.data.items.map((i) => [i.id, i]))
    // Solo líneas propias; sección y orden vienen de la base.
    const items: FlujoItemDTO[] = actual.items.map((i) => {
      const r = recibidos.get(i.id)
      return r
        ? { ...i, concepto: r.concepto, importe: r.importe, importeAnterior: r.importeAnterior }
        : i
    })
    const duplicado = conceptoDuplicado(items)
    if (duplicado) return actionError(errorDuplicado(duplicado))

    const flujo = await cargarConEstados(ejercicio, {
      ...actual,
      saldoInicial: parsed.data.saldoInicial,
      modificacionesEjAnt: parsed.data.modificacionesEjAnt,
      saldoInicialAnterior: parsed.data.saldoInicialAnterior,
      modificacionesEjAntAnt: parsed.data.modificacionesEjAntAnt,
      items,
    })
    const guardado = await guardarFlujoLote(ejercicioId, flujo.guardado)

    if (modoEfectivo(ejercicio) === 'MANUAL' && cambioColumnaAnterior(actual, guardado)) {
      await marcarComparativoModificado(ejercicioId)
    } else {
      await resetEstadosConfirmado(ejercicioId)
    }

    revalPath(sociedadId, ejercicioId)
    return actionOk(guardado)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_flujo_efectivo' }),
    )
  }
}

/** Alta estructural de una línea (importes en 0). Se persiste de inmediato. */
export async function crearItemFlujoAction(
  ejercicioId: string,
  sociedadId: string,
  seccion: SeccionFlujo,
  textoConcepto: string,
): Promise<ActionResult<FlujoItemDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const sec = z.enum(SECCIONES_FLUJO as [SeccionFlujo, ...SeccionFlujo[]]).safeParse(seccion)
    const con = concepto.safeParse(textoConcepto)
    if (!sec.success) return actionError(errorFormulario('Sección del flujo inválida.'))
    if (!con.success) return actionError(errorFormulario(con.error.issues[0]?.message))

    const actual = await findFlujo(ejercicioId)
    const nueva = { seccion: sec.data, concepto: con.data }
    const duplicado = conceptoDuplicado([...(actual?.items ?? []), nueva])
    if (duplicado) return actionError(errorDuplicado(duplicado))

    const [creado] = await crearItemsFlujo(ejercicioId, [nueva])
    revalPath(sociedadId, ejercicioId)
    return actionOk(creado!)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'crear_item_flujo' }),
    )
  }
}

/**
 * VINCULADO: crea las líneas que el flujo del anterior tiene y este no, con su importe
 * anterior ya derivado. El servidor decide cuáles faltan; el cliente no manda nada.
 */
export async function traerConceptosAnteriorAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<FlujoItemDTO[]>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)
    if (modoEfectivo(ejercicio) !== 'VINCULADO') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-051',
        mensaje:
          'Solo se pueden traer los conceptos del ejercicio anterior cuando el ejercicio está vinculado a él.',
      })
    }
    const flujo = await cargarConEstados(ejercicio)
    const creados = await crearItemsFlujo(
      ejercicioId,
      flujo.conceptosSoloAnterior.map((c) => ({
        seccion: c.seccion,
        concepto: c.concepto,
        importeAnterior: c.importe,
      })),
    )
    revalPath(sociedadId, ejercicioId)
    return actionOk(creados)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'traer_conceptos_flujo' }),
    )
  }
}

/** Baja estructural de una línea. Se persiste de inmediato. */
export async function eliminarItemFlujoAction(
  ejercicioId: string,
  sociedadId: string,
  itemId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)
    const linea = (await findFlujo(ejercicioId))?.items.find((i) => i.id === itemId)
    if (!linea || !(await eliminarItemFlujo(ejercicioId, itemId))) {
      return actionError({ ...EJERCICIO_NO_ENCONTRADO, mensaje: 'Línea del flujo no encontrada' })
    }
    // En MANUAL, borrar una línea con importe anterior cambia la columna autorizada.
    if (modoEfectivo(ejercicio) === 'MANUAL' && linea.importeAnterior !== 0) {
      await marcarComparativoModificado(ejercicioId)
    } else if (linea.importe !== 0) {
      await resetEstadosConfirmado(ejercicioId)
    }
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'eliminar_item_flujo' }),
    )
  }
}
