/** Texto libre de una nota (por ejemplo, la Nota 1): párrafos y títulos de apartado. Puro. */

/** Párrafos de un texto de nota: separados por una línea en blanco. Los "1.2. Título" son títulos. */
export function bloquesTextoNota(texto: string): { titulo: boolean; texto: string }[] {
  return texto
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => ({
      titulo: /^\d+(\.\d+)*\.\s+\S/.test(b) && b.length <= 120 && !b.includes('\n'),
      texto: b,
    }))
}
