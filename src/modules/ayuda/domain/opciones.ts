/**
 * Qué hace cada opción de configuración de las notas y qué cambia en el balance: lo que muestra su
 * símbolo (?) en la pantalla y el artículo "Configuración de las notas" de la ayuda. Única fuente:
 * las pantallas toman de acá la etiqueta y la descripción corta de cada opción.
 * ayuda.test.ts exige que cada opción tenga su explicación.
 */
import type { AdopcionRT54, CriteriosBienesCambio, TipoAjusteTransicion } from '@prisma/client'
import {
  CRITERIO_LABEL,
  TITULO_HECHOS,
  type RespuestaHechos,
} from '@/modules/notas/domain/regeneracion'
import { TIPO_AJUSTE_LABELS } from '@/modules/transicion-rt54/domain/types'

/** Artículo de la ayuda que reúne todas estas explicaciones. */
export const ARTICULO_CONFIG_NOTAS = 'configurar-notas'

export type ExplicacionOpcion = {
  /** Cómo se llama la opción o el campo en la pantalla. */
  etiqueta: string
  /** Una oración: se ve debajo de la opción, sin abrir la ayuda. */
  resumen: string
  /** Qué hace, en detalle. */
  queHace: string
  /** Qué cambia en las notas, los estados o los controles. */
  impacta: string[]
  /** Lo que no cambia, para que nadie espere un recálculo que no ocurre. */
  noCambia?: string[]
}

export type PreguntaConfig<K extends string> = {
  titulo: string
  /** Para qué se pregunta y a qué afecta la respuesta. */
  explicacion: string
  opciones: Record<K, ExplicacionOpcion>
}

const titulo = (t: string) => `"${t.charAt(0)}${t.slice(1).toLowerCase()}"`

// ─── Configurar Nota I ────────────────────────────────────────────────────────

export const AYUDA_ADOPCION_RT54: PreguntaConfig<AdopcionRT54> = {
  titulo: 'Adopción de la RT 54',
  explicacion:
    'Si este es el primer ejercicio que la sociedad presenta con la RT 54. Cambia el texto de la Nota 1 y habilita la nota de primera aplicación con sus partidas de transición.',
  opciones: {
    PRIMERA_ADOPCION: {
      etiqueta: 'Primera adopción',
      resumen: 'Es el primer ejercicio que la sociedad presenta con la RT 54.',
      queHace:
        'Marca el ejercicio como el de la primera aplicación de la RT 54: la Nota 1 lo dice y la app pide la nota de primera aplicación, con las partidas de transición.',
      impacta: [
        'Nota 1: se titula "Bases de preparación y adopción de la RT 54" y suma el apartado "Adopción de la RT 54". Si cargás partidas de transición, agrega un apartado con su detalle.',
        'Anexos y notas: sugiere la "Nota de primera aplicación de la RT 54". La norma la exige: si no la incluís, la app avisa.',
        'Notas: con esa nota incluida aparece la tarjeta de partidas de transición (ajustes de medición y reclasificaciones).',
        'Estado de evolución del patrimonio neto: la fila "Modificación de saldos al inicio" se completa sola con la suma de los ajustes de medición, columna por columna, salvo que la hayas cambiado a mano.',
        'Autorización: controla que esa fila coincida con los ajustes de medición (aviso AUT-040).',
      ],
      noCambia: ['Los importes del ejercicio actual: salen del balance.'],
    },
    APLICACION_CONTINUADA: {
      etiqueta: 'Aplicación continuada',
      resumen: 'La sociedad ya aplicaba la RT 54 en ejercicios anteriores.',
      queHace: 'Arma la Nota 1 sin transición: no hay nota de primera aplicación.',
      impacta: [
        'Nota 1: se titula "Bases de preparación de los estados contables" y el apartado "Aplicación de la RT 54" dice que se mantuvieron los mismos criterios.',
        'No aparecen la nota de primera aplicación ni sus partidas. Si ya habías cargado partidas, se guardan pero no se usan ni se imprimen.',
        'La fila "Modificación de saldos al inicio" del E.E.P.N. se carga a mano, si corresponde.',
      ],
      noCambia: ['Los importes de los estados.'],
    },
  },
}

