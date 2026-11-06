'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { faltaPermiso } from '@/lib/estudio-context'
import { formatCurrency } from '@/lib/utils/currency'
import { restar } from '@/lib/importe'
import {
  findEjercicioById,
  marcarComparativoModificado,
  resetEstadosConfirmado,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import {
  cambioColumnaActual,
  cambioColumnaAnterior,
  conceptoDuplicado,
  FLUJO_VACIO,
} from '../domain/calculo'
import {
  SECCION_FLUJO_LABELS,
  SECCIONES_FLUJO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type SeccionFlujo,
} from '../domain/types'
import {
  lineasParaAplicar,
  proponerFlujo,
  type EleccionesPropuesta,
  type InsumosPropuesta,
} from '../domain/propuesta'
import { cargarInsumosPropuesta } from '../services/propuesta.service'
import {
  aplicarLineasDeLaApp,
  crearItemsFlujo,
  eliminarItemFlujo,
  findFlujo,
  guardarFlujoLote,
  leerFlujo,
  quitarRevisionRecpam,
  revisarRecpam,
} from '../repository/flujo.repository'
import { cargarFlujo } from '../services/flujo.service'
import { anteriorAjustado } from '@/modules/comparativo-manual/lib/ajuste'

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
    // Ya ajustado, lo que manda la pantalla en la columna anterior es el valor ajustado: lo cargado
    // no se toca.
    const ajustado = anteriorAjustado(ejercicio)
    // Las líneas que arma la app conservan su nombre; el RECPAM lo recalcula el armado.
    const items: FlujoItemDTO[] = actual.items.map((i) => {
      const r = recibidos.get(i.id)
      return r
        ? {
            ...i,
            concepto: i.origen ? i.concepto : r.concepto,
            importe: r.importe,
            importeAnterior: ajustado ? i.importeAnterior : r.importeAnterior,
          }
        : i
    })
    const duplicado = conceptoDuplicado(items)
    if (duplicado) return actionError(errorDuplicado(duplicado))

    const flujo = await cargarConEstados(ejercicio, {
      ...actual,
      saldoInicial: parsed.data.saldoInicial,
      modificacionesEjAnt: parsed.data.modificacionesEjAnt,
      saldoInicialAnterior: ajustado
        ? actual.saldoInicialAnterior
        : parsed.data.saldoInicialAnterior,
      modificacionesEjAntAnt: ajustado
        ? actual.modificacionesEjAntAnt
        : parsed.data.modificacionesEjAntAnt,
      items,
    })
    const guardado = await guardarFlujoLote(ejercicioId, flujo.guardado)
    // Cambió la columna del ejercicio actual: el RECPAM se vuelve a revisar.
    if (cambioColumnaActual(actual, guardado)) await quitarRevisionRecpam(ejercicioId)

    if (
      modoEfectivo(ejercicio) === 'MANUAL' &&
      !ajustado &&
      cambioColumnaAnterior(actual, guardado)
    ) {
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

/**
 * Alta estructural de una línea (importes en 0). Se persiste de inmediato. Devuelve las líneas
 * creadas: con la primera del flujo llega también la de RECPAM.
 */
export async function crearItemFlujoAction(
  ejercicioId: string,
  sociedadId: string,
  seccion: SeccionFlujo,
  textoConcepto: string,
): Promise<ActionResult<FlujoItemDTO[]>> {
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

    const creados = await crearItemsFlujo(ejercicioId, [nueva])
    await quitarRevisionRecpam(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk(creados)
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
    if (linea?.origen === 'RECPAM') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-070',
        mensaje:
          'La línea de RECPAM no se elimina: es la diferencia para que el Estado de Flujo de Efectivo cierre y la calcula la app. Si su importe no es razonable, revisá las demás líneas.',
      })
    }
    if (!linea || !(await eliminarItemFlujo(ejercicioId, itemId))) {
      return actionError({ ...EJERCICIO_NO_ENCONTRADO, mensaje: 'Línea del flujo no encontrada' })
    }
    await quitarRevisionRecpam(ejercicioId)
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

/**
 * El dueño o un contador da por revisado el RECPAM que calculó la app. Recibe el importe que vio en
 * pantalla: si mientras tanto cambió (otra persona, o el balance), no lo da por revisado.
 */
export async function revisarRecpamAction(
  ejercicioId: string,
  sociedadId: string,
  importeVisto: number,
): Promise<ActionResult<void>> {
  try {
    const sinPermiso = await faltaPermiso('confirmar_y_cerrar')
    if (sinPermiso) return actionError(sinPermiso)
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    if (!Number.isFinite(importeVisto)) return actionError(errorFormulario())
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)

    const { recpam } = await cargarConEstados(ejercicio)
    if (!recpam) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'BAJO',
        codigo: 'NEG-070',
        mensaje:
          'Este Estado de Flujo de Efectivo todavía no tiene línea de RECPAM: se agrega sola con la primera línea que cargues.',
      })
    }
    if (restar(recpam.importe, importeVisto) !== 0) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-071',
        mensaje: `El RECPAM cambió mientras lo revisabas: ahora es ${formatCurrency(recpam.importe, { decimales: 'todos' })}. Recargá la página y revisalo de nuevo.`,
      })
    }
    await revisarRecpam(ejercicioId, recpam.importe)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'revisar_recpam' }),
    )
  }
}

