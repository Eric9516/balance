/**
 * Huellas de contraseñas con Argon2id, los parámetros que recomienda OWASP (19 MiB, 2 pasadas,
 * 1 hilo). La base guarda solo la huella: con una copia de la base no se puede entrar.
 */
import { hash, verify } from '@node-rs/argon2'

const PARAMETROS = {
  algorithm: 2, // Algorithm.Argon2id (es un const enum: no se puede importar)
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

/**
 * Si el correo no existe se compara igual contra esta huella, así la respuesta tarda lo mismo y
 * no delata qué correos hay. Es la huella de un texto al azar, no de una contraseña de nadie.
 */
const HUELLA_DE_RELLENO =
  '$argon2id$v=19$m=19456,t=2,p=1$T5aQa3l/NRUWvGPGKuY98Q$70dTb9J5cOk25QKIz3Kxd9VpgTRaoNY/KDCpYu0Vot4'

export function huellaDeContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, PARAMETROS)
}

/** Compara siempre (contra el relleno si no hay huella): tarda lo mismo exista o no la cuenta. */
export async function contrasenaCoincide(
  huella: string | null | undefined,
  contrasena: string,
): Promise<boolean> {
  try {
    const coincide = await verify(huella ?? HUELLA_DE_RELLENO, contrasena)
    return coincide && Boolean(huella)
  } catch {
    return false
  }
}