const criterio = (
  k: CriteriosBienesCambio,
  etiqueta: string,
  resumen: string,
): ExplicacionOpcion => ({
  etiqueta,
  resumen,
  queHace: `La nota de bienes de cambio dice "Criterio de medición: ${CRITERIO_LABEL[k]}". Es el texto que informa cómo mediste las existencias.`,
  impacta: [
    'Si la nota de bienes de cambio ya existe, su criterio se reemplaza al confirmar, aunque lo hubieras editado a mano.',
    'Las notas que se generen después toman este criterio.',
  ],
  noCambia: [
    'Los importes: la app no recalcula las existencias ni el costo de ventas. El saldo sale del balance, medido como lo hayas medido.',
    'El Anexo II y las demás notas.',
  ],
})

export const AYUDA_CRITERIO_BIENES_CAMBIO: PreguntaConfig<CriteriosBienesCambio> = {
  titulo: 'Criterio de medición de los bienes de cambio',
  explicacion:
    'Cómo se midieron las existencias al cierre. Solo cambia el texto de la nota de bienes de cambio: no recalcula ningún importe.',
  opciones: {
    COSTO_ADQUISICION: criterio(
      'COSTO_ADQUISICION',
      'Costo de adquisición',
      'Costo de compra o de producción, reexpresado en moneda de cierre.',
    ),
    ULTIMA_COMPRA: criterio(
      'ULTIMA_COMPRA',
      'Costo de la última compra',
      'Precio de la última compra anterior al cierre.',
    ),
    COSTO_REPOSICION: criterio(
      'COSTO_REPOSICION',
      'Costo de reposición',
      'Lo que costaría comprar bienes iguales a los precios vigentes al cierre.',
    ),
  },
}

const sinImportes = 'Los importes de los estados.'

export const AYUDA_HECHOS_POSTERIORES: PreguntaConfig<RespuestaHechos> = {
  titulo: 'Hechos posteriores al cierre',
  explicacion:
    'Si entre el cierre y la emisión de los estados pasó algo que haya que informar. Define si va la nota de hechos posteriores y con qué texto.',
  opciones: {
    NO_SIN_NOTA: {
      etiqueta: 'No, sin nota',
      resumen: 'No hay hechos posteriores y el balance no lleva nota sobre el tema.',
      queHace: `No se incluye la nota ${titulo(TITULO_HECHOS)}.`,
      impacta: ['Si esa nota ya existía, se borra y las demás notas se renumeran.'],
      noCambia: [sinImportes],
    },
    NO_CON_NOTA: {
      etiqueta: 'No, con una nota que lo aclara',
      resumen: 'No hay hechos posteriores, pero el balance lleva una nota que lo dice.',
      queHace: `Agrega la nota ${titulo(TITULO_HECHOS)} con el texto estándar ("No existen acontecimientos u operaciones ocurridos entre la fecha de cierre…"). Podés cambiar el texto antes de confirmar.`,
      impacta: [
        'La nota va al final y se numera después de las demás.',
        'Si la nota ya existía, su texto se reemplaza por el de acá.',
      ],
      noCambia: [sinImportes],
    },
    SI: {
      etiqueta: 'Sí',
      resumen: 'Hay hechos posteriores: se informan en una nota con el texto que escribas.',
      queHace: `Agrega la nota ${titulo(TITULO_HECHOS)} con el texto que escribas. El texto es obligatorio: contá qué pasó y, si se puede estimar, su efecto.`,
      impacta: [
        'La nota va al final y se numera después de las demás.',
        'Si la nota ya existía, su texto se reemplaza por el que escribas acá.',
      ],
      noCambia: [
        'Los importes: un hecho posterior que obligue a corregir saldos se corrige en el balance, no en esta nota.',
      ],
    },
  },
}

// ─── Campos de cada nota ──────────────────────────────────────────────────────

export const AYUDA_CRITERIO_NOTA: ExplicacionOpcion = {
  etiqueta: 'Criterio de medición',
  resumen: 'El texto que dice cómo se midió el rubro de la nota.',
  queHace:
    'Es el texto que va debajo del título de la nota. Lo propone la app: en bienes de cambio, el criterio de "Configurar Nota I"; en los demás rubros, "valor nominal". Podés editarlo.',
  impacta: [
    'Se imprime en la nota, debajo del título.',
    'Regenerar las notas no pisa lo que escribiste, salvo que marques "Volver al texto estándar".',
    'Volver a configurar el criterio de bienes de cambio en "Configurar Nota I" lo reemplaza en esa nota.',
  ],
  noCambia: ['Los importes: es solo texto.'],
}

