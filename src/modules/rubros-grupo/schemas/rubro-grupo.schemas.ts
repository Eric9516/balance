import { z } from 'zod'

export const CreateRubroGrupoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200),
  sigla: z.string().max(10).optional(),
  esGasto: z.boolean(),
  orden: z
    .string()
    .min(1, 'El orden es requerido')
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 0,
      'Debe ser un número entero positivo',
    ),
})

export type CreateRubroGrupoInput = z.infer<typeof CreateRubroGrupoSchema>
