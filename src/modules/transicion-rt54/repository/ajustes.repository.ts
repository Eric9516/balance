import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import {
  toAjusteTransicionDTO,
  type AjusteTransicionDTO,
  type AjusteTransicionInput,
} from '../domain/types'

export async function findAjustesByEjercicio(ejercicioId: string): Promise<AjusteTransicionDTO[]> {
  const rows = await db.ajusteTransicionRT54.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
  })
  return rows.map(toAjusteTransicionDTO)
}

/**
 * Solo las columnas que carga el usuario. Nunca copia el objeto recibido: lo que manda la pantalla
 * puede traer campos de más (Prisma los rechaza) o, en una petición manipulada, otro ejercicio.
 */
function columnas(a: AjusteTransicionInput, orden: number) {
  return {
    orden,
    tipo: a.tipo,
    concepto: a.concepto,
    descripcion: a.descripcion,
    componentePN: a.componentePN,
    importePN: a.importePN,
    importeResultadoAnterior: a.importeResultadoAnterior,
    rubroOrigen: a.rubroOrigen,
    rubroDestino: a.rubroDestino,
    importeReclasificado: a.importeReclasificado,
  }
}

export async function createAjuste(
  ejercicioId: string,
  input: AjusteTransicionInput,
): Promise<AjusteTransicionDTO> {
  const row = await db.ajusteTransicionRT54.create({
    data: { ejercicioId, ...columnas(input, input.orden) },
  })
  return toAjusteTransicionDTO(row)
}

/** Reemplaza las partidas del ejercicio por el borrador completo, en una transacción. */
export async function reemplazarAjustes(
  ejercicioId: string,
  ajustes: (AjusteTransicionInput & { id?: string })[],
): Promise<AjusteTransicionDTO[]> {
  await db.$transaction(async (tx) => {
    const ids = ajustes.map((a) => a.id).filter((id): id is string => !!id)
    await tx.ajusteTransicionRT54.deleteMany({
      where: { ejercicioId, ...(ids.length > 0 ? { id: { notIn: ids } } : {}) },
    })
    for (const [i, a] of ajustes.entries()) {
      const data = columnas(a, i + 1)
      if (a.id) {
        // Con el ejercicio en la condición: una partida de otro ejercicio no se toca.
        await tx.ajusteTransicionRT54.updateMany({ where: { id: a.id, ejercicioId }, data })
      } else {
        await tx.ajusteTransicionRT54.create({ data: { ejercicioId, ...data } })
      }
    }
  })
  return findAjustesByEjercicio(ejercicioId)
}

/** Borra una partida solo si es de este ejercicio. Devuelve si borró. */
export async function deleteAjuste(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.ajusteTransicionRT54.deleteMany({ where: { id, ejercicioId } })
  return count > 0
}
