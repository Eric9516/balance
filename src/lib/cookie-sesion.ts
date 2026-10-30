/** Nombre de la cookie de la sesión. Aparte, para que proxy.ts no cargue nada más. */
export const COOKIE_SESION = 'balancert_sesion'

/**
 * Adónde volver después de entrar: solo una dirección de esta misma app ("/algo"), nunca otro
 * sitio ("//otro.com", "https://...").
 */
export function destinoSeguro(volver: unknown): string {
  if (typeof volver !== 'string' || volver.length > 500) return '/'
  if (!volver.startsWith('/') || volver.startsWith('//') || volver.startsWith('/\\')) return '/'
  if (volver.startsWith('/entrar')) return '/'
  return volver
}
