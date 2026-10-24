/**
 * Artículo "Configuración de las notas": se arma con las mismas explicaciones que muestra el
 * símbolo (?) de cada opción (../domain/opciones), así la pantalla y la ayuda nunca difieren.
 */
import {
  ARTICULO_CONFIG_NOTAS,
  CONFIGURACION_NOTAS,
  type ExplicacionOpcion,
  type PreguntaConfig,
} from '../domain/opciones'
import type { ArticuloAyuda, BloqueAyuda } from '../domain/tipos'
import { defs, p } from './bloques'

function explicar(o: ExplicacionOpcion): [string, string] {
  const partes = [o.queHace, `Qué cambia: ${o.impacta.join(' ')}`]
  if (o.noCambia?.length) partes.push(`Qué no cambia: ${o.noCambia.join(' ')}`)
  return [o.etiqueta, partes.join(' ')]
}

const pregunta = (q: PreguntaConfig<string>): BloqueAyuda[] => [
  p(`${q.titulo}. ${q.explicacion}`),
  defs(...Object.values(q.opciones).map(explicar)),
]

const { preguntas, campoNota, transicion, camposTransicion } = CONFIGURACION_NOTAS

export const CONFIGURAR_NOTAS: ArticuloAyuda = {
  id: ARTICULO_CONFIG_NOTAS,
  titulo: 'Configuración de las notas: qué hace cada opción',
  categoria: 'pasos',
  resumen:
    'Qué cambia cada respuesta de "Configurar Nota I" (adopción de la RT 54, criterio de bienes de cambio y hechos posteriores), el criterio de medición de cada nota y las partidas de transición.',
  claves: [
    'configurar nota i',
    'configuracion de las notas',
    'volver a configurar',
    'que hace cada opcion',
    'que impacta',
    'primera adopcion',
    'aplicacion continuada',
    'costo de reposicion',
    'costo de adquisicion',
    'ultima compra',
    'metodo de medicion',
    'hechos posteriores',
    'criterio de medicion',
    'ajuste de medicion',
    'reclasificacion',
    'componente del patrimonio neto',
    'efecto resultado anterior',
  ],
  bloques: [
    p(
      'Cada opción tiene un símbolo (?) en la pantalla con esta misma explicación. Después de confirmar "Configurar Nota I", la app pide regenerar las notas para que los cambios se vean.',
    ),
    ...preguntas.flatMap(pregunta),
    p(`${campoNota.etiqueta} de cada nota. ${campoNota.resumen}`),
    defs(explicar(campoNota)),
    ...pregunta(transicion),
    p('Columnas de las partidas de transición.'),
    defs(...camposTransicion.map(explicar)),
  ],
  relacionados: ['paso-notas', 'nota-uno', 'nota-transicion', 'aut-040', 'neg-007'],
}
