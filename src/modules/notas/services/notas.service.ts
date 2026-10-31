/**
 * Servicio: notas del ejercicio con la columna "Ejercicio anterior" resuelta según el modo del
 * ejercicio anterior. Única forma de leerlas para mostrarlas o imprimirlas (la pantalla de Notas y
 * el documento pasan por acá).
 *  - VINCULADO: la columna sale de las cuentas del ejercicio anterior (ver anteriorVinculado).
 *  - MANUAL: la columna es la que se cargó en cada nota.
 *  - SIN_ANTERIOR / PENDIENTE: no hay columna; las notas tal cual.
 */

import { usarDerivadoDelAnterior } from '@/modules/comparativo-manual/lib/politica'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { ajustarCuentas, getIndicesReexpresion } from '@/modules/estados/lib/ajuste'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { findNotasByEjercicio } from '../repository/notas.repository'
import { derivarAnteriorDeNotas } from '../domain/anteriorVinculado'
import type { NotaDTO } from '../domain/types'

export async function cargarNotas(ejercicio: EjercicioContableDTO): Promise<NotaDTO[]> {
  const anteriorId = usarDerivadoDelAnterior(modoEfectivo(ejercicio))
    ? idAnteriorDerivable(ejercicio)
    : null
  if (!anteriorId) return findNotasByEjercicio(ejercicio.id)

  // Las tres lecturas en paralelo: un solo viaje a la base.
  const [notas, cuentas, cuentasAnt] = await Promise.all([
    findNotasByEjercicio(ejercicio.id),
    findCuentasByEjercicio(ejercicio.id),
    findCuentasByEjercicio(anteriorId),
  ])
  return derivarAnteriorDeNotas(
    notas,
    cuentas,
    ajustarCuentas(cuentasAnt, getIndicesReexpresion(ejercicio)),
  )
}
