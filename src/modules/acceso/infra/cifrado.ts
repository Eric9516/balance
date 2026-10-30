/**
 * Cifra el secreto del código del celular antes de guardarlo (AES-256-GCM). La clave está en la
 * variable CLAVE_CODIGOS, fuera de la base: con una copia de la base sola no se pueden generar
 * códigos.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

function clave(): Buffer {
  const k = Buffer.from(env.CLAVE_CODIGOS ?? '', 'base64')
  if (k.length !== 32)
    throw new Error('Falta CLAVE_CODIGOS (32 bytes en base64) para el código del celular.')
  return k
}

/** Vector al azar (12 bytes) + etiqueta (16 bytes) + texto cifrado. */
export function cifrar(texto: Uint8Array): Buffer {
  const iv = randomBytes(12)
  const cifrador = createCipheriv('aes-256-gcm', clave(), iv)
  const cifrado = Buffer.concat([cifrador.update(texto), cifrador.final()])
  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado])
}

export function descifrar(guardado: Uint8Array): Buffer {
  const datos = Buffer.from(guardado)
  const descifrador = createDecipheriv('aes-256-gcm', clave(), datos.subarray(0, 12))
  descifrador.setAuthTag(datos.subarray(12, 28))
  return Buffer.concat([descifrador.update(datos.subarray(28)), descifrador.final()])
}
