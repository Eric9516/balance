import { Prisma } from '@prisma/client'
import type { AppError } from './types'
import { getErrorFromCatalog } from './catalog'

export function mapPrismaError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return getErrorFromCatalog('TECH-003', {
          contexto: { target: (error.meta as { target?: string[] })?.target },
        })
      case 'P2003':
        // Foreign key constraint failed
        return getErrorFromCatalog('TECH-004', {
          contexto: { field: (error.meta as { field_name?: string })?.field_name },
        })
      case 'P2025':
        // Record not found
        return getErrorFromCatalog('TECH-002')
      default:
        return getErrorFromCatalog('TECH-001', {
          contexto: { prismaCode: error.code },
        })
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return getErrorFromCatalog('TECH-001', {
      detalle: 'Error de validación en la consulta a la base de datos.',
    })
  }

  return getErrorFromCatalog('TECH-005')
}

export function isPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  )
}
