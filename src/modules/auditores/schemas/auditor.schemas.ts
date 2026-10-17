import { z } from 'zod'

export const CreateAuditorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().min(1, 'El apellido es requerido').max(100),
  tituloProfesional: z.string().optional(),
  matricula: z.string().optional(),
  consejoProfesional: z.string().optional(),
  universidad: z.string().optional(),
  localidadInforme: z.string().optional(),
  textoFirma: z.string().optional(),
  esDefault: z.boolean().optional(),
})

export type CreateAuditorInput = z.infer<typeof CreateAuditorSchema>

export const UpdateAuditorSchema = CreateAuditorSchema
export type UpdateAuditorInput = z.infer<typeof UpdateAuditorSchema>
