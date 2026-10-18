/**
 * Servicio: validación de la configuración del ejercicio anterior contra la base
 * (misma sociedad, fechas, ciclos, anterior ya usado). Orquesta repositorio + dominio.
 */

import type { ModoEjercicioAnterior } from '@prisma/client'
import {
  validarInvariantesModo,
  validarVinculoEjercicioAnterior,
  type ResultadoVinculo,
} from '../domain/ejercicioAnterior'
import {
  findCadenaAnterior,
  findResumenById,
  findSucesorId,
} from '../repository/ejercicio.repository'

export async function validarConfiguracionAnterior(params: {
  sociedadId: string
  actualId: string | null
  fechaInicio: Date
  modoAnterior: ModoEjercicioAnterior
  ejercicioAnteriorId: string | null
}): Promise<ResultadoVinculo> {
  const { sociedadId, actualId, fechaInicio, modoAnterior, ejercicioAnteriorId } = params

  const invariante = validarInvariantesModo(modoAnterior, ejercicioAnteriorId)
  if (invariante) return { errores: [invariante], advertencias: [] }
  if (modoAnterior !== 'VINCULADO' || !ejercicioAnteriorId) {
    return { errores: [], advertencias: [] }
  }

  const [anterior, cadenaDelAnterior, usadoPor] = await Promise.all([
    findResumenById(ejercicioAnteriorId),
    findCadenaAnterior(ejercicioAnteriorId),
    findSucesorId(ejercicioAnteriorId),
  ])
  if (!anterior) {
    return { errores: ['El ejercicio anterior elegido no existe.'], advertencias: [] }
  }

  return validarVinculoEjercicioAnterior({
    actual: { id: actualId, sociedadId, fechaInicio },
    anterior,
    cadenaDelAnterior,
    usadoPor,
  })
}
