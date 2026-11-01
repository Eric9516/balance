/**
 * Servicio: compuerta de autorización final del ejercicio.
 * Arma el contexto desde la base, evalúa el dominio y persiste el resultado en
 * errores_validacion (origen AUTORIZACION) para que quede trazable.
 */

import type { AppError } from '@/modules/errores/types'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import {
  cargarEstadosConPN,
  totalesAnteriorSSP,
  type EstadosConPN,
} from '@/modules/estados/services/estados.service'
import { totalAnteriorFila, totalFila } from '@/modules/patrimonio-neto/domain/evolucion'
import { findAjustesByEjercicio } from '@/modules/transicion-rt54/repository/ajustes.repository'
import { sumaAjustesMedicionPN } from '@/modules/transicion-rt54/domain/types'
import { findFlujo } from '@/modules/flujo-efectivo/repository/flujo.repository'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import type { FlujoData, TotalesColumna } from '@/modules/flujo-efectivo/domain/calculo'
import { modoEfectivo } from '../domain/ejercicioAnterior'
import { anteriorAjustado } from '@/modules/comparativo-manual/lib/ajuste'
import {
  validarAutorizacionFinal,
  type ContextoAutorizacion,
  type ResultadoAutorizacion,
} from '../domain/autorizacion'
import type { EjercicioContableDTO } from '../domain/types'
import { findEjercicioById } from '../repository/ejercicio.repository'
import { reemplazarValidacionesAutorizacion } from '../repository/validaciones.repository'

export type EvaluacionAutorizacion = ResultadoAutorizacion & { ejercicio: EjercicioContableDTO }

type Precargado = { estados?: EstadosConPN; flujo?: FlujoData }

const cuadreFlujo = (t: TotalesColumna) => ({
  variacionNeta: t.variacionNeta,
  sumaActividades: t.sumaActividades,
  cuadra: t.cuadra,
})

export async function armarContextoAutorizacion(
  ejercicio: EjercicioContableDTO,
  precargado?: Precargado,
): Promise<ContextoAutorizacion> {
  const modo = modoEfectivo(ejercicio)
  const ajustado = anteriorAjustado(ejercicio)
  const esPrimeraAdopcion = ejercicio.adopcionRT54 === 'PRIMERA_ADOPCION'
  const necesitaEstados = modo === 'MANUAL' || esPrimeraAdopcion
  const cargarEstados = () =>
    findCuentasByEjercicio(ejercicio.id).then((cuentas) => cargarEstadosConPN(ejercicio, cuentas))

  const [sociedad, anterior, estadosPrevios, ajustes, flujoGuardado] = await Promise.all([
    findSociedadById(ejercicio.sociedadId),
    modo === 'VINCULADO' && ejercicio.ejercicioAnteriorId
      ? findEjercicioById(ejercicio.ejercicioAnteriorId)
      : Promise.resolve(null),
    precargado?.estados
      ? Promise.resolve(precargado.estados)
      : necesitaEstados
        ? cargarEstados()
        : Promise.resolve(null),
    esPrimeraAdopcion ? findAjustesByEjercicio(ejercicio.id) : Promise.resolve([]),
    precargado?.flujo ? Promise.resolve(null) : findFlujo(ejercicio.id),
  ])

  // El flujo se controla contra el balance: solo hace falta armar los estados si tiene líneas.
  const lineasFlujo = precargado?.flujo?.guardado.items.length ?? flujoGuardado?.items.length ?? 0
  const estados =
    estadosPrevios ?? (lineasFlujo > 0 && !precargado?.flujo ? await cargarEstados() : null)
  const flujo =
    precargado?.flujo ??
    (lineasFlujo > 0 && estados
      ? await cargarFlujo(ejercicio, estados.estadosData, flujoGuardado)
      : null)

  return {
    modo,
    categoriaEnte: ejercicio.categoriaEnte,
    comparativoAutorizadoEn: ejercicio.comparativoAutorizadoEn,
    fechaInicio: ejercicio.fechaInicio,
    anterior: anterior
      ? {
          denominacion: anterior.denominacion,
          estado: anterior.estado,
          estadosConfirmado: anterior.estadosConfirmado,
          pnConfirmado: anterior.pnConfirmado,
        }
      : null,
    // Lo cargado se controló al autorizar y no cambia sin anular el ajuste; los importes ajustados
    // tienen más decimales y no se comparan exactos entre sí.
    cuadreAnterior:
      modo === 'MANUAL' && estados && !ajustado
        ? totalesAnteriorSSP(estados.estadosData, estados.pnData)
        : null,
    resultadoAnterior:
      modo === 'MANUAL' && estados && !ajustado
        ? {
            eerr: estados.estadosData.eerr.utilidadEjercicioAnt,
            eepn: totalAnteriorFila(estados.pnData.movimientos, 'RESULTADO_EJERCICIO'),
          }
        : null,
    transicion: esPrimeraAdopcion
      ? {
          esPrimeraAdopcion: true,
          sumaAjustesMedicion: sumaAjustesMedicionPN(ajustes),
          modificacionInicioEEPN: estados
            ? totalFila(estados.pnData.movimientos, 'MODIFICACION_INICIO')
            : 0,
        }
      : null,
    sociedad: sociedad ? { fechaInscripcion: sociedad.fechaInscripcion } : null,
    flujo: flujo
      ? {
          lineas: lineasFlujo,
          actual: cuadreFlujo(flujo.actual),
          anterior:
            flujo.anterior && flujo.controlarAnterior && !ajustado
              ? cuadreFlujo(flujo.anterior)
              : null,
        }
      : {
          lineas: 0,
          actual: { variacionNeta: 0, sumaActividades: 0, cuadra: true },
          anterior: null,
        },
  }
}

