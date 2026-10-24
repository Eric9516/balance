/**
 * Pasos de un ejercicio y su resumen (lo que muestra el botón (i) de cada paso). Es parte de la
 * ayuda: cada paso tiene además su artículo completo en /ayuda, que empieza con este resumen.
 */
import type { InfoPaso } from './tipos'

export type PasoKey =
  | 'caratula'
  | 'clasificar'
  | 'anterior'
  | 'documentos'
  | 'anexos'
  // Sub-vistas de "anexos" (no son pasos del stepper; se usan como ?anexo=<slug>)
  | 'bienes-de-uso'
  | 'costo-ventas'
  | 'gastos'
  | 'notas'
  | 'patrimonio-neto'
  | 'estados'

export type InfoPasoKey = PasoKey | 'balance'

export const PASO_TITULO: Record<PasoKey, string> = {
  caratula: 'Carátula',
  clasificar: 'Clasificar cuentas',
  anterior: 'Ejercicio anterior',
  documentos: 'Anexos y notas',
  anexos: 'Anexos',
  'bienes-de-uso': 'Anexo I - Bienes de Uso',
  'costo-ventas': 'Anexo II - Costo de Ventas',
  gastos: 'Anexo III - Gastos',
  notas: 'Notas de composición',
  'patrimonio-neto': 'Estado de Evolución del Patrimonio Neto',
  estados: 'Estados contables',
}

export function isPasoKey(v: unknown): v is PasoKey {
  return typeof v === 'string' && v in PASO_TITULO
}

/** Artículo de la ayuda que explica cada paso. */
export const articuloDePaso = (paso: InfoPasoKey | 'ejercicios') => `paso-${paso}`

export const INFO_EJERCICIOS: InfoPaso = {
  title: 'Ejercicios contables',
  purpose:
    'Lista todos los períodos contables de esta sociedad. Desde acá se crea cada ejercicio, se trabaja sobre sus cuentas, anexos y estados, y se vincula con el anterior para generar balances con columna comparativa.',
  sources: [
    'Datos del ejercicio: fechas de inicio y cierre, número de ejercicio, auditor asignado.',
    'Ejercicio anterior (requisito comparativo RT 54): vinculado a un ejercicio cargado, saldos cargados a mano o primer ejercicio de la sociedad.',
  ],
  formulas: ['No aplica: esta pantalla es de gestión, no realiza cálculos contables.'],
  notes: [
    'Cada fila indica cómo se resuelve su ejercicio anterior. Un chip ámbar significa que falta definirlo desde "Editar".',
    'Los ejercicios vinculados aparecen conectados en esta lista.',
    'Para pasar a Revisión o a Cerrado, el ejercicio tiene que tener confirmados los estados y el E.E.P.N.',
  ],
}

