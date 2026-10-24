/**
 * Nota 1: bases de preparación de los estados contables (y adopción de la RT 54).
 *
 * La arma la app con los datos del ejercicio: adopción de la RT 54, categoría del ente, índices de
 * inflación y, en la primera aplicación, la transición con sus conciliaciones. Los apartados se
 * numeran solos según lo que corresponda. El contador puede reemplazar el texto por el suyo; las
 * conciliaciones de la transición no se escriben: salen de los ajustes cargados. Puro.
 *
 * Modelo: Nota 1 de un balance real de un estudio de Córdoba (2025, primera aplicación).
 */
import type { AdopcionRT54, CategoriaEnteRT54 } from '@prisma/client'
import { multiplicar, restar } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFechaLarga } from '@/lib/utils/dates'
import { CATEGORIA_ENTE_LABELS } from '@/modules/ejercicios/domain/types'
import { getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import type { NotaTransicionGenerada } from '@/modules/transicion-rt54/lib/generarNota'

export type EntradaNotaUno = {
  sociedad: { provincia: string | null }
  ejercicio: {
    fechaInicio: Date
    fechaCierre: Date
    adopcionRT54: AdopcionRT54 | null
    categoriaEnte: CategoriaEnteRT54 | null
    indiceInflacionAnterior: number | null
    indiceInflacionActual: number | null
    notaUnoTexto: string | null
    notaUnoEditadaEn: Date | null
  }
  /** Hay columna del ejercicio anterior (vinculado o cargado a mano). */
  conComparativo: boolean
  /** Nota de transición, si es la primera aplicación y el contador la incluyó. */
  transicion: NotaTransicionGenerada | null
}

export type NotaUno = {
  titulo: string
  /** Lo que se muestra e imprime: el texto del contador o, si no lo escribió, el generado. */
  texto: string
  textoGenerado: string
  editada: boolean
  editadaEn: Date | null
  /** Apartado de la transición (por ejemplo "1.6") con sus conciliaciones, si corresponde. */
  transicion: { apartado: string; nota: NotaTransicionGenerada } | null
  /** Datos que faltan para completar la nota. */
  advertencias: string[]
}

type Apartado = { titulo: string; parrafos: string[] }

const MESES = [
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

const esCordoba = (provincia: string | null) =>
  (provincia ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() === 'cordoba'

/** La transición cambia el patrimonio o el resultado: tiene filas además de la base y el total. */
const conAjustesDeMedicion = (t: NotaTransicionGenerada) =>
  t.conciliacionPN.some((f) => !f.esBase && !f.esTotal) ||
  t.conciliacionResultado.some((f) => !f.esBase && !f.esTotal)

/** "1 de enero de 2025": la fecha larga sin el cero adelante del día, como en los textos legales. */
const fechaTexto = (d: Date) => formatFechaLarga(d).replace(/^0/, '')

export function armarNotaUno(e: EntradaNotaUno): NotaUno {
  const { ejercicio: ej, transicion } = e
  const advertencias: string[] = []
  const apartados: Apartado[] = []
  const cierre = fechaTexto(ej.fechaCierre)
  const primeraAdopcion = ej.adopcionRT54 === 'PRIMERA_ADOPCION'
  const conTransicion =
    primeraAdopcion &&
    transicion !== null &&
    (conAjustesDeMedicion(transicion) || transicion.reclasificaciones.length > 0)
  // El número del apartado de la transición depende de cuántos van antes: se calcula al final.
  const refTransicion = '{{apartado-transicion}}'

  apartados.push({
    titulo: 'Bases de preparación',
    parrafos: [
      `Los presentes estados contables han sido preparados de conformidad con la Resolución Técnica N° 54 (Norma Unificada Argentina de Contabilidad), emitida por la Federación Argentina de Consejos Profesionales de Ciencias Económicas (FACPCE), ${
        esCordoba(e.sociedad.provincia)
          ? 'tal como fue aprobada por el Consejo Profesional de Ciencias Económicas de Córdoba mediante Resolución N° 35/24'
          : 'tal como fue aprobada por el Consejo Profesional de Ciencias Económicas de la jurisdicción'
      }.`,
      `La RT 54 resulta de aplicación para el presente ejercicio económico cerrado el ${cierre} y establece los criterios de reconocimiento, medición, presentación y revelación aplicables a los estados contables.`,
    ],
  })

  if (ej.adopcionRT54 === null) {
    advertencias.push(
      'Falta indicar en "Configurar Nota I" si es la primera aplicación de la RT 54.',
    )
  } else if (primeraAdopcion) {
    const parrafos = [
      `A partir del presente ejercicio, iniciado el ${fechaTexto(ej.fechaInicio)}, la Entidad adoptó por primera vez la Resolución Técnica N° 54, que constituye el nuevo marco normativo profesional aplicable para la preparación de estados contables.`,
    ]
    if (transicion) {
      // Lo que dice la nota de transición, salvo la categoría del ente, que tiene su apartado.
      // Las conciliaciones van en su propio apartado: el texto remite a él.
      const propios = transicion.parrafos
        .slice(1)
        .filter((p) => !p.startsWith('A los efectos de la norma'))
        .map((p) =>
          p.replace('en las conciliaciones siguientes', `en el apartado ${refTransicion}`),
        )
      parrafos.push(...propios)
      if (conTransicion && !propios.some((p) => p.includes(refTransicion))) {
        parrafos.push(`El detalle se expone en el apartado ${refTransicion}.`)
      }
    }
    apartados.push({ titulo: 'Adopción de la RT 54', parrafos })
  } else {
    apartados.push({
      titulo: 'Aplicación de la RT 54',
      parrafos: [
        'La Entidad aplica la Resolución Técnica N° 54 desde ejercicios anteriores. En el presente ejercicio se mantuvieron los mismos criterios de reconocimiento, medición y exposición.',
      ],
    })
  }

  const mesCierre = `${MESES[ej.fechaCierre.getUTCMonth()]} de ${ej.fechaCierre.getUTCFullYear()}`
  const unidad = [
    `Los presentes estados contables han sido preparados en moneda homogénea de cierre (pesos de ${mesCierre}), reconociendo en forma integral los efectos de la inflación de conformidad con lo establecido en la RT 54, en virtud de haberse determinado la existencia de un contexto de alta inflación.`,
  ]
  if (e.conComparativo) {
    unidad.push(
      'Con fines comparativos, las cifras correspondientes al ejercicio anterior han sido expresadas en moneda de cierre del presente ejercicio, a efectos de permitir su adecuada comparación.',
    )
  }
  unidad.push(
    'A efectos de expresar las partidas en moneda de cierre, la Entidad aplicó el proceso de reexpresión integral, que consiste en determinar el momento de origen de las partidas o de su último ajuste, calcular los coeficientes de reexpresión correspondientes y aplicarlos sobre aquellas partidas que no se encontraban expresadas en moneda de cierre. Para el cálculo de los coeficientes se utilizó la serie de índices definida por la FACPCE en la Resolución JG N° 539/2018 y sus modificatorias.',
  )
  if (ej.indiceInflacionAnterior && ej.indiceInflacionActual) {
    // Variación con el coeficiente completo; se muestra con 2 decimales (solo presentación).
    const variacion = multiplicar(restar(getCoeficienteComparativo(ej), 1), 100)
    unidad.push(
      `La variación del índice utilizado para el ajuste de los estados contables correspondiente al ejercicio finalizado el ${cierre} fue del ${formatCurrency(variacion)}%.`,
    )
  } else {
    advertencias.push('Faltan los índices de inflación del ejercicio (Editar ejercicio).')
  }
  unidad.push(
    'El resultado derivado de la exposición a los cambios en el poder adquisitivo de la moneda (RECPAM) se expone dentro de los resultados financieros y por tenencia.',
  )
  apartados.push({ titulo: 'Unidad de medida', parrafos: unidad })

  if (ej.categoriaEnte === null) {
    advertencias.push('Falta la categoría del ente según la RT 54 (Editar ejercicio).')
  } else {
    apartados.push({
      titulo: 'Clasificación de la Entidad',
      parrafos: [
        ej.categoriaEnte === 'RESTANTE'
          ? 'De acuerdo con los parámetros establecidos por la RT 54, la Entidad no califica como entidad pequeña ni mediana y aplica las disposiciones generales de la norma.'
          : `De acuerdo con los parámetros establecidos por la RT 54, la Entidad reviste el carácter de ${CATEGORIA_ENTE_LABELS[ej.categoriaEnte]}. Esta determinación se basa en que los ingresos netos del ejercicio anterior no superan los montos máximos vigentes para dicha categoría.`,
      ],
    })
  }

  apartados.push({
    titulo: 'Empresa en marcha',
    parrafos: [
      'Los presentes estados contables han sido preparados bajo el criterio de empresa en marcha, considerando que no existen hechos o circunstancias que generen dudas significativas sobre la continuidad normal de las actividades de la Entidad en el futuro previsible.',
    ],
  })

  if (conTransicion) {
    apartados.push({
      titulo: conAjustesDeMedicion(transicion)
        ? 'Modificación de saldos al inicio por la transición a la RT 54'
        : 'Reclasificaciones por la transición a la RT 54',
      parrafos: [
        conAjustesDeMedicion(transicion)
          ? 'Los efectos de la transición sobre el patrimonio neto al inicio del ejercicio y sobre el resultado del ejercicio anterior se concilian a continuación.'
          : 'Las reclasificaciones de exposición realizadas por la transición, sin efecto sobre el patrimonio neto ni sobre el resultado, se detallan a continuación.',
      ],
    })
  }

  const apartadoTransicion = conTransicion ? `1.${apartados.length}` : null
  const textoGenerado = apartados
    .map((a, i) => [`1.${i + 1}. ${a.titulo}`, ...a.parrafos].join('\n\n'))
    .join('\n\n')
    .replaceAll(refTransicion, apartadoTransicion ?? '')
  const editada = ej.notaUnoTexto !== null

  return {
    titulo: primeraAdopcion
      ? 'Bases de preparación y adopción de la RT 54'
      : 'Bases de preparación de los estados contables',
    texto: ej.notaUnoTexto ?? textoGenerado,
    textoGenerado,
    editada,
    editadaEn: editada ? ej.notaUnoEditadaEn : null,
    transicion:
      conTransicion && apartadoTransicion
        ? { apartado: apartadoTransicion, nota: transicion }
        : null,
    advertencias,
  }
}
