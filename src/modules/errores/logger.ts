import type { AppError } from './types'

// Simple console-based logger. Never logs PII or accounting amounts.
// Replace with pino in production when structured logging infra is ready.
const isDev = process.env.NODE_ENV === 'development'

function safeContext(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return undefined
  // Strip any keys that may contain sensitive data
  const { password, token, secret, importe, saldo, ...safe } = ctx as Record<string, unknown>
  void password; void token; void secret; void importe; void saldo
  return safe
}

export const logger = {
  error(error: AppError, ctx?: Record<string, unknown>, stack?: string): void {
    const payload = {
      codigo: error.codigo,
      tipo: error.tipo,
      severidad: error.severidad,
      mensaje: error.mensaje,
      ...(isDev ? { contexto: safeContext(ctx) } : {}),
      ...(isDev && stack ? { stack } : {}),
    }
    console.error('[BalanceRT Error]', payload)
  },

  warn(mensaje: string, ctx?: Record<string, unknown>): void {
    console.warn('[BalanceRT Warn]', mensaje, isDev ? safeContext(ctx) : undefined)
  },

  info(mensaje: string, ctx?: Record<string, unknown>): void {
    if (isDev) {
      console.info('[BalanceRT Info]', mensaje, safeContext(ctx))
    }
  },
}
