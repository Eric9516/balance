import { describe, it, expect, vi } from 'vitest'
import {
  base32,
  codigoDelPaso,
  desdeBase32,
  direccionOtpauth,
  pasoDe,
  pasoDelCodigo,
} from './codigo'

vi.mock('@/lib/env', () => ({ env: { CLAVE_CODIGOS: Buffer.alloc(32, 7).toString('base64') } }))

// Valores de prueba de la norma (RFC 6238, apéndice B, SHA-1): las 6 últimas cifras
const SECRETO = Buffer.from('12345678901234567890')
const NORMA: [number, string][] = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
]

describe('Código del celular', () => {
  it('coincide con los valores de la norma', () => {
    for (const [segundos, codigo] of NORMA)
      expect(codigoDelPaso(SECRETO, pasoDe(segundos * 1000))).toBe(codigo)
  })

  it('acepta el código actual y el de al lado (reloj corrido), y nada más', () => {
    const ahora = 1_800_000_000_000
    const paso = pasoDe(ahora)
    expect(pasoDelCodigo(SECRETO, codigoDelPaso(SECRETO, paso), ahora)).toBe(paso)
    expect(pasoDelCodigo(SECRETO, codigoDelPaso(SECRETO, paso - 1n), ahora)).toBe(paso - 1n)
    expect(pasoDelCodigo(SECRETO, codigoDelPaso(SECRETO, paso + 1n), ahora)).toBe(paso + 1n)
    expect(pasoDelCodigo(SECRETO, codigoDelPaso(SECRETO, paso - 2n), ahora)).toBeNull()
    expect(pasoDelCodigo(SECRETO, '12 34 5', ahora)).toBeNull()
    expect(pasoDelCodigo(SECRETO, 'abcdef', ahora)).toBeNull()
  })

  it('acepta el código con espacios', () => {
    const ahora = 1_800_000_000_000
    const c = codigoDelPaso(SECRETO, pasoDe(ahora))
    expect(pasoDelCodigo(SECRETO, `${c.slice(0, 3)} ${c.slice(3)}`, ahora)).toBe(pasoDe(ahora))
  })

  it('escribe el secreto en base 32 como las apps', () => {
    expect(base32(Buffer.from('48656c6c6f21deadbeef', 'hex'))).toBe('JBSWY3DPEHPK3PXP')
    expect(desdeBase32('jbsw y3dp ehpk 3pxp').toString('hex')).toBe('48656c6c6f21deadbeef')
    expect(() => desdeBase32('ABC1')).toThrow()
    expect(direccionOtpauth(Buffer.from('48656c6c6f21deadbeef', 'hex'), 'ana@estudio.com')).toBe(
      'otpauth://totp/BalanceRT%3Aana%40estudio.com?secret=JBSWY3DPEHPK3PXP&issuer=BalanceRT&algorithm=SHA1&digits=6&period=30',
    )
  })

  it('el secreto se guarda cifrado y se recupera igual', async () => {
    const { cifrar, descifrar } = await import('../infra/cifrado')
    const secreto = Buffer.from('un secreto de veinte')
    const guardado = cifrar(secreto)
    expect(guardado.includes(secreto)).toBe(false)
    expect(descifrar(guardado).equals(secreto)).toBe(true)
    guardado[guardado.length - 1]! ^= 1
    expect(() => descifrar(guardado)).toThrow()
  })
})
