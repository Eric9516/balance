import { cache } from 'react'
import { db } from '@/lib/db'
import {
  toFlujoGuardadoDTO,
  toFlujoItemDTO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type SeccionFlujo,
} from '../domain/types'

const itemsOrdenados = { items: { orderBy: { orden: 'asc' } } } as const

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Memoizado por request: la página y la compuerta lo piden en el mismo render. */
export const findFlujo = cache(async (ejercicioId: string): Promise<FlujoGuardadoDTO | null> => {
  const row = await db.flujoDeCajaEjercicio.findUnique({
    where: { ejercicioId },
    include: itemsOrdenados,
  })
  return row ? toFlujoGuardadoDTO(row) : null
})

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Crea la cabecera si no existe (las líneas cuelgan de ella). */
async function asegurarCabecera(ejercicioId: string): Promise<string> {
  const row = await db.flujoDeCajaEjercicio.upsert({
    where: { ejercicioId },
    create: { ejercicioId },
    update: {},
    select: { id: true },
  })
  return row.id
}

/**
 * Persiste el flujo YA SANEADO (cabecera + todas las líneas) en una sola transacción.
 * Solo actualiza líneas que pertenecen a este ejercicio: un id ajeno no matchea el where.
 */
export async function guardarFlujoLote(
  ejercicioId: string,
  flujo: FlujoGuardadoDTO,
): Promise<FlujoGuardadoDTO> {
  const cabecera = {
    saldoInicial: flujo.saldoInicial,
    modificacionesEjAnt: flujo.modificacionesEjAnt,
    saldoFinal: flujo.saldoFinal,
    saldoInicialAnterior: flujo.saldoInicialAnterior,
    modificacionesEjAntAnt: flujo.modificacionesEjAntAnt,
    saldoFinalAnterior: flujo.saldoFinalAnterior,
  }
  return db.$transaction(async (tx) => {
    const { id: flujoId } = await tx.flujoDeCajaEjercicio.upsert({
      where: { ejercicioId },
      create: { ejercicioId, ...cabecera },
      update: cabecera,
      select: { id: true },
    })
    for (const i of flujo.items) {
      await tx.flujoDeCajaItem.updateMany({
        where: { id: i.id, flujoId },
        data: { concepto: i.concepto, importe: i.importe, importeAnterior: i.importeAnterior },
      })
    }
    const row = await tx.flujoDeCajaEjercicio.findUniqueOrThrow({
      where: { id: flujoId },
      include: itemsOrdenados,
    })
    return toFlujoGuardadoDTO(row)
  })
}

/** Agrega líneas al final (alta estructural, fuera del borrador). */
export async function crearItemsFlujo(
  ejercicioId: string,
  lineas: { seccion: SeccionFlujo; concepto: string; importeAnterior?: number }[],
): Promise<FlujoItemDTO[]> {
  const flujoId = await asegurarCabecera(ejercicioId)
  return db.$transaction(async (tx) => {
    const max = await tx.flujoDeCajaItem.aggregate({
      where: { flujoId },
      _max: { orden: true },
    })
    let orden = max._max.orden ?? 0
    const creados = []
    for (const l of lineas) {
      orden += 1
      creados.push(
        await tx.flujoDeCajaItem.create({
          data: {
            flujoId,
            seccion: l.seccion,
            concepto: l.concepto,
            importeAnterior: l.importeAnterior ?? 0,
            orden,
          },
        }),
      )
    }
    return creados.map(toFlujoItemDTO)
  })
}

/** Borra una línea solo si pertenece al flujo de este ejercicio. Devuelve si borró. */
export async function eliminarItemFlujo(ejercicioId: string, itemId: string): Promise<boolean> {
  const { count } = await db.flujoDeCajaItem.deleteMany({
    where: { id: itemId, flujo: { ejercicioId } },
  })
  return count > 0
}
