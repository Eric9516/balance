import { db } from '@/lib/db'
import { toBienDeUsoDTO, calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { importe } from '@/lib/importe'
import { esUuid } from '@/lib/utils/uuid'

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function findBienesDeUso(ejercicioId: string): Promise<BienDeUsoDTO[]> {
  const rows = await db.bienDeUsoCategoria.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
  })
  return rows.map(toBienDeUsoDTO)
}

/**
 * Para cada categoría del ejercicio anterior devuelve el neto residual al cierre.
 * Se usa como columna "Neto residual ejercicio anterior" del Anexo I.
 */
export async function findNetoResidualAnterior(
  ejercicioAnteriorId: string,
): Promise<Map<string, number>> {
  const rows = await db.bienDeUsoCategoria.findMany({
    where: { ejercicioId: ejercicioAnteriorId },
  })
  const map = new Map<string, number>()
  for (const r of rows) {
    const { netoResidual } = calcularCierre({
      categoria: r.categoria,
      costoInicioReexpresado: importe(r.costoInicioReexpresado),
      costoAjusteInflacion: importe(r.costoAjusteInflacion),
      altas: importe(r.altas),
      bajas: importe(r.bajas),
      depAcumInicio: importe(r.depAcumInicio),
      depAjusteInflacion: importe(r.depAjusteInflacion),
      depEjercicio: importe(r.depEjercicio),
      depBajas: importe(r.depBajas),
    })
    map.set(r.categoria, netoResidual)
  }
  return map
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type BienInput = {
  costoInicioReexpresado: number
  costoAjusteInflacion: number
  altas: number
  bajas: number
  depAcumInicio: number
  depAjusteInflacion: number
  depEjercicio: number
  depBajas: number
}

/**
 * Solo las columnas que carga el usuario, más el cierre recalculado acá. Nunca copia el objeto
 * recibido: lo que manda la pantalla puede traer campos calculados (el neto residual), que Prisma
 * rechaza, o, en una petición manipulada, otro ejercicio, otro orden u otro cierre.
 */
function buildData(input: BienInput) {
  const valores = {
    costoInicioReexpresado: input.costoInicioReexpresado,
    costoAjusteInflacion: input.costoAjusteInflacion,
    altas: input.altas,
    bajas: input.bajas,
    depAcumInicio: input.depAcumInicio,
    depAjusteInflacion: input.depAjusteInflacion,
    depEjercicio: input.depEjercicio,
    depBajas: input.depBajas,
  }
  const { costoFinReexpresado, depAcumFin } = calcularCierre({ categoria: '', ...valores })
  return { ...valores, costoFinReexpresado, depAcumFin }
}

export async function createBienDeUso(
  ejercicioId: string,
  categoria: string,
  orden: number,
): Promise<BienDeUsoDTO> {
  const row = await db.bienDeUsoCategoria.create({
    data: {
      ejercicioId,
      categoria,
      orden,
      costoInicioReexpresado: 0,
      costoAjusteInflacion: 0,
      altas: 0,
      bajas: 0,
      costoFinReexpresado: 0,
      depAcumInicio: 0,
      depAjusteInflacion: 0,
      depEjercicio: 0,
      depBajas: 0,
      depAcumFin: 0,
    },
  })
  return toBienDeUsoDTO(row)
}

/** Persiste todas las filas (ya saneadas) en una sola transacción. */
export async function updateBienesLote(
  bienes: (BienInput & {
    id: string
    categoria: string
    netoResidualAnteriorManual: number | null
  })[],
): Promise<BienDeUsoDTO[]> {
  const rows = await db.$transaction(
    bienes.map((b) =>
      db.bienDeUsoCategoria.update({
        where: { id: b.id },
        data: {
          ...buildData(b),
          categoria: b.categoria,
          netoResidualAnteriorManual: b.netoResidualAnteriorManual,
        },
      }),
    ),
  )
  return rows.map(toBienDeUsoDTO)
}

/** Borra una categoría solo si es de este ejercicio. Devuelve si borró. */
export async function deleteBienDeUso(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.bienDeUsoCategoria.deleteMany({ where: { id, ejercicioId } })
  return count > 0
}
