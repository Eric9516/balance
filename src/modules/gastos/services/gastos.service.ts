/**
 * Servicio: Anexo III (Gastos) de un ejercicio con la columna "Ejercicio anterior"
 * resuelta según el modo. Única forma de obtenerlo para la pantalla y el documento.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import { editarAnteriorManual, resolverGastos } from '@/modules/comparativo-manual/lib/politica'
import { ajustarGastos, getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import { findGastosDinamicos, type GastosSecciones } from '../repository/gastos-dinamico.repository'

export async function cargarGastos(ejercicio: EjercicioContableDTO): Promise<GastosSecciones> {
  const modo = modoEfectivo(ejercicio)
  const [gastos, comparativos] = await Promise.all([
    findGastosDinamicos(ejercicio.id, idAnteriorDerivable(ejercicio)),
    editarAnteriorManual(modo)
      ? // Totales por sección ('GASTOS') y filas ('GASTOS_FILA') en una sola consulta.
        findComparativoByEjercicio(ejercicio.id).then((cs) =>
          cs.filter((c) => c.modulo === 'GASTOS' || c.modulo === 'GASTOS_FILA'),
        )
      : Promise.resolve([] as ComparativoManualDTO[]),
  ])
  return resolverGastos(
    ajustarGastos(gastos, getCoeficienteComparativo(ejercicio)),
    modo,
    comparativos,
  )
}
