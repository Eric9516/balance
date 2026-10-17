import { describe, expect, it } from 'vitest'
import { formatFecha, toDateInputValue } from './dates'

describe('formatFecha', () => {
  it('formatea en UTC: una fecha de cierre a medianoche UTC no se corre de día', () => {
    expect(formatFecha(new Date('2025-12-31T00:00:00.000Z'))).toBe('31/12/2025')
    expect(formatFecha('2025-01-01')).toBe('01/01/2025')
  })

  it('usa el fallback para valores vacíos o inválidos', () => {
    expect(formatFecha(null)).toBe('-')
    expect(formatFecha('no-es-fecha', 'Sin fecha')).toBe('Sin fecha')
  })
})

describe('toDateInputValue', () => {
  it('devuelve yyyy-mm-dd en UTC', () => {
    expect(toDateInputValue(new Date('2025-12-31T00:00:00.000Z'))).toBe('2025-12-31')
  })

  it("devuelve '' para null o fecha inválida", () => {
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue('basura')).toBe('')
  })
})
