/**
 * Reglas del acceso, sin base ni pantalla (decisiones del dueño del producto, 2026-10-30).
 */
import type { AppError } from '@/modules/errores/types'

/** Largo de la contraseña: sin reglas de "una mayúscula y un número"; lo que cuenta es el largo. */
export const CONTRASENA_MINIMO = 12
export const CONTRASENA_MAXIMO = 200

/** El correo se guarda y se compara sin espacios y en minúsculas (lo exige también la base). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function errorDeContrasena(contrasena: string): string | null {
  if (contrasena.length < CONTRASENA_MINIMO)
    return `La contraseña tiene que tener al menos ${CONTRASENA_MINIMO} caracteres.`
  if (contrasena.length > CONTRASENA_MAXIMO)
    return `La contraseña puede tener hasta ${CONTRASENA_MAXIMO} caracteres.`
  return null
}

/** Mismo mensaje si el correo no existe o si la contraseña no coincide: no delata qué correos hay. */
export const DATOS_INCORRECTOS: AppError = {
  tipo: 'AUTORIZACION',
  severidad: 'MEDIO',
  codigo: 'AUTH-002',
  mensaje: 'Correo o contraseña incorrectos.',
}

export const DEMASIADOS_INTENTOS: AppError = {
  tipo: 'AUTORIZACION',
  severidad: 'MEDIO',
  codigo: 'AUTH-003',
  mensaje: 'Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.',
}

/** Solo se dice después de una contraseña correcta. */
export const CUENTA_DESACTIVADA: AppError = {
  tipo: 'AUTORIZACION',
  severidad: 'MEDIO',
  codigo: 'AUTH-004',
  mensaje: 'Tu cuenta está desactivada. Pedile al dueño del estudio que la active.',
}
