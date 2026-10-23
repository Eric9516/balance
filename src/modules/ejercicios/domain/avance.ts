/**
 * Lo que el propio ejercicio tiene que tener confirmado para pasar a Revisión o Cerrado.
 *
 * Sin este control un ejercicio podía cerrarse con el E.E.P.N. sin confirmar; el ejercicio
 * siguiente, vinculado a él, exige su anterior confirmado (AUT-022) y el cerrado ya no se puede
 * modificar: quedaba trabado. Puro.
 */
export function faltaConfirmarParaAvanzar(ejercicio: {
  estadosConfirmado: boolean
  pnConfirmado: boolean
}): string[] {
  return [
    ...(ejercicio.estadosConfirmado ? [] : ['los estados contables']),
    ...(ejercicio.pnConfirmado ? [] : ['el E.E.P.N.']),
  ]
}
