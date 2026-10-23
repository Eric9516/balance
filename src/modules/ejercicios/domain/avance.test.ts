import { describe, it, expect } from 'vitest'
import { faltaConfirmarParaAvanzar } from './avance'

describe('faltaConfirmarParaAvanzar', () => {
  it('con todo confirmado no falta nada', () => {
    expect(faltaConfirmarParaAvanzar({ estadosConfirmado: true, pnConfirmado: true })).toEqual([])
  })

  it('nombra cada confirmación que falta', () => {
    expect(faltaConfirmarParaAvanzar({ estadosConfirmado: true, pnConfirmado: false })).toEqual([
      'el E.E.P.N.',
    ])
    expect(faltaConfirmarParaAvanzar({ estadosConfirmado: false, pnConfirmado: false })).toEqual([
      'los estados contables',
      'el E.E.P.N.',
    ])
  })
})
