import { z } from 'zod'

export const MapeoSchema = z.object({
  columnaCodigo: z.string().min(1, 'Seleccioná la columna de código'),
  columnaNombre: z.string().min(1, 'Seleccioná la columna de nombre'),
  columnaDeudor: z.string().min(1, 'Seleccioná la columna de debe'),
  columnaAcreedor: z.string().min(1, 'Seleccioná la columna de haber'),
  filasOmitir: z.string().optional(),
})

export type MapeoInput = z.infer<typeof MapeoSchema>
