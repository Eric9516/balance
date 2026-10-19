import Decimal from 'decimal.js'

/**
 * Formato argentino: punto de miles, coma decimal y paréntesis para los negativos.
 * Por defecto muestra 2 decimales: decisión del dueño del producto (2026-10-19) para pantalla y
 * documento. Es solo presentación; los cálculos y la base conservan el valor completo.
 * `decimales: 'todos'` muestra el valor completo, SIN redondear (mínimo 2 decimales):
 * es lo que corresponde en mensajes de control, donde la diferencia puede estar en el tercer decimal.
 */
export function formatCurrency(
  valor: Decimal | number | string | null | undefined,
  opciones?: {
    decimales?: number | 'todos'
    mostrarSimbolo?: boolean
    ceroComoGuion?: boolean
  },
): string {
  if (valor === null || valor === undefined) return '-'

  const { decimales = 2, mostrarSimbolo = false, ceroComoGuion = false } = opciones ?? {}

  const d = new Decimal(String(valor))

  if (ceroComoGuion && d.isZero()) return '-'

  const absVal = d.abs().toFixed(decimales === 'todos' ? Math.max(2, d.decimalPlaces()) : decimales)
  const [entero = '0', fraccion] = absVal.split('.')

  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resultado = fraccion ? `${enteroFormateado},${fraccion}` : enteroFormateado
  const conSimbolo = mostrarSimbolo ? `$ ${resultado}` : resultado

  return d.isNegative() ? `(${conSimbolo})` : conSimbolo
}

/**
 * Coeficiente de reexpresión para mostrar: 2 decimales en formato argentino (1,32).
 * Decisión del dueño del producto (2026-10-19): es solo presentación. El cálculo usa siempre el
 * coeficiente completo (`dividir` de `@/lib/importe`), nunca el valor mostrado.
 */
export function formatCoeficiente(coeficiente: number): string {
  return formatCurrency(coeficiente)
}
