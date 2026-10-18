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
import { modoEfectivo } from '../domain/ejercicioAnterior'
import {
  validarAutorizacionFinal,
  type ContextoAutorizacion,
  type ResultadoAutorizacion,
} from '../domain/autorizacion'
import type { EjercicioContableDTO } from '../domain/types'
import { findEjercicioById } from '../repository/ejercicio.repository'
import { reemplazarValidacionesAutorizacion } from '../repository/validaciones.repository'

export type EvaluacionAutorizacion = ResultadoAutorizacion & { ejercicio: EjercicioContableDTO }

export async function armarContextoAutorizacion(
  ejercicio: EjercicioContableDTO,
  precargado?: { estados?: EstadosConPN },
): Promise<ContextoAutorizacion> {
  const modo = modoEfectivo(ejercicio)
  const esPrimeraAdopcion = ejercicio.adopcionRT54 === 'PRIMERA_ADOPCION'
  const necesitaEstados = modo === 'MANUAL' || esPrimeraAdopcion

  const [sociedad, anterior, estados, ajustes] = await Promise.all([
    findSociedadById(ejercicio.sociedadId),
    modo === 'VINCULADO' && ejercicio.ejercicioAnteriorId
      ? findEjercicioById(ejercicio.ejercicioAnteriorId)
      : Promise.resolve(null),
    precargado?.estados
      ? Promise.resolve(precargado.estados)
      : necesitaEstados
        ? findCuentasByEjercicio(ejercicio.id).then((cuentas) =>
            cargarEstadosConPN(ejercicio, cuentas),
          )
        : Promise.resolve(null),
    esPrimeraAdopcion ? findAjustesByEjercicio(ejercicio.id) : Promise.resolve([]),
  ])

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
    cuadreAnterior:
      modo === 'MANUAL' && estados ? totalesAnteriorSSP(estados.estadosData, estados.pnData) : null,
    resultadoAnterior:
      modo === 'MANUAL' && estados
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
  }
}

/** Evaluación de solo lectura (para renderizar el checklist sin escribir en la base). */
export async function evaluarAutorizacionSinPersistir(
  ejercicio: EjercicioContableDTO,
  precargado?: { estados?: EstadosConPN },
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
