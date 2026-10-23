'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError, type ActionResult } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { renumerarNotas } from '@/modules/notas/repository/notas.repository'
import { formatCurrency } from '@/lib/utils/currency'
import {
  createAjuste,
  deleteAjuste,
  findAjustesByEjercicio,
  reemplazarAjustes,
} from '../repository/ajustes.repository'
import {
  previsualizarNotaTransicion,
  TITULO_NOTA_TRANSICION,
} from '../services/nota-transicion.service'
import { sincronizarModificacionInicio } from '../services/modificacion-inicio.service'
import type { NotaTransicionGenerada } from '../lib/generarNota'
import type { AjusteTransicionDTO, AjusteTransicionInput } from '../domain/types'

function revalidar(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

export async function crearAjusteTransicionAction(
  ejercicioId: string,
  sociedadId: string,
  input: Omit<AjusteTransicionInput, 'orden'>,
): Promise<ActionResult<AjusteTransicionDTO>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const existentes = await findAjustesByEjercicio(ejercicioId)
    const row = await createAjuste(ejercicioId, { ...input, orden: existentes.length + 1 })
    await sincronizarModificacionInicio(ejercicioId, existentes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'crear_ajuste_transicion' }),
    )
  }
}

export async function guardarLoteAjustesTransicionAction(
  ejercicioId: string,
  sociedadId: string,
  ajustes: (AjusteTransicionInput & { id?: string })[],
): Promise<ActionResult<AjusteTransicionDTO[]>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const antes = await findAjustesByEjercicio(ejercicioId)
    const rows = await reemplazarAjustes(ejercicioId, ajustes)
    await sincronizarModificacionInicio(ejercicioId, antes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(rows)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'guardar_ajustes_transicion' }),
    )
  }
}

export async function eliminarAjusteTransicionAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const antes = await findAjustesByEjercicio(ejercicioId)
    if (!(await deleteAjuste(ejercicioId, id))) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje:
          'No se encontró esa partida de transición en este ejercicio. Recargá la página y volvé a intentar.',
      })
    }
    await sincronizarModificacionInicio(ejercicioId, antes)
    revalidar(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'eliminar_ajuste_transicion' }),
    )
  }
}

function renderTexto(nota: NotaTransicionGenerada): string {
  const lineas: string[] = [...nota.parrafos]
  const tabla = (titulo: string, filas: NotaTransicionGenerada['conciliacionPN']) => {
    lineas.push('', titulo)
    for (const f of filas) {
      lineas.push(
        `${f.esTotal ? '= ' : f.esBase ? '' : '  '}${f.concepto}: ${formatCurrency(f.importe)}`,
      )
    }
  }
  tabla('Conciliación del patrimonio neto al inicio:', nota.conciliacionPN)
  tabla('Conciliación del resultado del ejercicio anterior:', nota.conciliacionResultado)
  return lineas.join('\n')
}

/**
 * Crea o actualiza la nota en el paso "Notas" con el borrador generado.
 * El texto queda editable como cualquier otra nota; regenerar lo pisa.
 */
export async function generarNotaTransicionAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<NotaTransicionGenerada>> {
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
    if (ejercicio.adopcionRT54 !== 'PRIMERA_ADOPCION') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-040',
        mensaje:
          'La Nota de primera aplicación solo corresponde cuando el ejercicio está marcado como primera adopción de la RT 54 (Nota I).',
      })
    }
    const nota = await previsualizarNotaTransicion(ejercicio)
    const texto = renderTexto(nota)

    const existente = await db.notaEjercicio.findFirst({
      where: { ejercicioId, titulo: TITULO_NOTA_TRANSICION },
      select: { id: true },
    })
    if (existente) {
      await db.notaEjercicio.update({ where: { id: existente.id }, data: { textoApertura: texto } })
    } else {
      await db.notaEjercicio.create({
        data: {
          ejercicioId,
          titulo: TITULO_NOTA_TRANSICION,
          tipo: 'POLITICA_CONTABLE',
          numero: null,
          orden: 0,
          textoApertura: texto,
        },
      })
      await renumerarNotas(ejercicioId)
    }
    revalidar(sociedadId, ejercicioId)
    return actionOk(nota)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'NOTAS', operacion: 'generar_nota_transicion' }),
    )
  }
}
