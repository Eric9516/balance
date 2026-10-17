export type TipoError =
  | 'TECNICO'
  | 'VALIDACION'
  | 'FORMULARIO'
  | 'NEGOCIO'
  | 'AUTORIZACION'

export type SeveridadError = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'

export interface AppError {
  tipo: TipoError
  severidad: SeveridadError
  codigo: string
  mensaje: string
  detalle?: string
  campo?: string
  contexto?: Record<string, unknown>
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function actionError(error: AppError): ActionResult<never> {
  return { ok: false, error }
}
