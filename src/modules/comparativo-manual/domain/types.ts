/**
 * Módulos del ejercicio anterior cargado a mano. 'GASTOS' guarda el total anterior por sección del
 * Anexo III (va al Estado de Resultados); 'GASTOS_FILA', el importe anterior de cada fila de gasto
 * (columna "Total ejercicio anterior" del anexo).
 */
export type ModuloComparativo = 'SSP' | 'EERR' | 'GASTOS' | 'GASTOS_FILA' | 'BDU' | 'COSTO_VENTAS'

export type ComparativoManualDTO = {
  id: string
  ejercicioId: string
  modulo: ModuloComparativo
  clave: string // seccionSSP key, rubroBaseId, seccionEERR key, o nombre de categoría BDU
  label: string // nombre para mostrar
  valor: number
  esHuerfano: boolean // true = no existe en el ejercicio actual
  orden: number
}

// ─── Claves de filas huérfanas (existían en el período anterior, ya no hoy) ────
// SSP: la clave codifica la sección para que apply.ts la ubique en su bloque.
// Formato: "sec:{seccionKey}:{timestamp}". Sin sección → "huerfano:{timestamp}".
export function buildClaveHuerfano(seccion?: string | null): string {
  return seccion ? `sec:${seccion}:${Date.now()}` : `huerfano:${Date.now()}`
}

export function parsSeccionDeClaveHuerfano(clave: string): string | null {
  if (!clave.startsWith('sec:')) return null
  const parts = clave.split(':')
  return parts[1] ?? null
}
