import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toCuentaDTO, type CuentaContableDTO, type RubroBaseSimple } from '../domain/types'

// ─── Mutaciones ───────────────────────────────────────────────────────────────
// Toda modificación por identificador lleva el ejercicio en la condición: una cuenta de otro
// ejercicio no matchea y no se toca. Las que reciben una sola cuenta devuelven si la encontraron.

export async function asignarRubroCuenta(
  ejercicioId: string,
  cuentaId: string,
  rubroBaseId: string | null,
): Promise<boolean> {
  if (!esUuid(cuentaId)) return false
  const { count } = await db.cuentaContable.updateMany({
    where: { id: cuentaId, ejercicioId },
    data: { rubroBaseId, clasificadaManual: rubroBaseId !== null },
  })
  return count > 0
}

export async function asignarRubrosBulk(
  ejercicioId: string,
  cuentaIds: string[],
  rubroBaseId: string,
): Promise<void> {
  await db.cuentaContable.updateMany({
    where: { id: { in: cuentaIds.filter(esUuid) }, ejercicioId },
    data: { rubroBaseId, clasificadaManual: true },
  })
}

export type CambiosCuenta = {
  nombre?: string
  saldoDeudor?: number
  saldoAcreedor?: number
  saldoFinal?: number
}

/** Solo las columnas que se editan en la pantalla: nunca copia el objeto recibido. */
export async function updateCuenta(
  ejercicioId: string,
  cuentaId: string,
  cambios: CambiosCuenta,
): Promise<boolean> {
  if (!esUuid(cuentaId)) return false
  const { count } = await db.cuentaContable.updateMany({
    where: { id: cuentaId, ejercicioId },
    data: {
      ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
      ...(cambios.saldoDeudor !== undefined && { saldoDeudor: cambios.saldoDeudor }),
      ...(cambios.saldoAcreedor !== undefined && { saldoAcreedor: cambios.saldoAcreedor }),
      ...(cambios.saldoFinal !== undefined && { saldoFinal: cambios.saldoFinal }),
    },
  })
  return count > 0
}

export async function deleteCuenta(ejercicioId: string, cuentaId: string): Promise<boolean> {
  if (!esUuid(cuentaId)) return false
  const { count } = await db.cuentaContable.deleteMany({ where: { id: cuentaId, ejercicioId } })
  return count > 0
}

export async function replaceCuentas(
  ejercicioId: string,
  importacionId: string,
  cuentas: {
    codigo: string
    nombre: string
    saldoDeudor: number
    saldoAcreedor: number
    saldoFinal: number
  }[],
): Promise<number> {
  // Tipado explícito: un campo mal escrito acá ahora es error de compilación.
  const data: Prisma.CuentaContableCreateManyInput[] = cuentas.map((c) => ({
    ejercicioId,
    importacionExcelId: importacionId,
    codigo: c.codigo,
    nombre: c.nombre,
    saldoDeudor: c.saldoDeudor,
    saldoAcreedor: c.saldoAcreedor,
    saldoFinal: c.saldoFinal,
  }))
  return db.$transaction(async (tx) => {
    await tx.cuentaContable.deleteMany({ where: { ejercicioId } })
    await tx.cuentaContable.createMany({ data })
    return cuentas.length
  })
}

/**
 * Memoizado por request: la página y los servicios lo piden varias veces en un render.
 *
 * Las cuentas y los nombres de sus rubros se piden EN PARALELO (un solo viaje a la base):
 * con `include`, Prisma pediría los rubros en una segunda consulta, después de la primera.
 * Si una cuenta se reclasificó entre las dos consultas, el rubro que falta se completa aparte.
 */
export const findCuentasByEjercicio = cache(
  async (ejercicioId: string): Promise<CuentaContableDTO[]> => {
    const [rows, rubros] = await Promise.all([
      db.cuentaContable.findMany({ where: { ejercicioId }, orderBy: { codigo: 'asc' } }),
      db.rubroBase.findMany({
        where: { cuentas: { some: { ejercicioId } } },
        select: { id: true, nombre: true },
      }),
    ])
    const nombres = new Map(rubros.map((r) => [r.id, r.nombre]))
    const faltantes = [
      ...new Set(
        rows.flatMap((c) => (c.rubroBaseId && !nombres.has(c.rubroBaseId) ? [c.rubroBaseId] : [])),
      ),
    ]
    if (faltantes.length > 0) {
      const extra = await db.rubroBase.findMany({
        where: { id: { in: faltantes } },
        select: { id: true, nombre: true },
      })
      for (const r of extra) nombres.set(r.id, r.nombre)
    }
    return rows.map((c) => {
      const nombre = c.rubroBaseId ? nombres.get(c.rubroBaseId) : undefined
      return toCuentaDTO({ ...c, rubroBase: nombre === undefined ? null : { nombre } })
    })
  },
)

export async function countCuentasByEjercicio(ejercicioId: string): Promise<number> {
  return db.cuentaContable.count({ where: { ejercicioId } })
}

/** Totales livianos para el stepper: una sola consulta agregada en vez de traer las filas. */
export async function resumenCuentasByEjercicio(
  ejercicioId: string,
): Promise<{ total: number; sinClasificar: number }> {
  const grupos = await db.cuentaContable.groupBy({
    by: ['rubroBaseId'],
    where: { ejercicioId },
    _count: { _all: true },
  })
  let total = 0
  let sinClasificar = 0
  for (const g of grupos) {
    total += g._count._all
    if (g.rubroBaseId === null) sinClasificar += g._count._all
  }
  return { total, sinClasificar }
}

export const findRubrosBase = cache(_findRubrosBase)

async function _findRubrosBase(): Promise<RubroBaseSimple[]> {
  const rows = await db.rubroBase.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      estadoDestino: true,
      seccionSSP: true,
      seccionEERR: true,
      naturalezaEsperada: true,
      orden: true,
      generaNotaInformativa: true,
      textoNotaDefault: true,
      esEfectivo: true,
      rubroGrupo: {
        select: {
          nombre: true,
          estadoDestino: true,
          seccionSSP: true,
          seccionEERR: true,
          esGasto: true,
        },
      },
    },
    orderBy: { orden: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    estadoDestino: (r.rubroGrupo?.estadoDestino ?? r.estadoDestino) as 'SSP' | 'EERR' | 'PN',
    seccionSSP: r.rubroGrupo?.seccionSSP ?? r.seccionSSP,
    seccionEERR: r.rubroGrupo?.seccionEERR ?? r.seccionEERR,
    naturalezaEsperada: r.naturalezaEsperada as 'DEUDORA' | 'ACREEDORA',
    orden: r.orden,
    generaNotaInformativa: r.generaNotaInformativa,
    textoNotaDefault: r.textoNotaDefault ?? null,
    rubroGrupoNombre: r.rubroGrupo?.nombre ?? null,
    rubroGrupoEsGasto: r.rubroGrupo?.esGasto ?? false,
    esEfectivo: r.esEfectivo,
  }))
}
