import type { AppError, TipoError, SeveridadError } from './types'

interface ErrorDefinition {
  tipo: TipoError
  severidad: SeveridadError
  mensaje: string
  detalle?: string
}

const CATALOG: Record<string, ErrorDefinition> = {
  // Técnicos
  'TECH-001': {
    tipo: 'TECNICO',
    severidad: 'CRITICO',
    mensaje: 'Error de base de datos',
    detalle: 'Ocurrió un error inesperado al acceder a la base de datos.',
  },
  'TECH-002': {
    tipo: 'TECNICO',
    severidad: 'ALTO',
    mensaje: 'Registro no encontrado',
    detalle: 'El recurso solicitado no existe o fue eliminado.',
  },
  'TECH-003': {
    tipo: 'TECNICO',
    severidad: 'ALTO',
    mensaje: 'Conflicto de datos',
    detalle: 'Ya existe un registro con los mismos datos únicos.',
  },
  'TECH-004': {
    tipo: 'TECNICO',
    severidad: 'ALTO',
    mensaje: 'Restricción de eliminación',
    detalle: 'No es posible eliminar el registro porque tiene datos relacionados.',
  },
  'TECH-005': {
    tipo: 'TECNICO',
    severidad: 'CRITICO',
    mensaje: 'Error de servidor',
    detalle: 'Ocurrió un error interno inesperado.',
  },
  // Formulario
  'FORM-001': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'Datos inválidos',
    detalle: 'Uno o más campos tienen valores incorrectos.',
  },
  'FORM-002': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'Campo requerido',
    detalle: 'Este campo es obligatorio.',
  },
  'FORM-003': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'CUIT inválido',
    detalle: 'El CUIT ingresado no es válido.',
  },
  'FORM-004': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'Importe inválido',
    detalle: 'El valor ingresado no es un importe numérico válido.',
  },
  'FORM-005': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'Fecha inválida',
    detalle: 'La fecha ingresada no tiene un formato válido.',
  },
  'FORM-006': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'Período inválido',
    detalle: 'La fecha de cierre debe ser posterior a la fecha de inicio.',
  },
  'FORM-007': {
    tipo: 'FORMULARIO',
    severidad: 'BAJO',
    mensaje: 'CUIT duplicado',
    detalle: 'Ya existe un registro con este CUIT.',
  },
  // Negocio
  'BIZ-001': {
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    mensaje: 'Estado de ejercicio no permite esta operación',
    detalle: 'El ejercicio debe estar en estado BORRADOR o EN_PROCESO.',
  },
  'BIZ-002': {
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    mensaje: 'Ejercicio cerrado',
    detalle: 'No se pueden modificar datos de un ejercicio cerrado.',
  },
  'BIZ-003': {
    tipo: 'NEGOCIO',
    severidad: 'MEDIO',
    mensaje: 'Cuenta duplicada',
    detalle: 'Ya existe una cuenta con este código en el ejercicio.',
  },
  // Autorización
  'AUTH-001': {
    tipo: 'AUTORIZACION',
    severidad: 'ALTO',
    mensaje: 'Sin permisos',
    detalle: 'No tiene permisos para realizar esta operación.',
  },
}

export function getErrorFromCatalog(
  codigo: string,
  overrides?: Partial<Pick<AppError, 'detalle' | 'campo' | 'contexto'>>,
): AppError {
  const def = CATALOG[codigo]

  if (!def) {
    return {
      tipo: 'TECNICO',
      severidad: 'CRITICO',
      codigo: 'TECH-005',
      mensaje: CATALOG['TECH-005'].mensaje,
      detalle: `Código de error desconocido: ${codigo}`,
      ...overrides,
    }
  }

  return {
    tipo: def.tipo,
    severidad: def.severidad,
    codigo,
    mensaje: def.mensaje,
    detalle: overrides?.detalle ?? def.detalle,
    campo: overrides?.campo,
    contexto: overrides?.contexto,
  }
}
