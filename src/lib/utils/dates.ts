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
