import { describe, expect, it } from 'vitest'
import { formatCuit, normalizarCuit, validarCuit } from './cuit'

describe('validarCuit', () => {
  it.each(['20-12345678-6', '30712345671', '27 00000000 6'])('acepta %s', (cuit) => {
    expect(validarCuit(cuit)).toBe(true)
  })

  it.each(['20-12345678-5', '3071234567', '307123456712', 'ab-12345678-6', ''])(
    'rechaza %s',
    (cuit) => {
      expect(validarCuit(cuit)).toBe(false)
    },
  )
})

describe('formatCuit / normalizarCuit', () => {
  it('formatea XX-XXXXXXXX-X y normaliza a 11 dígitos', () => {
    expect(formatCuit('30712345671')).toBe('30-71234567-1')
    expect(normalizarCuit('30-71234567-1')).toBe('30712345671')
  })

  it('deja sin tocar un CUIT de largo inválido', () => {
    expect(formatCuit('123')).toBe('123')
  })
})
