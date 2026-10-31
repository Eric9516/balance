/**
 * Qué puede hacer cada rol (decisión del dueño del producto, 2026-10-30; docs/decisiones/0013).
 * La base lo hace cumplir también (migración 20261030235000_permisos_por_rol): esto es para que la
 * app lo explique antes de intentarlo y muestre solo lo que cada uno puede usar.
 */
import type { RolUsuario } from '@prisma/client'
import type { AppError } from '@/modules/errores/types'

export type Permiso =
  'gestionar_usuarios' | 'configurar_estudio' | 'configurar_criterios' | 'confirmar_y_cerrar'

const PERMISOS: Record<RolUsuario, readonly Permiso[]> = {
  DUENO: ['gestionar_usuarios', 'configurar_estudio', 'configurar_criterios', 'confirmar_y_cerrar'],
  CONTADOR: ['configurar_criterios', 'confirmar_y_cerrar'],
  ASISTENTE: [],
}

export const NOMBRE_DEL_ROL: Record<RolUsuario, string> = {
  DUENO: 'Dueño',
  CONTADOR: 'Contador',
  ASISTENTE: 'Asistente',
}

/** Lo que hace cada rol, para mostrarlo al elegirlo. */
export const QUE_HACE_EL_ROL: Record<RolUsuario, string> = {
  DUENO: 'Todo: también maneja a la gente y los datos del estudio.',
  CONTADOR: 'Arma, confirma y cierra los balances; configura auditores y clasificaciones.',
  ASISTENTE: 'Carga datos: importa, clasifica y completa anexos y notas. No confirma ni cierra.',
}

const QUE_NO_PUEDE: Record<Permiso, string> = {
  gestionar_usuarios: 'manejar a la gente del estudio: lo hace el dueño',
  configurar_estudio: 'cambiar los datos ni la configuración del estudio: lo hace el dueño',
  configurar_criterios:
    'cambiar auditores, clasificaciones ni secciones: lo hace el dueño o un contador',
  confirmar_y_cerrar:
    'confirmar, autorizar, pasar a revisión, cerrar ni eliminar un ejercicio: lo hace el dueño o un contador',
}

export function puede(rol: RolUsuario, permiso: Permiso): boolean {
  return PERMISOS[rol].includes(permiso)
}

export function sinPermiso(rol: RolUsuario, permiso: Permiso): AppError {
  return {
    tipo: 'AUTORIZACION',
    severidad: 'MEDIO',
    codigo: 'AUTH-007',
    mensaje: `Como ${NOMBRE_DEL_ROL[rol].toLowerCase()}, no podés ${QUE_NO_PUEDE[permiso]}.`,
  }
}