// ─── Partidas de transición (primera aplicación de la RT 54) ──────────────────

export const AYUDA_TIPO_AJUSTE: PreguntaConfig<TipoAjusteTransicion> = {
  titulo: 'Tipo de partida de transición',
  explicacion:
    'Si la partida cambia el patrimonio neto al inicio (ajuste de medición) o solo cambia dónde se expone (reclasificación).',
  opciones: {
    AJUSTE_MEDICION: {
      etiqueta: TIPO_AJUSTE_LABELS.AJUSTE_MEDICION,
      resumen: 'Cambia cómo se mide una partida y, con eso, el patrimonio neto al inicio.',
      queHace:
        'Registra el efecto de medir una partida con la RT 54 en lugar de la norma anterior.',
      impacta: [
        'Su "Efecto PN al inicio" se suma a la fila "Modificación de saldos al inicio" del E.E.P.N., en la columna del componente elegido.',
        'Va a la conciliación del patrimonio neto de la nota de primera aplicación.',
        'Su "Efecto resultado anterior" va a la conciliación del resultado del ejercicio anterior.',
        'Autorización: la suma de los ajustes de medición tiene que coincidir con esa fila del E.E.P.N. (aviso AUT-040).',
      ],
    },
    RECLASIFICACION: {
      etiqueta: TIPO_AJUSTE_LABELS.RECLASIFICACION,
      resumen:
        'La partida cambia de rubro por la forma de exponer de la RT 54, sin cambiar su importe.',
      queHace:
        'Informa que una partida pasó de un rubro a otro. Pide el rubro de origen, el de destino y el importe reclasificado.',
      impacta: ['Se detalla en la nota de primera aplicación y en la Nota 1.'],
      noCambia: [
        'El patrimonio neto ni la fila "Modificación de saldos al inicio".',
        'Los importes de los estados: es informativa, no mueve saldos de un rubro a otro. Los saldos salen de la clasificación de las cuentas.',
      ],
    },
  },
}

export const AYUDA_CAMPOS_TRANSICION = {
  componentePN: {
    etiqueta: 'Componente del patrimonio neto',
    resumen: 'La columna del patrimonio neto a la que va el ajuste de medición.',
    queHace:
      'Indica a qué componente del patrimonio neto corresponde el ajuste: capital, ajuste del capital, aportes, reservas o resultados no asignados.',
    impacta: [
      'Define en qué columna de la fila "Modificación de saldos al inicio" del E.E.P.N. se suma el ajuste.',
      'Se muestra entre paréntesis en la conciliación del patrimonio neto.',
    ],
  },
  efectoPN: {
    etiqueta: 'Efecto PN al inicio',
    resumen: 'Cuánto cambia el patrimonio neto al inicio por el ajuste.',
    queHace:
      'En un ajuste de medición, el efecto sobre el patrimonio neto al inicio del ejercicio (positivo si lo aumenta, negativo si lo disminuye). En una reclasificación, el importe que cambia de rubro.',
    impacta: [
      'Ajustes de medición: se suman a la fila "Modificación de saldos al inicio" del E.E.P.N. y a la conciliación del patrimonio neto.',
      'Reclasificaciones: solo se informan en la nota.',
    ],
  },
  efectoResultadoAnterior: {
    etiqueta: 'Efecto resultado anterior',
    resumen: 'Cuánto cambia el resultado del ejercicio anterior por el ajuste.',
    queHace:
      'El efecto del ajuste de medición sobre el resultado del ejercicio anterior, para conciliarlo con el que se informó con la norma anterior.',
    impacta: [
      'Va a la conciliación del resultado del ejercicio anterior de la nota de primera aplicación.',
    ],
    noCambia: ['El E.E.P.N. ni el estado de resultados: es informativo.'],
  },
} satisfies Record<string, ExplicacionOpcion>

/** Todas las preguntas y campos, en el orden del artículo de la ayuda. */
export const CONFIGURACION_NOTAS = {
  preguntas: [AYUDA_ADOPCION_RT54, AYUDA_CRITERIO_BIENES_CAMBIO, AYUDA_HECHOS_POSTERIORES],
  campoNota: AYUDA_CRITERIO_NOTA,
  transicion: AYUDA_TIPO_AJUSTE,
  camposTransicion: Object.values(AYUDA_CAMPOS_TRANSICION),
}
