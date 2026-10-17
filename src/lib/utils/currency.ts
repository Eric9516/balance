import Decimal from 'decimal.js'

// Argentine format: period for thousands, comma for decimals, parentheses for negatives
export function formatCurrency(
  valor: Decimal | number | string | null | undefined,
  opciones?: {
    decimales?: number
    mostrarSimbolo?: boolean
    ceroComoGuion?: boolean
  },
): string {
  if (valor === null || valor === undefined) return '-'

  const {
    decimales = 2,
    mostrarSimbolo = false,
    ceroComoGuion = false,
  } = opciones ?? {}

  const d = new Decimal(String(valor))

  if (ceroComoGuion && d.isZero()) return '-'

  const absVal = d.abs().toFixed(decimales)
  const [entero, fraccion] = absVal.split('.')

  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resultado = fraccion ? `${enteroFormateado},${fraccion}` : enteroFormateado
  const conSimbolo = mostrarSimbolo ? `$ ${resultado}` : resultado

  return d.isNegative() ? `(${conSimbolo})` : conSimbolo
}
