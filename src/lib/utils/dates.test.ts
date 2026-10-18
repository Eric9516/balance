import { describe, expect, it } from 'vitest'
import { formatFecha, formatFechaLarga, toDateInputValue } from './dates'

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

describe('formatFechaLarga', () => {
  it('escribe la fecha en castellano y en UTC', () => {
    expect(formatFechaLarga(new Date('2025-12-31T00:00:00.000Z'))).toBe('31 de diciembre de 2025')
    expect(formatFechaLarga('2026-03-05', { mesMayuscula: true })).toBe('05 de Marzo de 2026')
  })

  it('usa el fallback para valores vacíos o inválidos', () => {
    expect(formatFechaLarga(null)).toBe('—')
    expect(formatFechaLarga('basura', {}, 'Sin fecha')).toBe('Sin fecha')
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
