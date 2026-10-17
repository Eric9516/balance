import { db } from '@/lib/db'
import { toCuentaDTO, type CuentaContableDTO, type RubroBaseSimple } from '../domain/types'

const rubroSelect = { select: { nombre: true } } as const

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export async function asignarRubroCuenta(
  cuentaId: string,
  rubroBaseId: string | null,
): Promise<void> {
  await db.cuentaContable.update({
    where: { id: cuentaId },
    data: { rubroBaseId, clasificadaManual: rubroBaseId !== null },
  })
}

export async function asignarRubrosBulk(
  cuentaIds: string[],
  rubroBaseId: string,
): Promise<void> {
  await db.cuentaContable.updateMany({
    where: { id: { in: cuentaIds } },
    data: { rubroBaseId, clasificadaManual: true },
  })
}

export async function updateCuenta(
  cuentaId: string,
  data: { nombre?: string; saldoDeudor?: number; saldoAcreedor?: number; saldoFinal?: number },
): Promise<void> {
  await db.cuentaContable.update({ where: { id: cuentaId }, data })
}

export async function deleteCuenta(cuentaId: string): Promise<void> {
  await db.cuentaContable.delete({ where: { id: cuentaId } })
}

export async function replaceCuentas(
  ejercicioId: string,
  importacionId: string,
  cuentas: { codigo: string; nombre: string; saldoDeudor: number; saldoAcreedor: number; saldoFinal: number }[],
): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.cuentaContable.deleteMany({ where: { ejercicioId } })
    await tx.cuentaContable.createMany({
      data: cuentas.map((c) => ({
        ejercicioId,
        importacionId,
        codigo: c.codigo,
        nombre: c.nombre,
        saldoDeudor: c.saldoDeudor,
        saldoAcreedor: c.saldoAcreedor,
        saldoFinal: c.saldoFinal,
      })),
    })
    return cuentas.length
  })
}

export async function findCuentasByEjercicio(ejercicioId: string): Promise<CuentaContableDTO[]> {
  const rows = await db.cuentaContable.findMany({
    where: { ejercicioId },
    include: { rubroBase: rubroSelect },
    orderBy: { codigo: 'asc' },
  })
  return rows.map(toCuentaDTO)
}

export async function countCuentasByEjercicio(ejercicioId: string): Promise<number> {
  return db.cuentaContable.count({ where: { ejercicioId } })
}

export async function findRubrosBase(): Promise<RubroBaseSimple[]> {
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
      rubroGrupo: { select: { nombre: true, estadoDestino: true, seccionSSP: true, seccionEERR: true, esGasto: true } },
    },
    orderBy: { orden: 'asc' },
  })
  return rows.map(r => ({
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
  }))
}
