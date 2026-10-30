/**
 * Servicio: Estado de Flujo de Efectivo de un ejercicio. Única forma de obtenerlo
 * (la página, las actions y la compuerta de autorización pasan por acá), así el
 * efectivo al inicio/cierre siempre sale del mismo SSP ya resuelto por modo.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EstadosData } from '@/modules/estados/domain/types'
import { getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import { findRubrosBase } from '@/modules/importaciones/repository/cuentas.repository'
import { armarFlujo, efectivoDesdeSSP, type FlujoData } from '../domain/calculo'
import type { FlujoGuardadoDTO } from '../domain/types'
import { findFlujo } from '../repository/flujo.repository'

/**
 * Arma el flujo combinando lo guardado con lo derivado del balance y del flujo anterior.
 * `guardado` permite pasar un flujo ya leído o el borrador del cliente (filtrado a
 * líneas propias) para sanearlo antes de persistir.
 */
export async function cargarFlujo(
  ejercicio: EjercicioContableDTO,
  estadosData: EstadosData,
  guardado?: FlujoGuardadoDTO | null,
): Promise<FlujoData> {
  const anteriorId = idAnteriorDerivable(ejercicio)
  const [rubros, base, flujoAnterior] = await Promise.all([
    findRubrosBase(ejercicio.estudioId),
    guardado !== undefined ? Promise.resolve(guardado) : findFlujo(ejercicio.id),
    anteriorId ? findFlujo(anteriorId) : Promise.resolve(null),
  ])
  const rubrosEfectivo = new Set(rubros.filter((r) => r.esEfectivo).map((r) => r.id))
  return armarFlujo({
    guardado: base,
    efectivo: efectivoDesdeSSP(estadosData.sspRubros, rubrosEfectivo),
    modo: modoEfectivo(ejercicio),
    flujoAnterior,
    coeficiente: getCoeficienteComparativo(ejercicio),
  })
}
