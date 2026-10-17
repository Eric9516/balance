import Decimal from 'decimal.js'

// saldoFinal = saldoDeudor - saldoAcreedor
// positive → deudora, negative → acreedora
export const TOLERANCIA_CENTAVOS = 0.01

export function comparaImportes(
  a: Decimal | number | string,
  b: Decimal | number | string,
): boolean {
  return new Decimal(a).minus(new Decimal(b)).abs().lte(TOLERANCIA_CENTAVOS)
}
