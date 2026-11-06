import { cache } from 'react'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { normalizarConcepto } from '../domain/calculo'
import {
  LINEAS_DE_LA_APP,
  toFlujoGuardadoDTO,
  toFlujoItemDTO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type OrigenLineaFlujo,
  type SeccionFlujo,
} from '../domain/types'

/** Las líneas en orden y el nombre de quien revisó el RECPAM. */
const itemsOrdenados = {
  items: { orderBy: { orden: 'asc' } },
  revisor: { select: { nombre: true } },
} as const

// ─── Queries ──────────────────────────────────────────────────────────────────

/** El flujo guardado, sin memoizar: para leerlo de nuevo después de cambiarlo. */
export async function leerFlujo(ejercicioId: string): Promise<FlujoGuardadoDTO | null> {
  const row = await db.flujoDeCajaEjercicio.findUnique({
    where: { ejercicioId },
    include: itemsOrdenados,
  })
  return row ? toFlujoGuardadoDTO(row) : null
}

/** Memoizado por request: la página y la compuerta lo piden en el mismo render. */
export const findFlujo = cache(leerFlujo)

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

type LineaNueva = {
  seccion: SeccionFlujo
  concepto: string
  importe?: number
  importeAnterior?: number
  origen?: OrigenLineaFlujo | null
}

/** Crea líneas al final del flujo, en una transacción que ya está abierta. */
async function crearLineas(
  tx: Prisma.TransactionClient,
  flujoId: string,
  lineas: LineaNueva[],
): Promise<FlujoItemDTO[]> {
  const max = await tx.flujoDeCajaItem.aggregate({ where: { flujoId }, _max: { orden: true } })
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
          importe: l.importe ?? 0,
          importeAnterior: l.importeAnterior ?? 0,
          origen: l.origen ?? null,
          orden,
        },
      }),
    )
  }
  return creados.map(toFlujoItemDTO)
}

/** El origen de una línea de la app con ese nombre en esa sección (null si no es una de ellas). */
function origenPorNombre(seccion: SeccionFlujo, concepto: string): OrigenLineaFlujo | null {
  const buscado = normalizarConcepto(concepto)
  return (
    ORDEN_APP.find(
      (o) =>
        LINEAS_DE_LA_APP[o].seccion === seccion &&
        normalizarConcepto(LINEAS_DE_LA_APP[o].concepto) === buscado,
    ) ?? null
  )
}

/**
 * Agrega líneas al final (alta estructural, fuera del borrador). Una línea con el nombre de una de
 * las que arma la app queda marcada como esa (por ejemplo, el RECPAM que se trae del año anterior),
 * así no hay dos. Con la primera línea del flujo se agrega también la de RECPAM: es la diferencia
 * para que el estado cierre y la calcula la app.
 */
export async function crearItemsFlujo(
  ejercicioId: string,
  lineas: LineaNueva[],
): Promise<FlujoItemDTO[]> {
  const flujoId = await asegurarCabecera(ejercicioId)
  return db.$transaction(async (tx) => {
    const marcadas = await tx.flujoDeCajaItem.findMany({
      where: { flujoId, origen: { not: null } },
      select: { origen: true },
    })
    const tomados = new Set(marcadas.map((x) => x.origen))
    const conOrigen = lineas.map((l) => {
      const origen = l.origen ?? origenPorNombre(l.seccion, l.concepto)
      if (!origen || tomados.has(origen)) return { ...l, origen: l.origen ?? null }
      tomados.add(origen)
      return { ...l, origen }
    })
    const creados = await crearLineas(tx, flujoId, conOrigen)
    if (tomados.has('RECPAM')) return creados
    const recpam = await crearLineas(tx, flujoId, [
      { ...LINEAS_DE_LA_APP.RECPAM, origen: 'RECPAM' },
    ])
    return [...creados, ...recpam]
  })
}

/**
 * Da por revisado el RECPAM con este importe. Quién y cuándo los pone la base desde la sesión (y no
 * deja que un asistente lo haga).
 */
