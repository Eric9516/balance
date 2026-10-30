/**
 * El código del celular (TOTP, RFC 6238): 6 cifras que cambian cada 30 segundos, calculadas con un
 * secreto que comparten la app del celular y BalanceRT. Funciones puras: sin base ni pantalla.
 *
 * Los tiempos se cuentan con BigInt: el paso es la cantidad entera de períodos de 30 segundos
 * desde 1970 (división entera, sin redondear).
 */
import { createHmac } from 'node:crypto'

const PERIODO_MS = 30_000n
const DIGITOS = 6
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** El paso de 30 segundos de un momento. */
export function pasoDe(ahoraMs: number): bigint {
  return BigInt(ahoraMs) / PERIODO_MS
}

/** El código de un paso (HOTP, RFC 4226, con HMAC-SHA1 como las apps de los celulares). */
export function codigoDelPaso(secreto: Uint8Array, paso: bigint): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(paso)
  const hmac = createHmac('sha1', secreto).update(contador).digest()
  const desde = hmac[hmac.length - 1]! & 0x0f
  const valor =
    ((hmac[desde]! & 0x7f) << 24) |
    (hmac[desde + 1]! << 16) |
    (hmac[desde + 2]! << 8) |
    hmac[desde + 3]!
  return String(valor % 10 ** DIGITOS).padStart(DIGITOS, '0')
}

/**
 * El paso del código si coincide con el actual o con el de al lado (por si el reloj del celular
 * está corrido unos segundos); null si no coincide.
 */
export function pasoDelCodigo(secreto: Uint8Array, codigo: string, ahoraMs: number): bigint | null {
  const limpio = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpio)) return null
  const actual = pasoDe(ahoraMs)
  for (const paso of [actual, actual - 1n, actual + 1n]) {
    if (codigoDelPaso(secreto, paso) === limpio) return paso
  }
  return null
}

/** El secreto como lo escriben las apps a mano (base 32, en grupos de 4). */
export function base32(bytes: Uint8Array): string {
  let bits = 0
  let acumulado = 0
  let texto = ''
  for (const b of bytes) {
    acumulado = (acumulado << 8) | b
    bits += 8
    while (bits >= 5) {
      texto += ALFABETO[(acumulado >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) texto += ALFABETO[(acumulado << (5 - bits)) & 31]
  return texto
}

/** La clave escrita a mano (base 32, con o sin espacios) como bytes. */
export function desdeBase32(clave: string): Buffer {
  let bits = 0
  let acumulado = 0
  const bytes: number[] = []
  for (const letra of clave.replace(/\s/g, '').toUpperCase()) {
    const valor = ALFABETO.indexOf(letra)
    if (valor < 0) throw new Error('La clave tiene letras que no son de base 32.')
    acumulado = (acumulado << 5) | valor
    bits += 5
    if (bits >= 8) {
      bytes.push((acumulado >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Lo que lee la app del celular en el QR. */
export function direccionOtpauth(secreto: Uint8Array, cuenta: string): string {
  const etiqueta = encodeURIComponent(`BalanceRT:${cuenta}`)
  return `otpauth://totp/${etiqueta}?secret=${base32(secreto)}&issuer=BalanceRT&algorithm=SHA1&digits=${DIGITOS}&period=30`
}
