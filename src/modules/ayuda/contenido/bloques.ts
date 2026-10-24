import type { BloqueAyuda } from '../domain/tipos'

/** Atajos para escribir el contenido de la ayuda. */
export const p = (texto: string): BloqueAyuda => ({ tipo: 'parrafo', texto })
export const pasos = (...items: string[]): BloqueAyuda => ({ tipo: 'pasos', items })
export const lista = (...items: string[]): BloqueAyuda => ({ tipo: 'lista', items })
export const aviso = (texto: string): BloqueAyuda => ({ tipo: 'aviso', texto })
export const defs = (...items: [termino: string, texto: string][]): BloqueAyuda => ({
  tipo: 'definiciones',
  items: items.map(([termino, texto]) => ({ termino, texto })),
})
