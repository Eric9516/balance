import crypto from 'crypto'
import { actionError, actionOk, type ActionResult } from '@/modules/errores/types'
import { formatCurrency } from '@/lib/utils/currency'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'
import { createImportacion, updateImportacion } from '../repository/importacion.repository'
import { replaceCuentas } from '../repository/cuentas.repository'
import { procesarFilas, validarCuadre, type FilaImportacion } from '../domain/importacion'
import type { ResultadoImportacion } from '../domain/types'

/** Hash de auditoría del contenido importado. */
export function hashContenido(contenido: string | Uint8Array): string {
  return crypto.createHash('sha256').update(contenido).digest('hex')
}

/**
 * Caso de uso único de importación del balance (carga manual o Excel editado):
 * registra la importación, valida filas y cuadre, reemplaza las cuentas del ejercicio
 * y deja la importación en COMPLETADA o CON_ERRORES con el detalle.
 */
export async function registrarImportacion(params: {
  ejercicioId: string
  nombreArchivo: string
  hashArchivo: string
  mapeoSnapshot: object
  filas: FilaImportacion[]
}): Promise<ActionResult<ResultadoImportacion>> {
  const { ejercicioId, filas } = params
  const totalFilas = filas.length

  const importacion = await createImportacion({
    ejercicioId,
    nombreArchivo: params.nombreArchivo,
    hashArchivo: params.hashArchivo,
    mapeoSnapshot: params.mapeoSnapshot,
  })
  const importacionId = importacion.id

  const rechazar = async (
    erroresDetalle: object,
    filasError: number,
    error: Parameters<typeof actionError>[0],
  ) => {
    await updateImportacion(importacionId, {
      estado: 'CON_ERRORES',
      totalFilas,
      filasImportadas: 0,
      filasError,
      erroresDetalle,
    })
    return actionError(error)
  }

  try {
    const { cuentas, filasError, codigosDuplicados } = procesarFilas(filas)

    if (cuentas.length === 0) {
      return rechazar({ mensaje: 'No se encontraron filas válidas' }, totalFilas, {
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No hay cuentas válidas. Verificá que todas tengan código y nombre.',
      })
    }

    if (codigosDuplicados.length > 0) {
      const lista = codigosDuplicados.slice(0, 5).join(', ')
      const mas = codigosDuplicados.length > 5 ? ` y ${codigosDuplicados.length - 5} más` : ''
      return rechazar({ mensaje: 'Códigos de cuenta repetidos', codigosDuplicados }, filasError, {
        tipo: 'NEGOCIO',
        severidad: 'ALTO',
        codigo: 'NEG-012',
        mensaje: `Hay ${codigosDuplicados.length} códigos de cuenta repetidos: ${lista}${mas}. Cada cuenta debe tener un código único.`,
      })
    }

    const cuadre = validarCuadre(cuentas)
    if (!cuadre.cuadrado) {
      const exceso = cuadre.diferencia > 0 ? 'el debe supera al haber' : 'el haber supera al debe'
      return rechazar(
        { mensaje: 'El balance de sumas y saldos no cuadra', ...cuadre },
        filasError,
        {
          tipo: 'NEGOCIO',
          severidad: 'ALTO',
          codigo: 'NEG-011',
          mensaje: `El balance no cuadra: ${exceso} por ${formatCurrency(Math.abs(cuadre.diferencia), { decimales: 'todos' })}. Revisá los importes antes de confirmar.`,
          detalle: `Debe ${formatCurrency(cuadre.totalDeudor, { decimales: 'todos' })} · Haber ${formatCurrency(cuadre.totalAcreedor, { decimales: 'todos' })}`,
        },
      )
    }

    const importadas = await replaceCuentas(ejercicioId, importacionId, cuentas)
    await updateImportacion(importacionId, {
      estado: 'COMPLETADA',
      totalFilas,
      filasImportadas: importadas,
      filasError,
    })
    await resetEstadosConfirmado(ejercicioId)

    return actionOk({ importacionId, importadas, errores: filasError, total: totalFilas })
  } catch (error) {
    await updateImportacion(importacionId, { estado: 'CON_ERRORES' }).catch(() => {})
    throw error
  }
}
