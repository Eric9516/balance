'use server'

import { revalidatePath } from 'next/cache'
import { actionError, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { FilasImportacionSchema } from '../schemas/importacion.schemas'
import { hashContenido, registrarImportacion } from '../services/importacion.service'
import type { FilaImportacion } from '../domain/importacion'
import type { ResultadoImportacion } from '../domain/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const errorFormato = (mensaje: string) =>
  actionError({ tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje })

const errorSinFilas = () =>
  actionError({
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    codigo: 'NEG-010',
    mensaje: 'No hay filas para importar. Agregá al menos una cuenta.',
  })

/** Valida la forma de las filas recibidas del cliente. */
function validarFilas(raw: unknown): ActionResult<FilaImportacion[]> {
  const parsed = FilasImportacionSchema.safeParse(raw)
  if (!parsed.success)
    return errorFormato('Formato de filas inválido. Recargá la página y volvé a intentar.')
  if (parsed.data.length === 0) return errorSinFilas()
  return { ok: true, data: parsed.data }
}

function revalidarEjercicio(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

// ─── Carga manual (sin archivo Excel) ────────────────────────────────────────
// El usuario tipea las cuentas directamente en la UI.

export async function confirmarImportacionManual(
  ejercicioId: string,
  sociedadId: string,
  filasRaw: FilaImportacion[],
): Promise<ActionResult<ResultadoImportacion>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)

    const filas = validarFilas(filasRaw)
    if (!filas.ok) return filas

    const resultado = await registrarImportacion({
      ejercicioId,
      nombreArchivo: 'Carga manual',
      hashArchivo: hashContenido(JSON.stringify(filas.data)),
      mapeoSnapshot: { tipo: 'manual' },
      modo: 'AGREGAR',
      filas: filas.data,
    })
    if (resultado.ok) revalidarEjercicio(sociedadId, ejercicioId)
    return resultado
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'importaciones', operacion: 'confirmar_manual' }),
    )
  }
}

// ─── Excel editado ────────────────────────────────────────────────────────────
// El cliente parsea el Excel, el usuario edita/elimina filas y envía el array
// final. El archivo se adjunta solo para generar el hash de auditoría.

export async function confirmarImportacionEditada(
  ejercicioId: string,
  sociedadId: string,
  formData: FormData,
): Promise<ActionResult<ResultadoImportacion>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)

    const archivo = formData.get('archivo')
    if (!(archivo instanceof File) || archivo.size === 0) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-002',
        mensaje: 'No se recibió el archivo original',
      })
    }

    const rowsJson = formData.get('rowsJson')
    if (typeof rowsJson !== 'string') return errorFormato('No se recibieron los datos editados')

    let raw: unknown
    try {
      raw = JSON.parse(rowsJson)
    } catch {
      return errorFormato('Formato de datos inválido')
    }
    const filas = validarFilas(raw)
    if (!filas.ok) return filas

    const resultado = await registrarImportacion({
      ejercicioId,
      nombreArchivo: archivo.name,
      hashArchivo: hashContenido(new Uint8Array(await archivo.arrayBuffer())),
      mapeoSnapshot: { tipo: 'editada_manualmente', archivoNombre: archivo.name },
      filas: filas.data,
    })
    if (resultado.ok) revalidarEjercicio(sociedadId, ejercicioId)
    return resultado
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'importaciones', operacion: 'confirmar_editada' }),
    )
  }
}
