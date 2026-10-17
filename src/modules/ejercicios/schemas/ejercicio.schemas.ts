import { z } from 'zod'

const MAX_INDICE_INFLACION = 999_999_999_999.999999

function requiredIndiceInflacion(label: string) {
  return z
    .string()
    .min(1, `${label} es requerido`)
    .refine((value) => {
      const normalized = value.trim().replace(',', '.')
      const n = Number(normalized)
      return Number.isFinite(n) && n > 0 && n <= MAX_INDICE_INFLACION
    }, `${label} debe ser un número positivo de hasta 12 dígitos enteros`)
}

export const CreateEjercicioSchema = z.object({
  fechaInicio: z.string().min(1, 'La fecha de inicio es requerida'),
  fechaCierre: z.string().min(1, 'La fecha de cierre es requerida'),
  denominacion: z.string().optional(),
  numeroEjercicio: z
    .string()
    .min(1, 'El número de ejercicio es requerido')
    .refine((v) => {
      const n = parseInt(v, 10)
      return Number.isInteger(n) && n >= 1
    }, 'Debe ser un número entero mayor a 0'),
  auditorId: z.string().min(1, 'El auditor es requerido'),
  ejercicioAnteriorId: z.string().optional(),
  fechaInformeAuditor: z.string().min(1, 'La fecha del informe del auditor es requerida'),
  clasificacionEntidad: z.string().min(1, 'La clasificación de la entidad es requerida'),
  indiceInflacionAnterior: requiredIndiceInflacion('El índice de inicio'),
  indiceInflacionActual: requiredIndiceInflacion('El índice de cierre'),
  // Balance anterior
  balanceAnteriorDisponible: z.boolean().optional(),
  nivelComparativoSSP: z.enum(['SECCION', 'RUBRO']).optional(),
})

export type CreateEjercicioInput = z.infer<typeof CreateEjercicioSchema>

export const UpdateEjercicioSchema = CreateEjercicioSchema
export type UpdateEjercicioInput = z.infer<typeof UpdateEjercicioSchema>
