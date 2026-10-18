// Date utilities for Argentine accounting (DD/MM/YYYY display)

export function formatDate(fecha: Date | string | null | undefined): string {
  if (!fecha) return '-'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

/**
 * Formatea una fecha de cierre como dd/mm/yyyy en UTC.
 * Usa UTC a propósito: las fechas contables se guardan como fecha (medianoche UTC),
 * y formatear en zona local correría el día. Reemplaza las copias locales de los anexos.
 * @param fallback texto a mostrar si la fecha es null/undefined (default '-').
 */
export function formatFecha(d: Date | string | null | undefined, fallback = '-'): string {
  if (!d) return fallback
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/**
 * Fecha larga en castellano y UTC: "31 de diciembre de 2025". Con `mesMayuscula`,
 * "31 de Diciembre de 2025" (uso de la carátula). Fechas contables, como formatFecha.
 */
export function formatFechaLarga(
  d: Date | string | null | undefined,
  opciones: { mesMayuscula?: boolean } = {},
  fallback = '—',
): string {
  if (!d) return fallback
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return fallback
  const dia = String(date.getUTCDate()).padStart(2, '0')
  const mes = MESES_LARGOS[date.getUTCMonth()] ?? ''
  const mesTexto = opciones.mesMayuscula ? mes.charAt(0).toUpperCase() + mes.slice(1) : mes
  return `${dia} de ${mesTexto} de ${date.getUTCFullYear()}`
}

/** Valor para `<input type="date">` (yyyy-mm-dd, UTC). '' si la fecha es null/undefined/inválida. */
export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}
