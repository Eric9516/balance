import Decimal from 'decimal.js'
import type { AppError } from '@/modules/errores/types'
import { formatCurrency } from '@/lib/utils/currency'

/**
 * Aritmética de importes: ÚNICA forma de sumar, restar, multiplicar o comparar dinero en la app
 * (dominio contable y pantallas). Ver docs/decisiones/0009-importes-exactos.md.
 *
 * - Cada operación se hace en decimal exacto: nunca se acumula el error del `number` de
 *   JavaScript (0.1 + 0.2 = 0.30000000000000004).
 * - Los valores entran y salen como `number`, que es como viajan entre el servidor y la pantalla.
 *   Un `number` se lee por su representación más corta (0.1 es exactamente 0,10), así que
 *   encadenar operaciones no acumula error.
 * - Límite: un `number` distingue todos los centavos mientras la separación entre dos números
 *   representables sea menor a un centavo, es decir hasta 2^46 (unos 70 billones de pesos). Un resultado mayor no se redondea en silencio: corta con un error claro (NEG-060).
 * - JAMÁS redondea (regla primordial de CLAUDE.md): ni a centavos ni a ninguna cantidad de decimales.
 */
const Exacto = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP })

/** Lo que se acepta como importe: number, texto, Decimal (incluido Prisma.Decimal) o vacío (= 0). */
export type ValorImporte = number | string | Decimal | { toString(): string } | null | undefined

/**
 * El mayor importe con centavos exactos en un `number`: 2^46 − 0,01. Desde 2^46 la separación
 * entre dos `number` consecutivos es 1/64 (más de un centavo) y se perderían centavos.
 */
export const MAX_IMPORTE_EXACTO = 70_368_744_177_663.99

const formato = (d: Decimal) => formatCurrency(d, { decimales: 'todos' })

function error(codigo: 'NEG-060' | 'NEG-061', mensaje: string): AppError {
  return { tipo: 'NEGOCIO', severidad: 'ALTO', codigo, mensaje }
}

function aExacto(valor: ValorImporte): Decimal {
  if (valor === null || valor === undefined) return new Exacto(0)
  // Solo los de 34 dígitos: un Decimal común también es instanceof, pero calcula con 20
  if (typeof valor === 'object' && valor.constructor === Exacto) return valor as Decimal
  if (typeof valor === 'number' && !Number.isFinite(valor)) {
    throw error('NEG-061', `Se intentó calcular con un importe que no es un número (${valor}).`)
  }
  try {
    return new Exacto(typeof valor === 'number' ? valor : valor.toString())
  } catch {
    throw error('NEG-061', `"${String(valor)}" no es un importe válido.`)
  }
}

function aNumero(d: Decimal): number {
  if (d.abs().gt(MAX_IMPORTE_EXACTO)) {
    throw error(
      'NEG-060',
      `El importe ${formato(d)} supera el máximo que BalanceRT calcula con centavos exactos ` +
        `(${formato(new Exacto(MAX_IMPORTE_EXACTO))}). Revisá la carga de ese importe.`,
    )
  }
  return d.toNumber()
}

// ─── Camino rápido: centavos enteros ─────────────────────────────────────────
// Casi todos los importes tienen a lo sumo 2 decimales (así vienen de la base). Si un number v
// cumple Math.round(v·100) / 100 === v, entonces v es exactamente el double más cercano a esos
// centavos y su lectura decimal es ese mismo importe: sumar los centavos como enteros da el mismo
// resultado que el cálculo decimal, sin crear objetos. Ante cualquier otro valor (más decimales,
// texto, Decimal, enteros fuera de rango seguro) se usa el camino exacto. Mismo resultado, más rápido.

/** Centavos enteros de un number con a lo sumo 2 decimales; null si no lo es. */
function centavos(v: number): number | null {
  const c = Math.round(v * 100)
  return Number.isSafeInteger(c) && c / 100 === v ? c : null
}

function desdeCentavos(c: number): number {
  const v = c / 100
  return Math.abs(v) <= MAX_IMPORTE_EXACTO ? v : aNumero(new Exacto(c).div(100))
}

/** Importe leído de la base (Prisma.Decimal) o de cualquier otra fuente, verificado. */
export function importe(valor: ValorImporte): number {
  if (valor === null || valor === undefined) return 0
  const n =
    typeof valor === 'number'
      ? valor
      : typeof valor === 'object' && 'toNumber' in valor && typeof valor.toNumber === 'function'
        ? (valor.toNumber() as number)
        : Number.NaN
  if (Number.isFinite(n) && Math.abs(n) <= MAX_IMPORTE_EXACTO) return n
  return aNumero(aExacto(valor))
}

/** Suma de un valor de cada elemento: sumarPor(cuentas, (c) => c.saldoFinal). */
export function sumarPor<T>(items: readonly T[], valor: (item: T) => ValorImporte): number {
  let total = 0
  for (const item of items) {
    const v = valor(item)
    if (v === null || v === undefined) continue
    const c = typeof v === 'number' ? centavos(v) : null
    if (c === null) return sumarPorExacto(items, valor)
    total += c
    if (!Number.isSafeInteger(total)) return sumarPorExacto(items, valor)
  }
  return desdeCentavos(total)
}

// ─── Camino exacto con enteros grandes (BigInt) ──────────────────────────────
// Un number se lee por su representación decimal más corta (String(v)), que es exacta: se pasa a
// un entero grande escalado (dígitos sin el punto + cantidad de decimales), se opera con enteros
// exactos y el resultado vuelve a number leyendo su texto decimal, que JavaScript redondea
// correctamente. Da lo mismo que decimal.js, sin crear sus objetos. Para lo que no es number, o
// está escrito en notación exponencial (1e-7), se usa decimal.js.

