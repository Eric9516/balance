import { db } from '@/lib/db'
import { toBienDeUsoDTO, calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { importe } from '@/lib/importe'

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

function buildData(input: BienInput) {
  const { costoFinReexpresado, depAcumFin } = calcularCierre({
    categoria: '',
    costoInicioReexpresado: input.costoInicioReexpresado,
    costoAjusteInflacion: input.costoAjusteInflacion,
    altas: input.altas,
    bajas: input.bajas,
    depAcumInicio: input.depAcumInicio,
    depAjusteInflacion: input.depAjusteInflacion,
    depEjercicio: input.depEjercicio,
    depBajas: input.depBajas,
  })
  return { ...input, costoFinReexpresado, depAcumFin }
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

export async function updateBienDeUso(
  id: string,
  input: Partial<BienInput> & { categoria?: string },
): Promise<BienDeUsoDTO> {
  // Recalculate cierre fields if any input changed
  const current = await db.bienDeUsoCategoria.findUniqueOrThrow({ where: { id } })
  const merged: BienInput = {
    costoInicioReexpresado: importe(current.costoInicioReexpresado),
    costoAjusteInflacion: importe(current.costoAjusteInflacion),
    altas: importe(current.altas),
    bajas: importe(current.bajas),
    depAcumInicio: importe(current.depAcumInicio),
    depAjusteInflacion: importe(current.depAjusteInflacion),
    depEjercicio: importe(current.depEjercicio),
    depBajas: importe(current.depBajas),
    ...input,
  }
  const data = buildData(merged)
  const row = await db.bienDeUsoCategoria.update({
    where: { id },
    data: { ...data, ...(input.categoria ? { categoria: input.categoria } : {}) },
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

export async function deleteBienDeUso(id: string): Promise<void> {
  await db.bienDeUsoCategoria.delete({ where: { id } })
}

export async function updateNetoAnteriorManual(
  id: string,
  valor: number | null,
): Promise<BienDeUsoDTO> {
  const row = await db.bienDeUsoCategoria.update({
    where: { id },
    data: { netoResidualAnteriorManual: valor },
  })
  return toBienDeUsoDTO(row)
}
