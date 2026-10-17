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

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'tipo' in error &&
    'codigo' in error &&
    'mensaje' in error
  )
}