type Escalado = { n: bigint; escala: number }

function aEscalado(v: number): Escalado | null {
  if (!Number.isFinite(v)) return null
  const s = String(v)
  if (s.includes('e')) return null
  const punto = s.indexOf('.')
  if (punto < 0) return { n: BigInt(s), escala: 0 }
  return { n: BigInt(s.slice(0, punto) + s.slice(punto + 1)), escala: s.length - punto - 1 }
}

function reescalar(e: Escalado, escala: number): bigint {
  return escala === e.escala ? e.n : e.n * 10n ** BigInt(escala - e.escala)
}

function desdeEscalado(n: bigint, escala: number): number {
  const negativo = n < 0n
  const digitos = (negativo ? -n : n).toString().padStart(escala + 1, '0')
  const texto =
    (negativo ? '-' : '') +
    (escala === 0 ? digitos : `${digitos.slice(0, -escala)}.${digitos.slice(-escala)}`)
  const r = Number(texto)
  return Math.abs(r) <= MAX_IMPORTE_EXACTO ? r : aNumero(new Exacto(texto))
}

function sumarPorExacto<T>(items: readonly T[], valor: (item: T) => ValorImporte): number {
  const escalados: Escalado[] = []
  let escala = 0
  for (const item of items) {
    const v = valor(item)
    if (v === null || v === undefined) continue
    const e = typeof v === 'number' ? aEscalado(v) : null
    if (!e) return sumarPorDecimal(items, valor)
    escalados.push(e)
    if (e.escala > escala) escala = e.escala
  }
  let total = 0n
  for (const e of escalados) total += reescalar(e, escala)
  return desdeEscalado(total, escala)
}

function sumarPorDecimal<T>(items: readonly T[], valor: (item: T) => ValorImporte): number {
  return aNumero(
    items.reduce<Decimal>((acc, item) => acc.plus(aExacto(valor(item))), new Exacto(0)),
  )
}

const mismo = (v: ValorImporte) => v

/** a + b + c + ... (vacíos cuentan como 0). */
export function sumar(...valores: ValorImporte[]): number {
  return sumarPor(valores, mismo)
}

/** minuendo − sustraendo − ... */
export function restar(minuendo: ValorImporte, ...sustraendos: ValorImporte[]): number {
  let total = 0
  for (let i = 0; i <= sustraendos.length; i++) {
    const v = i === 0 ? minuendo : sustraendos[i - 1]
    if (v === null || v === undefined) continue
    const c = typeof v === 'number' ? centavos(v) : null
    if (c === null) return restarExacto(minuendo, sustraendos)
    total = i === 0 ? c : total - c
    if (!Number.isSafeInteger(total)) return restarExacto(minuendo, sustraendos)
  }
  return desdeCentavos(total)
}

function restarExacto(minuendo: ValorImporte, sustraendos: ValorImporte[]): number {
  // minuendo − s1 − s2 − ... = suma exacta del minuendo y los sustraendos con signo invertido.
  return sumarPorExacto([minuendo, ...sustraendos.map(negar)], mismo)
}

function negar(v: ValorImporte): ValorImporte {
  if (v === null || v === undefined) return v
  return typeof v === 'number' ? -v : aExacto(v).neg()
}

/** importe × factor (por ejemplo, un coeficiente de reexpresión). No redondea a centavos. */
export function multiplicar(valor: ValorImporte, factor: ValorImporte): number {
  if (typeof valor === 'number' && typeof factor === 'number') {
    const a = aEscalado(valor)
    const b = aEscalado(factor)
    if (a && b) return desdeEscalado(a.n * b.n, a.escala + b.escala)
  }
  return aNumero(aExacto(valor).times(aExacto(factor)))
}

/** dividendo ÷ divisor, con 34 dígitos significativos. Dividir por cero corta con NEG-061. */
export function dividir(dividendo: ValorImporte, divisor: ValorImporte): number {
  const d = aExacto(divisor)
  if (d.isZero()) throw error('NEG-061', 'Se intentó dividir un importe por cero.')
  return aNumero(aExacto(dividendo).div(d))
}

/**
 * dividendo ÷ divisor con sus 34 dígitos, sin pasar a `number`. Es el factor de la reexpresión: como
 * `number` (unos 16 dígitos), un resultado que cae justo en centavos quedaría apenas abajo
 * (91.660,71999999999 en vez de 91.660,72). Se calcula una vez y se pasa a `multiplicar`.
 */
export function cocienteExacto(dividendo: ValorImporte, divisor: ValorImporte): Decimal {
  const d = aExacto(divisor)
  if (d.isZero()) throw error('NEG-061', 'Se intentó dividir un importe por cero.')
  return aExacto(dividendo).div(d)
}

/** valor × multiplicador ÷ divisor, en ese orden y sin pasar por el cociente. */
export function multiplicarYDividir(
  valor: ValorImporte,
  multiplicador: ValorImporte,
  divisor: ValorImporte,
): number {
  const d = aExacto(divisor)
  if (d.isZero()) throw error('NEG-061', 'Se intentó dividir un importe por cero.')
  return aNumero(aExacto(valor).times(aExacto(multiplicador)).div(d))
}

/** Iguales exactos: jamás se redondea, así que tampoco se tolera ninguna diferencia. */
export function comparaImportes(a: ValorImporte, b: ValorImporte): boolean {
  return aExacto(a).eq(aExacto(b))
}
