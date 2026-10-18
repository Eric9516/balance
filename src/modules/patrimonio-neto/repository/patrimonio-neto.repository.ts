import { db } from '@/lib/db'
import {
  toEvolucionPNMovimientoDTO,
  type EvolucionPNInput,
  type EvolucionPNMovimientoDTO,
} from '../domain/types'

/** Filas guardadas del E.E.P.N. de un ejercicio (puede ser vacío). */
export async function findMovimientosPN(ejercicioId: string): Promise<EvolucionPNMovimientoDTO[]> {
  const rows = await db.evolucionPNMovimiento.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
  })
  return rows.map(toEvolucionPNMovimientoDTO)
}

/** Persiste las filas (ya saneadas por el servicio) en una sola transacción. */
export async function guardarMovimientosPN(
  ejercicioId: string,
  movimientos: EvolucionPNInput[],
): Promise<void> {
  await db.$transaction(
    movimientos.map((mov) =>
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
}