export async function revisarRecpam(ejercicioId: string, importe: number): Promise<void> {
  await db.flujoDeCajaEjercicio.update({
    where: { ejercicioId },
    data: { recpamRevisado: importe },
  })
}

/** El flujo cambió: el RECPAM vuelve a quedar pendiente de revisión. */
export async function quitarRevisionRecpam(ejercicioId: string): Promise<void> {
  await db.flujoDeCajaEjercicio.updateMany({
    where: { ejercicioId, recpamRevisado: { not: null } },
    data: { recpamRevisado: null },
  })
}

/** Borra una línea solo si pertenece al flujo de este ejercicio. Devuelve si borró. */
export async function eliminarItemFlujo(ejercicioId: string, itemId: string): Promise<boolean> {
  const { count } = await db.flujoDeCajaItem.deleteMany({
    where: { id: itemId, flujo: { ejercicioId } },
  })
  return count > 0
}

const ORDEN_SECCION: Record<SeccionFlujo, number> = {
  ACTIVIDADES_OPERATIVAS: 0,
  ACTIVIDADES_INVERSION: 1,
  ACTIVIDADES_FINANCIAMIENTO: 2,
}
const ORDEN_APP = Object.keys(LINEAS_DE_LA_APP) as OrigenLineaFlujo[]

/**
 * Pone en el flujo las líneas que propone la app, en una transacción: actualiza la de cada origen,
 * o adopta la que el contador ya había escrito con el mismo nombre en la misma sección, o la crea.
 * Las líneas del contador no se tocan (salvo la adoptada). Deja todo en orden: en cada sección,
 * primero las de la app, después las del contador, y el RECPAM al final de las operativas.
 */
export async function aplicarLineasDeLaApp(
  ejercicioId: string,
  lineas: { origen: OrigenLineaFlujo; importe: number }[],
): Promise<void> {
  const flujoId = await asegurarCabecera(ejercicioId)
  await db.$transaction(async (tx) => {
    const existentes = await tx.flujoDeCajaItem.findMany({
      where: { flujoId, esSubtotal: false },
      select: { id: true, seccion: true, concepto: true, origen: true, orden: true },
    })
    const nuevas: LineaNueva[] = []
    for (const l of [
      ...lineas,
      ...(existentes.some((x) => x.origen === 'RECPAM')
        ? []
        : [{ origen: 'RECPAM' as const, importe: 0 }]),
    ]) {
      const { seccion, concepto } = LINEAS_DE_LA_APP[l.origen]
      const propia =
        existentes.find((x) => x.origen === l.origen) ??
        existentes.find(
          (x) =>
            x.origen === null &&
            x.seccion === seccion &&
            normalizarConcepto(x.concepto) === normalizarConcepto(concepto),
        )
      if (propia) {
        await tx.flujoDeCajaItem.update({
          where: { id: propia.id },
          data: { origen: l.origen, concepto, importe: l.importe },
        })
        propia.origen = l.origen
      } else {
        nuevas.push({ seccion, concepto, importe: l.importe, origen: l.origen })
      }
    }
    const creadas = await crearLineas(tx, flujoId, nuevas)

    // El orden: sección, después las de la app (en su orden), las del contador y el RECPAM.
    const todas = [
      ...existentes,
      ...creadas.map((c) => ({ id: c.id, seccion: c.seccion, origen: c.origen, orden: c.orden })),
    ]
    const clave = (x: (typeof todas)[number]) => {
      const lugar = x.origen === 'RECPAM' ? 2 : x.origen ? 0 : 1
      return [ORDEN_SECCION[x.seccion], lugar, x.origen ? ORDEN_APP.indexOf(x.origen) : x.orden]
    }
    const ordenadas = [...todas].sort((a, b) => {
      const [ka, kb] = [clave(a), clave(b)]
      return ka[0]! - kb[0]! || ka[1]! - kb[1]! || ka[2]! - kb[2]!
    })
    for (const [i, x] of ordenadas.entries()) {
      if (x.orden !== i + 1) {
        await tx.flujoDeCajaItem.update({ where: { id: x.id }, data: { orden: i + 1 } })
      }
    }
  })
}
