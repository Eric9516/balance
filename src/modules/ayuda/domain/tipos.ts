/**
 * Ayuda de BalanceRT: una sola fuente de contenido para la página de ayuda, el buscador y el
 * botón de información de cada paso. Puro: sin base ni interfaz.
 */

/** Resumen de un paso o pantalla: el contenido del botón (i) y la cabecera de su artículo. */
export type InfoPaso = {
  title: string
  /** Para qué sirve. */
  purpose: string
  /** De dónde salen los datos. */
  sources: string[]
  /** Cálculos y controles. */
  formulas: string[]
  /** Tener en cuenta. */
  notes?: string[]
}

export type BloqueAyuda =
  | { tipo: 'parrafo'; texto: string }
  /** Pasos a seguir, en orden. */
  | { tipo: 'pasos'; items: string[] }
  | { tipo: 'lista'; items: string[] }
  /** Algo que conviene no pasar por alto. */
  | { tipo: 'aviso'; texto: string }
  /** Término y su explicación. */
  | { tipo: 'definiciones'; items: { termino: string; texto: string }[] }

export const CATEGORIAS_AYUDA = {
  inicio: 'Primeros pasos',
  pasos: 'Paso a paso del balance',
  anterior: 'Ejercicio anterior y comparativo',
  uso: 'Tablas, importes y redondeo',
  configuracion: 'Configuración',
  mensajes: 'Mensajes de error y avisos',
  preguntas: 'Preguntas frecuentes',
  glosario: 'Glosario',
} as const

export type CategoriaAyuda = keyof typeof CATEGORIAS_AYUDA

export type ArticuloAyuda = {
  /** Identificador estable: es el ancla de la página (/ayuda#id). */
  id: string
  titulo: string
  categoria: CategoriaAyuda
  /** Una o dos oraciones: qué resuelve el artículo. Se muestra en los resultados del buscador. */
  resumen: string
  /** Cómo lo buscaría alguien: sinónimos, siglas, frases y preguntas. */
  claves: string[]
  bloques: BloqueAyuda[]
  /** Paso del ejercicio que explica: su resumen (botón i) se muestra al comienzo. */
  paso?: string
  /** Códigos de error o aviso que explica (NEG-004, AUT-012…). */
  codigos?: string[]
  /** Otros artículos para seguir leyendo. */
  relacionados?: string[]
}