/** Evaluación de solo lectura (para renderizar el checklist sin escribir en la base). */
export async function evaluarAutorizacionSinPersistir(
  ejercicio: EjercicioContableDTO,
  precargado?: Precargado,
): Promise<ResultadoAutorizacion> {
  const ctx = await armarContextoAutorizacion(ejercicio, precargado)
  return validarAutorizacionFinal(ctx)
}

/** Evalúa la compuerta y deja el resultado persistido en errores_validacion. */
export async function evaluarAutorizacionEjercicio(
  ejercicioId: string,
  opciones: { ignorarCodigos?: string[] } = {},
): Promise<EvaluacionAutorizacion | null> {
  const ejercicio = await findEjercicioById(ejercicioId)
  if (!ejercicio) return null
  const ctx = await armarContextoAutorizacion(ejercicio)
  const resultado = validarAutorizacionFinal(ctx)
  const ignorar = new Set(opciones.ignorarCodigos ?? [])
  const bloqueantes = resultado.bloqueantes.filter((b) => !ignorar.has(b.codigo))
  await reemplazarValidacionesAutorizacion(ejercicioId, [...bloqueantes, ...resultado.advertencias])
  return {
    ejercicio,
    bloqueantes,
    advertencias: resultado.advertencias,
    puedeAutorizar: bloqueantes.length === 0,
  }
}

/** Devuelve el error a mostrar si el ejercicio NO puede autorizarse; null si puede. */
export async function compuertaAutorizacion(
  ejercicioId: string,
  opciones: { ignorarCodigos?: string[] } = {},
): Promise<AppError | null> {
  const evaluacion = await evaluarAutorizacionEjercicio(ejercicioId, opciones)
  if (!evaluacion) {
    return {
      tipo: 'TECNICO',
      severidad: 'ALTO',
      codigo: 'TECH-002',
      mensaje: 'Ejercicio no encontrado',
    }
  }
  if (evaluacion.puedeAutorizar) return null
  const [primero, ...resto] = evaluacion.bloqueantes
  return {
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    codigo: 'NEG-030',
    mensaje: primero?.mensaje ?? 'El ejercicio no cumple las condiciones para autorizarse.',
    detalle:
      resto.length > 0
        ? `Además hay ${resto.length} ${resto.length === 1 ? 'condición pendiente' : 'condiciones pendientes'}. Revisalas en el paso "Ejercicio anterior" o en Estados.`
        : undefined,
  }
}
