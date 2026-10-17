// Un rubro/sección es "huérfano" (solo del período anterior) si su id es una clave manual.
export function esRubroHuerfano(id: string): boolean {
  return id.startsWith('sec:') || id.startsWith('huerfano:')
}
