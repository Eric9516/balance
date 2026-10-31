import Decimal from 'decimal.js'

/**
 * Formato argentino: punto de miles, coma decimal y paréntesis para los negativos.
 * Por defecto muestra 2 decimales: decisión del dueño del producto (2026-10-19) para pantalla y
 * documento. Los decimales de más se cortan, sin redondear: 1.234,567 se ve 1.234,56 (decisión del
 * dueño del producto, 2026-10-31). Es solo presentación; los cálculos y la base conservan el valor
 * completo.
 * `decimales: 'todos'` muestra el valor completo (mínimo 2 decimales):
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

  const cifras = decimales === 'todos' ? Math.max(2, d.decimalPlaces()) : decimales
  const absVal = d.abs().toFixed(cifras, Decimal.ROUND_DOWN)
  const [entero = '0', fraccion] = absVal.split('.')

  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resultado = fraccion ? `${enteroFormateado},${fraccion}` : enteroFormateado
  const conSimbolo = mostrarSimbolo ? `$ ${resultado}` : resultado

  return d.isNegative() ? `(${conSimbolo})` : conSimbolo
}

/**
 * Coeficiente de reexpresión para mostrar: 2 decimales cortados, como todo importe (1,31 si es
 * 1,3154...). Es solo presentación: el cálculo usa siempre el coeficiente completo (`dividir` de
 * `@/lib/importe`), nunca el valor mostrado.
 */
export function formatCoeficiente(coeficiente: number): string {
  return formatCurrency(coeficiente)
}

/**
 * Coeficiente anual en los datos del ejercicio: el único lugar con 8 decimales, para controlarlo
 * contra los índices (decisión del dueño del producto, 2026-10-31). También cortados.
 */
export function formatCoeficienteOchoDecimales(coeficiente: number): string {
  return formatCurrency(coeficiente, { decimales: 8 })
}