/** Lo que la propuesta necesita del balance. Solo lee: se pide al abrir "Proponer desde el balance". */
export async function cargarPropuestaFlujoAction(
  ejercicioId: string,
): Promise<ActionResult<InsumosPropuesta>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)
    return actionOk(await cargarInsumosPropuesta(ejercicio))
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'cargar_propuesta_flujo' }),
    )
  }
}

const importeOpcional = importe.nullable()
const EleccionesSchema = z.object({
  tiposGasto: z.record(z.string(), z.enum(['PROVEEDORES', 'PERSONAL', 'IMPUESTOS', 'NO_ES_PAGO'])),
  rubros: z.record(z.string(), z.boolean()),
  gananciasPagado: importeOpcional,
  prestamosRecibidos: importeOpcional,
  prestamosCancelados: importeOpcional,
})

/**
 * Usa la propuesta: pone en el flujo las líneas que arma la app con lo que eligió el contador. Los
 * importes los vuelve a calcular el servidor con lo que hay en la base (de la pantalla solo toma las
 * elecciones). El RECPAM se recalcula y queda pendiente de revisión.
 */
export async function aplicarPropuestaFlujoAction(
  ejercicioId: string,
  sociedadId: string,
  elecciones: EleccionesPropuesta,
): Promise<ActionResult<FlujoGuardadoDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const parsed = EleccionesSchema.safeParse(elecciones)
    if (!parsed.success) return actionError(errorFormulario(parsed.error.issues[0]?.message))
    const ejercicio = await findEjercicioById(ejercicioId)
    if (!ejercicio) return actionError(EJERCICIO_NO_ENCONTRADO)

    const propuesta = proponerFlujo(await cargarInsumosPropuesta(ejercicio), parsed.data)
    const existentes = new Set(
      ((await findFlujo(ejercicioId))?.items ?? []).flatMap((i) => (i.origen ? [i.origen] : [])),
    )
    await aplicarLineasDeLaApp(
      ejercicioId,
      lineasParaAplicar(propuesta, existentes).map((l) => ({
        origen: l.origen,
        importe: l.importe,
      })),
    )
    // El mismo armado que al guardar: el RECPAM se recalcula y lo derivado sale del balance.
    const leido = await leerFlujo(ejercicioId)
    const flujo = await cargarConEstados(ejercicio, leido ?? undefined)
    const guardado = await guardarFlujoLote(ejercicioId, flujo.guardado)
    await quitarRevisionRecpam(ejercicioId)
    await resetEstadosConfirmado(ejercicioId)
    revalPath(sociedadId, ejercicioId)
    return actionOk({ ...guardado, recpamRevisado: null })
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'aplicar_propuesta_flujo' }),
    )
  }
}