export const PASO_INFO: Record<InfoPasoKey, InfoPaso> = {
  balance: {
    title: 'Balance de sumas y saldos',
    purpose:
      'Muestra las cuentas importadas del ejercicio. Es la base de todo el proceso: desde estas cuentas salen las clasificaciones, anexos, notas y estados.',
    sources: [
      'Cuentas cargadas por importación de Excel o carga manual.',
      'Saldo deudor, saldo acreedor y saldo final de cada cuenta.',
    ],
    formulas: [
      'Saldo final = Saldo deudor - Saldo acreedor',
      'Control de importación: Total debe = Total haber, exacto (sin tolerancia de centavos)',
    ],
    notes: [
      'Si el balance de origen no cierra, la importación lo avisa con la diferencia completa.',
      'Reimportar reemplaza todas las cuentas: hay que volver a clasificar.',
    ],
  },
  caratula: {
    title: 'Carátula',
    purpose:
      'Reúne los datos formales de la sociedad, el ejercicio y el informe. No calcula saldos, pero esos datos se usan para presentar el balance.',
    sources: [
      'Datos de la sociedad.',
      'Datos del ejercicio contable.',
      'Auditor, fecha de cierre y fecha del informe si están cargados.',
    ],
    formulas: ['No aplica cálculos contables en esta pantalla.'],
    notes: [
      'Para corregir un dato, editá la sociedad o el ejercicio: la carátula se actualiza sola.',
    ],
  },
  clasificar: {
    title: 'Clasificación de cuentas',
    purpose:
      'Asigna cada cuenta del balance a una clasificación contable (rubro). Esa clasificación decide si la cuenta va al Estado de Situación Patrimonial, al Estado de Resultados o al Patrimonio Neto, y qué anexos y notas se sugieren.',
    sources: [
      'Cuentas importadas del ejercicio.',
      'Clasificaciones RT 54 configuradas por rubro y sección.',
    ],
    formulas: [
      'Valor presentado = saldo final con el signo según la naturaleza del rubro',
      'Pendientes = cuentas sin clasificación asignada',
    ],
    notes: [
      'Una cuenta sin clasificar no aparece en ningún estado. Clasificalas todas antes de confirmar.',
      'Podés seleccionar varias cuentas y asignarlas juntas con la barra de abajo.',
    ],
  },
  anterior: {
    title: 'Ejercicio anterior (requisito comparativo RT 54)',
    purpose:
      'Resuelve de dónde salen los saldos de inicio y la columna "Ejercicio anterior" de todos los estados, anexos y notas. Hay tres caminos: vincular un ejercicio cargado en el sistema, cargar los saldos a mano y autorizarlos, o declarar que es el primer ejercicio.',
    sources: [
      'Vinculado: los saldos al cierre del ejercicio anterior, reexpresados con el coeficiente de inflación del ejercicio.',
      'Carga manual: cada importe del anterior se carga una sola vez, en su lugar más detallado (las notas, el Anexo I, el Anexo II, el Anexo III fila por fila y los rubros sin nota en el estado).',
      'Primer ejercicio: no hay comparativo y los estados lo indican expresamente.',
    ],
    formulas: [
      'Vinculado: saldos al inicio del E.E.P.N. = saldos al cierre del anterior; valor de inicio del Anexo I = valor al cierre del anterior; existencia inicial = existencia final anterior.',
      'Carga manual: Activo anterior = Pasivo anterior + Patrimonio neto anterior; resultado anterior del EERR = resultado anterior del E.E.P.N. (sale solo del EERR).',
    ],
    notes: [
      'Los estados no se pueden confirmar ni el ejercicio pasar a revisión mientras esta configuración esté pendiente.',
      'En carga manual, cualquier cambio posterior en la columna "Ejercicio anterior" anula la autorización y hay que volver a autorizar.',
    ],
  },
  documentos: {
    title: 'Anexos y notas sugeridos',
    purpose:
      'Sugiere qué anexos y notas corresponden según los rubros con saldo del balance. La app solo sugiere: el contador acepta, descarta, marca como no aplica o agrega uno a mano. No genera anexos vacíos.',
    sources: [
      'Saldos por rubro del balance (suma de saldo final por clasificación).',
      'Catálogo de reglas de anexos y notas de la app.',
      'Decisiones previas del contador para este ejercicio.',
    ],
    formulas: [
      'Un anexo o nota se sugiere si algún rubro que lo dispara tiene saldo distinto de cero',
      'Un documento aceptado no se elimina solo: si su saldo queda en cero se muestra una advertencia',
    ],
    notes: [
      'Solo lo aceptado sale en los estados y en el documento imprimible.',
      'La nota de transición a la RT 54 se incluye solo si la aceptás acá.',
    ],
  },
  anexos: {
    title: 'Anexos',
    purpose:
      'Reúne en un solo lugar los anexos que aceptaste en "Anexos y notas". Cada anexo aceptado aparece como una pestaña: elegís cuál ver y cargás su detalle.',
    sources: [
      'Anexos aceptados en el paso "Anexos y notas".',
      'Datos propios de cada anexo: bienes de uso, costo de ventas, gastos.',
    ],
    formulas: [
      'Las pestañas que aparecen = los anexos aceptados. Si no aceptaste ninguno, no hay pestañas.',
    ],
    notes: ['Aceptar un anexo en "Anexos y notas" hace aparecer su pestaña acá.'],
  },
  'bienes-de-uso': {
    title: 'Anexo I - Bienes de Uso',
    purpose:
      'Arma el detalle de bienes de uso por categoría y calcula su valor residual. El total va al rubro Bienes de uso del Estado de Situación Patrimonial.',
    sources: [
      'Categorías cargadas para el ejercicio (Rodados, Muebles y útiles…).',
      'Vinculado: el valor y la amortización al comienzo son el cierre del anterior (con candado); el ajuste por inflación se carga en su columna.',
      'Carga manual: el neto del año anterior sale del valor y la amortización al comienzo.',
    ],
    formulas: [
      'Valor al cierre = Valor al comienzo + Ajuste por inflación + Aumentos - Disminuciones',
      'Amortización al cierre = Al comienzo + Ajuste por inflación + Del ejercicio - Bajas',
      'Neto residual = Valor al cierre - Amortización al cierre',
    ],
  },
  'costo-ventas': {
    title: 'Anexo II - Costo de Ventas',
    purpose:
      'Calcula el costo de los bienes vendidos o de los servicios prestados. El Estado de Resultados toma este anexo cuando está cargado.',
    sources: [
      'Existencia inicial: es la existencia final del año anterior (con candado), vinculado o cargado a mano.',
      'Compras y gastos de fabricación o producción.',
      'Existencia final. En carga manual, la del año anterior se propone desde la nota de Bienes de cambio.',
    ],
    formulas: [
      'Costo de ventas = Existencia inicial + Compras + Gastos de fabricación - Existencia final',
    ],
    notes: [
      'El costo de ventas del año anterior del Estado de Resultados sale de la columna "Ejercicio anterior" de este anexo.',
    ],
  },
  gastos: {
    title: 'Anexo III - Gastos',
    purpose:
      'Agrupa los gastos por sección (administración, comercialización…) con una fila por cuenta. El Estado de Resultados toma de acá el total de cada sección.',
    sources: [
      'Cuentas clasificadas en secciones de gasto.',
      'Vinculado: el año anterior sale de las cuentas del anterior reexpresadas, incluidas las que este año ya no están.',
      'Carga manual: el año anterior se carga fila por fila; los gastos que solo existieron ese año se agregan como fila nueva.',
    ],
    formulas: [
      'Total por sección = suma de sus filas',
      'El Estado de Resultados toma los totales por sección (actual y anterior) de este anexo',
    ],
  },
  notas: {
    title: 'Notas',
    purpose:
      'Genera y permite editar las notas de composición y de criterios. Cada nota cuantitativa detalla las cuentas de un rubro con su importe actual y anterior.',
    sources: [
      'Cuentas clasificadas por rubro.',
      'Respuestas de "Configurar Nota I" (adopción de la RT 54, criterio de bienes de cambio, hechos posteriores).',
      'Carga manual: la columna "Ejercicio anterior" de cada nota se carga acá, cuenta por cuenta.',
    ],
    formulas: [
      'Total de la nota = suma de sus filas; tiene que coincidir con el rubro',
      'Número de nota = orden correlativo de las notas visibles',
    ],
    notes: [
      'El importe del ejercicio actual sale del balance: no se edita en la nota.',
      'Regenerar nunca borra una fila con importe anterior ni pisa un texto editado sin que lo elijas.',
      'La Nota 1 (bases de preparación) se arma sola con los datos del ejercicio y se puede editar; en la primera aplicación de la RT 54 incluye la transición con sus conciliaciones.',
    ],
  },
  'patrimonio-neto': {
    title: 'Estado de Evolución del Patrimonio Neto',
    purpose:
      'Carga los movimientos del Patrimonio Neto por columna (capital, ajuste de capital, aportes, reservas, resultados no asignados) y toma solo el resultado del ejercicio del Estado de Resultados.',
    sources: [
      'Saldos al inicio: vinculado, el cierre del anterior (con candado).',
      'Modificación de saldos al inicio: en primera aplicación de la RT 54 acompaña a los ajustes de la nota de transición.',
      'Distribuciones y otros movimientos del ejercicio.',
      'Resultado del ejercicio (y, en carga manual, el del año anterior) desde el Estado de Resultados.',
    ],
    formulas: [
      'Total por fila = Capital + Ajuste de capital + Aportes + Reservas + Resultados no asignados',
      'Patrimonio neto al cierre = suma de todos los movimientos',
      'El total al cierre es el Patrimonio Neto del Estado de Situación Patrimonial',
    ],
    notes: [
      'El resultado del ejercicio no se carga a mano: viene del Estado de Resultados.',
      'Hay que confirmarlo ("Confirmar E.E.P.N.") para pasar el ejercicio a Revisión.',
    ],
  },
  estados: {
    title: 'Estados contables',
    purpose:
      'Muestra el Estado de Situación Patrimonial, el Estado de Resultados y el Estado de Flujo de Efectivo, con la columna "Ejercicio anterior" cuando hay comparativo.',
    sources: [
      'Cuentas clasificadas para el SSP, el PN y el EERR.',
      'Anexo II para el costo de ventas y Anexo III para los gastos, cuando están cargados.',
      'Evolución del patrimonio neto para el total del Patrimonio Neto.',
    ],
    formulas: [
      'SSP: Activo = Pasivo + Patrimonio Neto',
      'Utilidad bruta = Ingresos - Costo de ventas',
      'Resultado antes de impuesto = Utilidad bruta - Gastos + Resultados financieros',
      'Resultado del ejercicio = Resultado antes de impuesto - Impuesto a las ganancias',
    ],
    notes: [
      'El Patrimonio Neto es el total al cierre del Estado de Evolución del Patrimonio Neto.',
      'Confirmar los estados pasa por la compuerta de autorización: si algo no cuadra, te dice qué y dónde corregirlo.',
    ],
  },
}
