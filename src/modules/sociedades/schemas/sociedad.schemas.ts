import { z } from 'zod'
import { TipoPersona } from '@prisma/client'
import { validarCuit } from '@/lib/utils/cuit'

export const CreateSociedadSchema = z
  .object({
    razonSocial: z.string().min(1, 'La razón social es requerida').max(200),
    cuit: z
      .string()
      .min(1, 'El CUIT es requerido')
      .refine(validarCuit, 'CUIT inválido (verificá el dígito verificador)'),
    tipoPersona: z.nativeEnum(TipoPersona),
    // Jurídica
    tipoSocietario: z.string().optional(),
    // Física
    condicionFiscal: z.string().optional(),
    // Domicilio
    domicilioLegal: z.string().min(1, 'El domicilio es requerido'),
    localidad: z.string().min(1, 'La localidad es requerida'),
    provincia: z.string().min(1, 'La provincia es requerida'),
    codigoPostal: z.string().min(1, 'El código postal es requerido'),
    // Actividad
    actividadPpal: z.string().min(1, 'La actividad principal es requerida'),
    actividadSecundaria: z.string().optional(),
    // Datos contables
    clasificacionRT54: z.string().min(1, 'La clasificación RT 54 es requerida'),
    // Registrales
    fechaInscripcion: z.string().min(1, 'La fecha de inscripción es requerida'),
    matriculaPJ: z.string().min(1, 'La matrícula es requerida'),
    plazoDuracion: z.string().min(1, 'La fecha de plazo de duración es requerida'),
    composicionCapital: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoSocietario === 'S.A.S.' && !data.composicionCapital?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La composición del capital es requerida para S.A.S.',
        path: ['composicionCapital'],
      })
    }
  })

export type CreateSociedadInput = z.infer<typeof CreateSociedadSchema>

export const UpdateSociedadSchema = CreateSociedadSchema
export type UpdateSociedadInput = z.infer<typeof UpdateSociedadSchema>
