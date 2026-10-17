import type { TipoMovimientoPN } from '@prisma/client'
import { db } from '@/lib/db'
import {
  PN_MOVIMIENTOS,
  toEvolucionPNMovimientoDTO,
  totalMovimientoPN,
  type EvolucionPNData,
  type EvolucionPNInput,
  type EvolucionPNMovimientoDTO,
} from '../domain/types'

type ColumnasPN = Pick<
  EvolucionPNMovimientoDTO,
  'capitalSuscripto' | 'ajusteCapital' | 'aportesIrrevocables' | 'reservaLegal' | 'otrasReservas' | 'rdosNoAsignados'
>

export type EvolucionPNDefaults = {
  saldoInicio?: ColumnasPN
  totalAnteriorByTipo?: Partial<Record<TipoMovimientoPN, number>>
}

const COLUMNAS_CERO: ColumnasPN = {
  capitalSuscripto: 0,
  ajusteCapital: 0,
  aportesIrrevocables: 0,
  reservaLegal: 0,
  otrasReservas: 0,
  rdosNoAsignados: 0,
}

function sumarColumnas(acc: ColumnasPN, mov: ColumnasPN): ColumnasPN {
  return {
    capitalSuscripto: acc.capitalSuscripto + mov.capitalSuscripto,
    ajusteCapital: acc.ajusteCapital + mov.ajusteCapital,
    aportesIrrevocables: acc.aportesIrrevocables + mov.aportesIrrevocables,
    reservaLegal: acc.reservaLegal + mov.reservaLegal,
    otrasReservas: acc.otrasReservas + mov.otrasReservas,
    rdosNoAsignados: acc.rdosNoAsignados + mov.rdosNoAsignados,
  }
}

function emptyMovimiento(ejercicioId: string, tipo: TipoMovimientoPN, orden: number): EvolucionPNMovimientoDTO {
  return {
    id: '',
    ejercicioId,
    tipo,
    orden,
    capitalSuscripto: 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: 0,
    totalAnterior: 0,
  }
}

function emptyMovimientoConDefaults(
  ejercicioId: string,
  tipo: TipoMovimientoPN,
  orden: number,
  defaults: EvolucionPNDefaults,
): EvolucionPNMovimientoDTO {
  const base = emptyMovimiento(ejercicioId, tipo, orden)
  return {
    ...base,
    ...(tipo === 'SALDO_INICIO' ? defaults.saldoInicio : null),
    totalAnterior: defaults.totalAnteriorByTipo?.[tipo] ?? 0,
  }
}

function withResultado(movimientos: EvolucionPNMovimientoDTO[], resultadoEjercicio: number): EvolucionPNMovimientoDTO[] {
  return movimientos.map((mov) => (
    mov.tipo === 'RESULTADO_EJERCICIO'
      ? { ...mov, rdosNoAsignados: resultadoEjercicio }
      : mov
  ))
}

export async function findEvolucionPN(
  ejercicioId: string,
  resultadoEjercicio: number,
  defaults: EvolucionPNDefaults = {},
): Promise<EvolucionPNData> {
  const rows = await db.evolucionPNMovimiento.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
  })

  const byTipo = new Map(rows.map((row) => [row.tipo, toEvolucionPNMovimientoDTO(row)]))
  const movimientos = withResultado(
    PN_MOVIMIENTOS.map((base) => byTipo.get(base.tipo) ?? emptyMovimientoConDefaults(ejercicioId, base.tipo, base.orden, defaults)),
    resultadoEjercicio,
  )
  const totalActual = movimientos.reduce((acc, mov) => acc + totalMovimientoPN(mov), 0)
  const totalAnterior = movimientos.reduce((acc, mov) => acc + mov.totalAnterior, 0)

  return {
    movimientos,
    resultadoEjercicio,
    totalActual,
    totalAnterior,
    autocompletadoDesdeAnterior: Boolean(defaults.saldoInicio || defaults.totalAnteriorByTipo),
  }
}

export async function buildEvolucionPNDefaultsDesdeAnterior(
  ejercicioAnteriorId: string | null | undefined,
  coeficienteComparativo: number,
): Promise<EvolucionPNDefaults> {
  if (!ejercicioAnteriorId) return {}

  const rows = await db.evolucionPNMovimiento.findMany({
    where: { ejercicioId: ejercicioAnteriorId },
    orderBy: { orden: 'asc' },
  })
  if (rows.length === 0) return {}

  const movimientos = rows.map(toEvolucionPNMovimientoDTO)
  const saldoInicio = movimientos.reduce<ColumnasPN>(sumarColumnas, { ...COLUMNAS_CERO })
  const totalAnteriorByTipo = Object.fromEntries(
    movimientos.map((mov) => [mov.tipo, totalMovimientoPN(mov) * coeficienteComparativo]),
  ) as Partial<Record<TipoMovimientoPN, number>>

  return { saldoInicio, totalAnteriorByTipo }
}

export async function guardarEvolucionPN(
  ejercicioId: string,
  movimientos: EvolucionPNInput[],
  resultadoEjercicio: number,
): Promise<EvolucionPNData> {
  const normalizados = withResultado(
    movimientos.map((mov) => ({ ...mov, id: '', ejercicioId })),
    resultadoEjercicio,
  )

  await db.$transaction(
    normalizados.map((mov) =>
      db.evolucionPNMovimiento.upsert({
        where: { ejercicioId_tipo: { ejercicioId, tipo: mov.tipo } },
        create: {
          ejercicioId,
          tipo: mov.tipo,
          orden: mov.orden,
          capitalSuscripto: mov.capitalSuscripto,
          ajusteCapital: mov.ajusteCapital,
          aportesIrrevocables: mov.aportesIrrevocables,
          reservaLegal: mov.reservaLegal,
          otrasReservas: mov.otrasReservas,
          rdosNoAsignados: mov.rdosNoAsignados,
          totalAnterior: mov.totalAnterior,
        },
        update: {
          orden: mov.orden,
          capitalSuscripto: mov.capitalSuscripto,
          ajusteCapital: mov.ajusteCapital,
          aportesIrrevocables: mov.aportesIrrevocables,
          reservaLegal: mov.reservaLegal,
          otrasReservas: mov.otrasReservas,
          rdosNoAsignados: mov.rdosNoAsignados,
          totalAnterior: mov.totalAnterior,
        },
      }),
    ),
  )

  return findEvolucionPN(ejercicioId, resultadoEjercicio)
}
