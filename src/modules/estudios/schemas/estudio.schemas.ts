import { z } from 'zod'
import { TipoPersona } from '@prisma/client'
import { validarCuit } from '@/lib/utils/cuit'

const emailOptional = z
  .string()
  .optional()
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Email inválido')

export const CreateEstudioSchema = z.object({
  tipoPersona: z.nativeEnum(TipoPersona),
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  cuit: z
    .string()
    .min(1, 'El CUIT es requerido')
    .refine(validarCuit, 'CUIT inválido (verificá el dígito verificador)'),
  razonSocial: z.string().min(1, 'Este campo es requerido').max(200),
  domicilio: z.string().optional(),
  localidad: z.string().optional(),
  provincia: z.string().optional(),
  telefono: z.string().optional(),
  email: emailOptional,
})

export type CreateEstudioInput = z.infer<typeof CreateEstudioSchema>

export const UpdateEstudioSchema = CreateEstudioSchema
export type UpdateEstudioInput = z.infer<typeof UpdateEstudioSchema>
