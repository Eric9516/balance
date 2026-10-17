import { z } from 'zod'
import { SECCIONES_EERR, SECCIONES_SSP } from '../domain/secciones'

/** Sección opcional: '' (select vacío) o un valor válido del enum. */
const seccionOpcional = <T extends [string, ...string[]]>(valores: T) =>
  z.union([z.enum(valores), z.literal('')]).optional()

export const CreateRubroBaseSchema = z
  .object({
    rubroGrupoId: z.string().optional(), // si se elige grupo, hereda destino/sección del grupo
    codigo: z.string().min(1, 'El código es requerido').max(30),
    nombre: z.string().min(1, 'El nombre es requerido').max(200),
    estadoDestino: z.enum(['SSP', 'EERR', 'PN'], { message: 'Seleccioná el estado destino' }),
    seccionSSP: seccionOpcional(SECCIONES_SSP),
    seccionEERR: seccionOpcional(SECCIONES_EERR),
    naturalezaEsperada: z.enum(['DEUDORA', 'ACREEDORA'], { message: 'Seleccioná la naturaleza' }),
    orden: z
      .string()
      .min(1, 'El orden es requerido')
      .refine(
        (v) => Number.isInteger(Number(v)) && Number(v) >= 0,
        'Debe ser un número entero positivo',
      ),
  })
  .superRefine((data, ctx) => {
    // Si tiene grupo, hereda sección → no validar manualmente
    if (data.rubroGrupoId) return
    if ((data.estadoDestino === 'SSP' || data.estadoDestino === 'PN') && !data.seccionSSP) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seleccioná la sección del SSP',
        path: ['seccionSSP'],
      })
    }
    if (data.estadoDestino === 'EERR' && !data.seccionEERR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Seleccioná la sección del EERR',
        path: ['seccionEERR'],
      })
    }
  })

export type CreateRubroBaseInput = z.infer<typeof CreateRubroBaseSchema>
