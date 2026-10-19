import { describe, expect, it } from 'vitest'
import { esUuid } from './uuid'

describe('esUuid', () => {
  it('acepta UUID de cualquier versión, en minúsculas o mayúsculas', () => {
    expect(esUuid('0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b')).toBe(true) // v7
    expect(esUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true) // v4
    expect(esUuid('0192A3B4-C5D6-7E8F-9A0B-1C2D3E4F5A6B')).toBe(true)
  })

  it('rechaza todo lo que no puede ser un identificador de la base', () => {
    for (const valor of [
      'cmpt32szg0000wwbvct74pikd', // cuid viejo
      'no-existe',
      '',
      '0192a3b4c5d67e8f9a0b1c2d3e4f5a6b', // sin guiones
      '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6', // un dígito menos
      ' 0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
      "0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b' OR '1'='1",
      null,
      undefined,
      123,
    ]) {
      expect(esUuid(valor), String(valor)).toBe(false)
    }
  })
})
