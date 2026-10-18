import { z } from 'zod'
import { validarInvariantesModo } from '../domain/ejercicioAnterior'

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

export const MODO_ANTERIOR_VALUES = ['VINCULADO', 'MANUAL', 'SIN_ANTERIOR'] as const
export const CATEGORIA_ENTE_VALUES = ['PEQUENA', 'MEDIANA', 'RESTANTE'] as const

export const CreateEjercicioSchema = z
  .object({
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
    // ── Ejercicio anterior (requisito comparativo RT 54) ─────────────────────
    modoAnterior: z.enum(MODO_ANTERIOR_VALUES, {
      error: 'Elegí cómo se resuelve el ejercicio anterior',
    }),
    ejercicioAnteriorId: z.string().optional(),
    // ── Categoría del ente (RT 54) ───────────────────────────────────────────
    categoriaEnte: z.enum(CATEGORIA_ENTE_VALUES, {
      error: 'La categoría del ente según RT 54 es requerida',
    }),
    fechaInformeAuditor: z.string().min(1, 'La fecha del informe del auditor es requerida'),
    indiceInflacionAnterior: requiredIndiceInflacion('El índice de inicio'),
    indiceInflacionActual: requiredIndiceInflacion('El índice de cierre'),
  })
  .superRefine((data, ctx) => {
    const invariante = validarInvariantesModo(data.modoAnterior, data.ejercicioAnteriorId || null)
    if (invariante) {
      ctx.addIssue({ code: 'custom', message: invariante, path: ['ejercicioAnteriorId'] })
    }
    const inicio = new Date(data.fechaInicio).getTime()
    const cierre = new Date(data.fechaCierre).getTime()
    if (Number.isFinite(inicio) && Number.isFinite(cierre) && cierre <= inicio) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha de cierre tiene que ser posterior a la de inicio',
        path: ['fechaCierre'],
      })
    }
  })

export type CreateEjercicioInput = z.infer<typeof CreateEjercicioSchema>

export const UpdateEjercicioSchema = CreateEjercicioSchema
export type UpdateEjercicioInput = z.infer<typeof UpdateEjercicioSchema>
