import { unstable_rethrow } from 'next/navigation'
import type { AppError } from './types'
import { getErrorFromCatalog } from './catalog'
import { isPrismaError, mapPrismaError } from './prisma-mapper'
import { logger } from './logger'

interface ErrorContext {
  modulo?: string
  operacion?: string
  [key: string]: unknown
}

export function errorHandler(error: unknown, ctx?: ErrorContext): AppError {
  // Las señales de Next (ir a la entrada si la sesión venció, página no encontrada) siguen su camino
  unstable_rethrow(error)
  const regla = reglaDeLaBase(error)
  if (regla) {
    logger.error(regla, ctx)
    return regla
  }

  if (isPrismaError(error)) {
    const appError = mapPrismaError(error)
    logger.error(appError, ctx)
    return appError
  }

  if (isAppError(error)) {
    logger.error(error, ctx)
    return error
  }

  if (error instanceof Error) {
    const appError = getErrorFromCatalog('TECH-005', {
      detalle: error.message,
      contexto: ctx,
    })
    logger.error(appError, ctx, error.stack)
    return appError
  }

  const appError = getErrorFromCatalog('TECH-005', { contexto: ctx })
  logger.error(appError, ctx)
  return appError
}

/**
 * Las reglas que la base hace cumplir con un mensaje para la persona (permisos por rol, siempre un
 * dueño, datos de otro estudio): se muestra ese mensaje en vez de un error técnico. Los rechazos
 * propios de PostgreSQL (en inglés: "violates", "permission denied") siguen siendo técnicos.
 */
function reglaDeLaBase(error: unknown): AppError | null {
  const causa = (error as { cause?: { originalCode?: unknown; originalMessage?: unknown } })?.cause
  const codigo = causa?.originalCode
  const mensaje = typeof causa?.originalMessage === 'string' ? causa.originalMessage : ''
  if (!mensaje || /violates|permission denied|does not exist/i.test(mensaje)) return null
  if (codigo === '42501')
    return { tipo: 'AUTORIZACION', severidad: 'MEDIO', codigo: 'AUTH-007', mensaje }
  if (codigo === '23514') return { tipo: 'NEGOCIO', severidad: 'MEDIO', codigo: 'NEG-063', mensaje }
  return null
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'tipo' in error &&
    'codigo' in error &&
    'mensaje' in error
  )
}
