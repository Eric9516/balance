// Una sección comparativa es "huérfana" si solo existió en el período anterior.
export function esSeccionHuerfana(key: string): boolean {
  return key.startsWith('huerfano:') || key.startsWith('sec:')
}
