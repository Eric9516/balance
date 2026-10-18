import { describe, it, expect } from 'vitest'
import {
  ACENTO_DEFAULT,
  ACENTOS_SUGERIDOS,
  acentoSeguro,
  contrasteConBlanco,
  validarAcento,
} from './preferencias'

describe('validarAcento', () => {
  it('acepta el default y todos los sugeridos (contraste AA con blanco)', () => {
    expect(validarAcento(ACENTO_DEFAULT)).toBeNull()
    for (const a of ACENTOS_SUGERIDOS) expect(validarAcento(a.hex)).toBeNull()
  })
  it('rechaza formatos inválidos', () => {
    for (const v of ['2F6B55', '#2F6B5', '#GGGGGG', 'red', '#2f6b55;}body{x:y', '']) {
      expect(validarAcento(v)).toMatch(/formato/)
    }
  })
  it('rechaza colores claros con un mensaje accionable', () => {
    expect(validarAcento('#FFE066')).toMatch(/demasiado claro/)
    expect(validarAcento('#FFFFFF')).toMatch(/1\.0:1/)
  })
  it('contraste: negro 21:1, blanco 1:1', () => {
    expect(contrasteConBlanco('#000000')).toBeCloseTo(21, 0)
    expect(contrasteConBlanco('#FFFFFF')).toBeCloseTo(1, 5)
  })
})

describe('acentoSeguro', () => {
  it('nunca deja pasar algo que no sea un hex válido y oscuro (protege la inyección en CSS)', () => {
    expect(acentoSeguro('#24467A')).toBe('#24467A')
    expect(acentoSeguro('#ffffff')).toBe(ACENTO_DEFAULT)
    expect(acentoSeguro('red;}*{display:none')).toBe(ACENTO_DEFAULT)
    expect(acentoSeguro(null)).toBe(ACENTO_DEFAULT)
  })
})
