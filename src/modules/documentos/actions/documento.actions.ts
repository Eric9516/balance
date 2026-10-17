'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { REGLA_POR_CLAVE, type TipoDoc } from '../domain/reglas'
import type { DocumentoEjercicioDTO } from '../domain/types'
import {
  upsertDecisionRegla,
  deleteDecisionRegla,
  createDocumentoManual,
  deleteDocumentoById,
  saldoPorCodigoRubro,
} from '../repository/documento.repository'

function revalidate(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

const ctxErr = (operacion: string) => ({ modulo: 'DOCUMENTOS', operacion })

/** Suma de los saldos de los rubros que disparan una regla — para guardar la foto. */
async function saldoDeRegla(ejercicioId: string, reglaClave: string): Promise<number> {
  const regla = REGLA_POR_CLAVE.get(reglaClave)
  if (!regla) return 0
  const saldos = await saldoPorCodigoRubro(ejercicioId)
  return regla.rubros.reduce((acc, cod) => acc + (saldos.get(cod) ?? 0), 0)
}

export async function aceptarDocumentoAction(
  ejercicioId: string,
  sociedadId: string,
  reglaClave: string,
): Promise<ActionResult<DocumentoEjercicioDTO>> {
  try {
    const regla = REGLA_POR_CLAVE.get(reglaClave)
    if (!regla) {
      return actionError(errorHandler(new Error(`Regla desconocida: ${reglaClave}`), ctxErr('aceptar')))
    }
    const saldoAlAceptar = await saldoDeRegla(ejercicioId, reglaClave)
    const row = await upsertDecisionRegla({
      ejercicioId, reglaClave, tipo: regla.tipo, titulo: regla.titulo,
      estado: 'ACEPTADO', saldoAlAceptar,
    })
    revalidate(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(errorHandler(error, ctxErr('aceptar')))
  }
}

export async function descartarDocumentoAction(
  ejercicioId: string,
  sociedadId: string,
  reglaClave: string,
): Promise<ActionResult<DocumentoEjercicioDTO>> {
  return setEstadoRegla(ejercicioId, sociedadId, reglaClave, 'DESCARTADO', 'descartar')
}

export async function marcarNoAplicaAction(
  ejercicioId: string,
  sociedadId: string,
  reglaClave: string,
): Promise<ActionResult<DocumentoEjercicioDTO>> {
  return setEstadoRegla(ejercicioId, sociedadId, reglaClave, 'NO_APLICA', 'no_aplica')
}

async function setEstadoRegla(
  ejercicioId: string,
  sociedadId: string,
  reglaClave: string,
  estado: 'DESCARTADO' | 'NO_APLICA',
  op: string,
): Promise<ActionResult<DocumentoEjercicioDTO>> {
  try {
    const regla = REGLA_POR_CLAVE.get(reglaClave)
    if (!regla) {
      return actionError(errorHandler(new Error(`Regla desconocida: ${reglaClave}`), ctxErr(op)))
    }
    const row = await upsertDecisionRegla({
      ejercicioId, reglaClave, tipo: regla.tipo, titulo: regla.titulo, estado,
    })
    revalidate(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(errorHandler(error, ctxErr(op)))
  }
}

/** Reactivar: borra la decisión → vuelve a SUGERIDO (o desaparece si ya no corresponde). */
export async function reactivarDocumentoAction(
  ejercicioId: string,
  sociedadId: string,
  reglaClave: string,
): Promise<ActionResult<void>> {
  try {
    await deleteDecisionRegla(ejercicioId, reglaClave)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, ctxErr('reactivar')))
  }
}

export async function agregarDocumentoManualAction(
  ejercicioId: string,
  sociedadId: string,
  tipo: TipoDoc,
  titulo: string,
): Promise<ActionResult<DocumentoEjercicioDTO>> {
  try {
    if (!titulo.trim()) {
      return actionError(errorHandler(new Error('El título es obligatorio'), ctxErr('agregar_manual')))
    }
    const row = await createDocumentoManual({ ejercicioId, tipo, titulo: titulo.trim() })
    revalidate(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(errorHandler(error, ctxErr('agregar_manual')))
  }
}

/** Eliminar un documento manual por id (los automáticos se descartan, no se borran). */
export async function eliminarDocumentoManualAction(
  ejercicioId: string,
  sociedadId: string,
  id: string,
): Promise<ActionResult<void>> {
  try {
    await deleteDocumentoById(id)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, ctxErr('eliminar_manual')))
  }
}
