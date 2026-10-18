/**
 * Anexos que tienen pantalla propia en la app, en el orden fijo de exposición.
 * La numeración (I, II, III) no se corre aunque falte alguno. Un anexo aceptado
 * que no esté acá existe como decisión pero todavía no tiene vista ni hoja impresa.
 */

export type AnexoConVista = {
  clave: 'ANEXO_BIENES_USO' | 'ANEXO_COSTO_VENTAS' | 'ANEXO_GASTOS'
  numero: 'I' | 'II' | 'III'
  slug: 'bienes-de-uso' | 'costo-ventas' | 'gastos'
  /** Etiqueta corta de la pestaña. */
  label: string
  /** Título completo del anexo (pantalla y documento). */
  titulo: string
}

export const ANEXOS_CON_VISTA: readonly AnexoConVista[] = [
  {
    clave: 'ANEXO_BIENES_USO',
    numero: 'I',
    slug: 'bienes-de-uso',
    label: 'Bs. de Uso',
    titulo: 'Anexo I — Bienes de uso',
  },
  {
    clave: 'ANEXO_COSTO_VENTAS',
    numero: 'II',
    slug: 'costo-ventas',
    label: 'Cto. Ventas',
    titulo: 'Anexo II — Costo de ventas',
  },
  {
    clave: 'ANEXO_GASTOS',
    numero: 'III',
    slug: 'gastos',
    label: 'Gastos',
    titulo: 'Anexo III — Gastos',
  },
]

export function anexoConVista(clave: string): AnexoConVista | undefined {
  return ANEXOS_CON_VISTA.find((a) => a.clave === clave)
}
