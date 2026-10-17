import { z } from 'zod'

const importe = z.union([z.string(), z.number()])

/** Filas del balance de sumas y saldos enviadas por la UI (carga manual o Excel editado). */
export const FilasImportacionSchema = z.array(
  z.object({
    codigo: z.string(),
    nombre: z.string(),
    saldoDeudor: importe,
    saldoAcreedor: importe,
  }),
)
