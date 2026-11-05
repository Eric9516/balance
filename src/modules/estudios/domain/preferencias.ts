/**
 * Preferencias de visualización por estudio (identidad + densidad de tablas).
 * Puro: validación del color de acento y valores por defecto.
 */

import type { DensidadTablas, FormatoAnexoBienesUso } from '@prisma/client'

export type { DensidadTablas, FormatoAnexoBienesUso }

export const ACENTO_DEFAULT = '#2F6B55' // verde libro mayor
export const DENSIDAD_DEFAULT: DensidadTablas = 'COMODA'
/** El formato tradicional: valor de origen, amortizaciones y netos en la misma fila. */
export const ANEXO_BIENES_USO_DEFAULT: FormatoAnexoBienesUso = 'UN_CUADRO'

export type PreferenciasEstudio = {
  colorPrimario: string
  densidadTablas: DensidadTablas
  /** Cómo se dibuja el Anexo de Bienes de Uso en el documento (los mismos números). */
  anexoBienesUso: FormatoAnexoBienesUso
}

export const PREFERENCIAS_DEFAULT: PreferenciasEstudio = {
  colorPrimario: ACENTO_DEFAULT,
  densidadTablas: DENSIDAD_DEFAULT,
  anexoBienesUso: ANEXO_BIENES_USO_DEFAULT,
}

export const DENSIDAD_LABELS: Record<DensidadTablas, string> = {
  COMODA: 'Cómoda',
  COMPACTA: 'Compacta',
}

/** Acentos sugeridos: todos con contraste AA sobre blanco. */
export const ACENTOS_SUGERIDOS: { nombre: string; hex: string }[] = [
  { nombre: 'Verde mayor', hex: '#2F6B55' },
  { nombre: 'Azul tinta', hex: '#24467A' },
  { nombre: 'Bordó', hex: '#7A2E3A' },
  { nombre: 'Petróleo', hex: '#1F5F6B' },
  { nombre: 'Grafito', hex: '#3D4250' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

export function esHexValido(v: string): boolean {
  return HEX.test(v)
}

function canal(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa WCAG de un color #RRGGBB. */
export function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Contraste WCAG entre el color y el blanco (texto blanco sobre botón de acento). */
export function contrasteConBlanco(hex: string): number {
  return 1.05 / (luminancia(hex) + 0.05)
}

/** Mínimo para texto normal (WCAG AA). */
export const CONTRASTE_MINIMO = 4.5

/** null si el color sirve como acento; si no, el motivo accionable. */
export function validarAcento(hex: string): string | null {
  if (!esHexValido(hex)) return 'El color tiene que tener el formato #RRGGBB (por ejemplo #2F6B55).'
  const c = contrasteConBlanco(hex)
  if (c < CONTRASTE_MINIMO) {
    return `El color ${hex.toUpperCase()} es demasiado claro: el texto blanco sobre él tendría contraste ${c.toFixed(1)}:1 y el mínimo es ${CONTRASTE_MINIMO}:1. Elegí un tono más oscuro.`
  }
  return null
}

/** Acento seguro para inyectar en CSS: si el valor guardado no es válido, el default. */
export function acentoSeguro(hex: string | null | undefined): string {
  return hex && validarAcento(hex) === null ? hex : ACENTO_DEFAULT
}
