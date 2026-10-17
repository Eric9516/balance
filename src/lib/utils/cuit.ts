// CUIT/CUIL: XX-XXXXXXXX-X format, verified with official mod-11 algorithm
const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export function validarCuit(cuit: string): boolean {
  const digits = cuit.replace(/[-\s]/g, '')

  if (!/^\d{11}$/.test(digits)) return false

  const suma = MULTIPLICADORES.reduce((acc, m, i) => acc + Number(digits[i]) * m, 0)

  const resto = suma % 11
  const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto

  return verificador === Number(digits[10])
}

export function formatCuit(cuit: string): string {
  const digits = cuit.replace(/[-\s]/g, '')
  if (digits.length !== 11) return cuit
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits[10]}`
}

export function normalizarCuit(cuit: string): string {
  return cuit.replace(/[-\s]/g, '')
}
