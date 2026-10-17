/**
 * Parseo robusto de importes para inputs y datos crudos.
 * - Detecta formato argentino (1.234,56) vs anglosajón (1,234.56) por el último separador.
 * - Paréntesis = negativo: "(1.234,56)" → -1234.56
 * - Símbolos/espacios se ignoran. Vacío / "-" / "—" → 0.
 *
 * Es la única función de parseo de importes de la app. NO usar `parseFloat(x.replace(',','.'))`
 * suelto (rompe los miles). Ver CeldaNumero y la convención de tablas editables.
 */
export function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  const original = String(raw ?? '').trim()
  const negativoPorParentesis = /^\(.*\)$/.test(original)
  let s = original.replace(/[$\s()]/g, '')
  if (!s || s === '-' || s === '—') return 0
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // Formato AR: el punto es separador de miles, la coma es decimal.
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Formato anglo o sin coma: la coma (si hay) es separador de miles.
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return negativoPorParentesis ? -Math.abs(n) : n
}
