import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { importe, restar } from '@/lib/importe'
import { efectoEnCuadre, type CuentaImportada, type EfectoEnCuadre } from '../domain/importacion'
import type { AppError } from '@/modules/errores/types'
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

/**
 * Cómo terminó un cambio de una cuenta. `efecto` es null cuando el cambio no toca el debe ni el
 * haber (por ejemplo, solo el nombre): entonces no puede descuadrar y no se controla.
 */
export type ResultadoCambioCuenta =
  | { estado: 'GUARDADO'; efecto: EfectoEnCuadre | null }
  | { estado: 'NO_ENCONTRADA' }
  | { estado: 'DESCUADRA'; efecto: EfectoEnCuadre }

/** Debe − haber de todas las cuentas del ejercicio, en una sola consulta agregada. */
async function diferenciaDelBalance(
  tx: Prisma.TransactionClient,
  ejercicioId: string,
): Promise<number> {
  const { _sum } = await tx.cuentaContable.aggregate({
    where: { ejercicioId },
    _sum: { saldoDeudor: true, saldoAcreedor: true },
  })
  return restar(importe(_sum.saldoDeudor), importe(_sum.saldoAcreedor))
}

/** Deshace la transacción de un cambio que descuadra sin confirmar (no es un error de la base). */
class CambioQueDescuadra extends Error {
  constructor(readonly efecto: EfectoEnCuadre) {
    super('El cambio descuadra el balance y nadie lo confirmó')
  }
}

/**
 * Hace un cambio de cuentas y controla el cuadre en la misma transacción: si el balance deja de
 * cuadrar, o crece la diferencia, y nadie lo confirmó en el cartel, lo deshace (NEG-069). El
 * ejercicio queda trabado hasta terminar: dos cambios a la vez no se controlan cada uno sin ver
 * el otro. FOR NO KEY UPDATE no frena a quien solo apunta al ejercicio (las claves foráneas).
 */
async function cambiarControlandoCuadre(
  ejercicioId: string,
  aceptarDescuadre: boolean,
  cambiar: (tx: Prisma.TransactionClient) => Promise<boolean>,
): Promise<ResultadoCambioCuenta> {
  try {
    return await db.$transaction(async (tx): Promise<ResultadoCambioCuenta> => {
      await tx.$queryRaw`SELECT 1 FROM ejercicios_contables WHERE id = ${ejercicioId}::uuid FOR NO KEY UPDATE`
      const antes = await diferenciaDelBalance(tx, ejercicioId)
      if (!(await cambiar(tx))) return { estado: 'NO_ENCONTRADA' }
      const efecto = efectoEnCuadre(antes, await diferenciaDelBalance(tx, ejercicioId))
      if (efecto.descuadra && !aceptarDescuadre) throw new CambioQueDescuadra(efecto)
      return { estado: 'GUARDADO', efecto }
    })
  } catch (e) {
    if (e instanceof CambioQueDescuadra) return { estado: 'DESCUADRA', efecto: e.efecto }
    throw e
  }
}

/**
 * Solo las columnas que se editan en la pantalla: nunca copia el objeto recibido. Si cambia el
 * debe o el haber, controla el cuadre (ver cambiarControlandoCuadre).
 */
export async function updateCuenta(
  ejercicioId: string,
  cuentaId: string,
  cambios: CambiosCuenta,
  aceptarDescuadre = false,
): Promise<ResultadoCambioCuenta> {
  if (!esUuid(cuentaId) || !esUuid(ejercicioId)) return { estado: 'NO_ENCONTRADA' }
  const data = {
    ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
    ...(cambios.saldoDeudor !== undefined && { saldoDeudor: cambios.saldoDeudor }),
    ...(cambios.saldoAcreedor !== undefined && { saldoAcreedor: cambios.saldoAcreedor }),
    ...(cambios.saldoFinal !== undefined && { saldoFinal: cambios.saldoFinal }),
  }
  const where = { id: cuentaId, ejercicioId }
  if (cambios.saldoDeudor === undefined && cambios.saldoAcreedor === undefined) {
    const { count } = await db.cuentaContable.updateMany({ where, data })
    return count > 0 ? { estado: 'GUARDADO', efecto: null } : { estado: 'NO_ENCONTRADA' }
  }
  return cambiarControlandoCuadre(ejercicioId, aceptarDescuadre, async (tx) => {
    const { count } = await tx.cuentaContable.updateMany({ where, data })
    return count > 0
  })
}

/** Borra una cuenta del ejercicio controlando el cuadre (ver cambiarControlandoCuadre). */
export async function deleteCuenta(
  ejercicioId: string,
  cuentaId: string,
  aceptarDescuadre = false,
): Promise<ResultadoCambioCuenta> {
  if (!esUuid(cuentaId) || !esUuid(ejercicioId)) return { estado: 'NO_ENCONTRADA' }
  return cambiarControlandoCuadre(ejercicioId, aceptarDescuadre, async (tx) => {
    const { count } = await tx.cuentaContable.deleteMany({ where: { id: cuentaId, ejercicioId } })
    return count > 0
  })
}

/** Agrega sin borrar ni reclasificar; la confirmación se revoca en la misma transacción. */
export async function agregarCuentas(
  ejercicioId: string,
  importacionId: string,
  cuentas: CuentaImportada[],
): Promise<number> {
  return db.$transaction(async (tx) => {
    const repetidas = await tx.cuentaContable.findMany({
      where: { ejercicioId, codigo: { in: cuentas.map((c) => c.codigo) } },
      select: { codigo: true },
    })
    if (repetidas.length > 0) {
      throw {
        tipo: 'NEGOCIO',
        severidad: 'ALTO',
        codigo: 'NEG-012',
        mensaje: `Ya existen cuentas con estos códigos: ${repetidas
          .slice(0, 5)
          .map((c) => c.codigo)
          .join(', ')}. Usá códigos nuevos; no se modificó ninguna cuenta existente.`,
      } satisfies AppError
    }
    const data: Prisma.CuentaContableCreateManyInput[] = cuentas.map((c) => ({
      ejercicioId,
      importacionExcelId: importacionId,
      codigo: c.codigo,
      nombre: c.nombre,
      saldoDeudor: c.saldoDeudor,
      saldoAcreedor: c.saldoAcreedor,
      saldoFinal: c.saldoFinal,
    }))
    // Sin skipDuplicates: un conflicto concurrente debe revertir todo el lote.
    const { count } = await tx.cuentaContable.createMany({ data })
    await tx.ejercicioContable.update({
      where: { id: ejercicioId },
      data: { estadosConfirmado: false },
    })
    return count
  })
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

/** El catálogo del estudio: cada estudio tiene el suyo. */
async function _findRubrosBase(estudioId: string): Promise<RubroBaseSimple[]> {
  const rows = await db.rubroBase.findMany({
    where: { estudioId, activo: true },
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
