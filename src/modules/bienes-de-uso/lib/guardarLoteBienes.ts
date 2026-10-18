import type { ActionResult } from '@/modules/errores/types'
import { guardarLoteBienesAction } from '../actions/bienes-de-uso.actions'
import type { BienDeUsoDTO } from '../domain/types'

// Persiste todos los bienes del borrador de una vez, en UN solo round trip.
// El servidor sanea los campos bloqueados por el ejercicio anterior (modo VINCULADO).
export function guardarLoteBienes(
  bienes: BienDeUsoDTO[],
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<BienDeUsoDTO[]>> {
  return guardarLoteBienesAction(ejercicioId, sociedadId, bienes)
}
