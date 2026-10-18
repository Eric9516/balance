import { db } from '@/lib/db'
import type { ItemValidacion } from '../domain/autorizacion'

const ORIGEN = 'AUTORIZACION'

/**
 * Reemplaza las validaciones de autorización final del ejercicio (origen AUTORIZACION)
 * por el resultado de la última evaluación. Las demás validaciones no se tocan.
 */
export async function reemplazarValidacionesAutorizacion(
  ejercicioId: string,
  items: ItemValidacion[],
): Promise<void> {
  await db.$transaction([
    db.errorValidacion.deleteMany({
      where: { ejercicioId, detalle: { path: ['origen'], equals: ORIGEN } },
    }),
    ...(items.length > 0
      ? [
          db.errorValidacion.createMany({
            data: items.map((i) => ({
              ejercicioId,
              tipo: i.tipo,
              severidad: i.severidad === 'ERROR' ? 'ERROR' : 'ADVERTENCIA',
              estado: 'ACTIVA',
              mensaje: i.mensaje,
              detalle: { origen: ORIGEN, codigo: i.codigo },
            })),
          }),
        ]
      : []),
  ])
}
