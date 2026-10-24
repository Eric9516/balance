/**
 * Todo el contenido de la ayuda, en el orden en que se muestra. Única fuente para la página
 * /ayuda, su buscador y el botón (i) de cada paso (ver ../domain/pasos).
 */
import { crearBuscador } from '../domain/buscador'
import { INFO_EJERCICIOS, PASO_INFO, type InfoPasoKey } from '../domain/pasos'
import { CATEGORIAS_AYUDA, type ArticuloAyuda, type InfoPaso } from '../domain/tipos'
import { ANTERIOR, USO } from './anterior'
import { INICIO } from './inicio'
import { MENSAJES_AYUDA } from './mensajes'
import { PASOS } from './pasos'
import { GLOSARIO, PREGUNTAS } from './preguntas'

const porCategoria = (articulos: ArticuloAyuda[]) =>
  (Object.keys(CATEGORIAS_AYUDA) as (keyof typeof CATEGORIAS_AYUDA)[]).flatMap((c) =>
    articulos.filter((a) => a.categoria === c),
  )

export const ARTICULOS: ArticuloAyuda[] = porCategoria([
  ...INICIO,
  ...PASOS,
  ...ANTERIOR,
  ...USO,
  ...PREGUNTAS,
  ...MENSAJES_AYUDA,
  ...GLOSARIO,
])

export const ARTICULO_POR_ID = new Map(ARTICULOS.map((a) => [a.id, a]))

/** El resumen del paso que explica el artículo (el mismo del botón (i)), si explica un paso. */
export function resumenDePaso(a: ArticuloAyuda): InfoPaso | null {
  if (!a.paso) return null
  if (a.paso === 'ejercicios') return INFO_EJERCICIOS
  return PASO_INFO[a.paso as InfoPasoKey] ?? null
}

function textoDelResumen(a: ArticuloAyuda): string[] {
  const r = resumenDePaso(a)
  return r ? [r.purpose, ...r.sources, ...r.formulas, ...(r.notes ?? [])] : []
}

export const buscarEnAyuda = crearBuscador(ARTICULOS, textoDelResumen)
