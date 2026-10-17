/**
 * Parseo robusto de importes para inputs y datos crudos. Formato argentino primero.
 * - "1.234,56" → 1234.56 · "1,234.56" → 1234.56 (si hay ambos separadores, el último es el decimal)
 * - "150.000" / "1.234.567" → miles (convención AR: punto + 3 dígitos = separador de miles)
 * - "1,5" → 1.5 · "1.5" / "1234.56" → decimal
 * - Paréntesis = negativo: "(1.234,56)" → -1234.56. Símbolos/espacios se ignoran.
 * - Vacío / "-" / "—" / texto inválido → 0.
 *
 * Es la única función de parseo de importes de la app. NO usar `parseFloat(x.replace(',','.'))`
 * suelto (rompe los miles). Contraparte para mostrar en un input: `importeEditable`.
 */
export function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const original = String(raw ?? '').trim()
  const negativoPorParentesis = /^\(.*\)$/.test(original)
  let s = original.replace(/[$\s()]/g, '')
  if (!s || s === '-' || s === '—') return 0

  const comas = s.split(',').length - 1
  const puntos = s.split('.').length - 1

  if (comas > 0 && puntos > 0) {
    // Ambos separadores: el último es el decimal.
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '')
  } else if (comas > 0) {
    // Una coma = decimal AR ("1,5"); varias = miles anglo ("1,234,567").
    s = comas === 1 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (puntos > 1 || /^-?[1-9]\d{0,2}\.\d{3}$/.test(s)) {
    // Varios puntos ("1.234.567") o "150.000": separador de miles AR.
    s = s.replace(/\./g, '')
  }

  if (!/^-?\d*\.?\d+$/.test(s)) return 0
  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return negativoPorParentesis ? -Math.abs(n) : n
}

/**
 * Número → texto para EDITAR en un input, en formato AR sin miles ("1234,56").
 * Es la inversa exacta de `parseImporte`: parseImporte(importeEditable(n)) === n.
 * 0 → '' para que el input quede vacío.
 */
export function importeEditable(n: number): string {
  if (!n || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}
