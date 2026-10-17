import type { StepInfo } from '@/components/shared/StepInfoButton'

export type PasoKey =
  | 'caratula'
  | 'clasificar'
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
  documentos: 'Anexos y notas',
  anexos: 'Anexos',
  'bienes-de-uso': 'Anexo I - Bienes de Uso',
  'costo-ventas': 'Anexo II - Costo de Ventas',
  gastos: 'Anexo III - Gastos',
  notas: 'Notas de composición',
  'patrimonio-neto': 'Estado de Evolución del Patrimonio Neto',
  estados: 'Estados contables',
}

export const PASO_INFO: Record<InfoPasoKey, StepInfo> = {
  balance: {
    title: 'Balance de sumas y saldos',
    purpose:
      'Muestra las cuentas importadas del ejercicio. Es la base de todo el proceso: desde estas cuentas salen las clasificaciones, anexos, notas y estados.',
    sources: [
      'Cuentas cargadas por importación Excel o carga manual.',
      'Saldos deudores, saldos acreedores y saldo final de cada cuenta.',
    ],
    formulas: [
      'Saldo final = Saldo deudor - Saldo acreedor',
      'Control de importación = Total debe - Total haber',
    ],
    notes: [
      'Si el balance de origen no cierra, los estados posteriores pueden arrastrar ese problema.',
    ],
  },
  caratula: {
    title: 'Carátula',
    purpose:
      'Reúne los datos formales de la sociedad, el ejercicio y el informe. No calcula saldos, pero esos datos se usan para presentar el balance.',
    sources: [
      'Datos de la sociedad.',
      'Datos del ejercicio contable.',
      'Auditor, fecha de cierre y fecha de informe si están cargados.',
    ],
    formulas: ['No aplica cálculos contables en esta pantalla.'],
  },
  clasificar: {
    title: 'Clasificación de cuentas',
    purpose:
      'Asigna cada cuenta del balance a una clasificación contable. Esa clasificación decide si la cuenta va al SSP, al EERR o al PN.',
    sources: [
      'Cuentas importadas del ejercicio.',
      'Clasificaciones configuradas por rubro y sección.',
    ],
    formulas: [
      'Valor presentado = saldo final con signo según naturaleza del rubro',
      'Pendientes = cuentas sin clasificación asignada',
    ],
    notes: ['Una cuenta mal clasificada puede afectar el cuadre del SSP, el EERR, notas y anexos.'],
  },
  documentos: {
    title: 'Anexos y notas sugeridos',
    purpose:
      'Sugiere qué anexos y notas corresponden según los rubros con saldo del balance. La app solo sugiere: el contador acepta, descarta, marca como no aplica o agrega manualmente. No genera anexos vacíos.',
    sources: [
      'Saldos por rubro del balance (suma de saldo final por clasificación).',
      'Catálogo de reglas de anexos/notas definido en la app.',
      'Decisiones previas del contador para este ejercicio.',
    ],
    formulas: [
      'Un anexo/nota se sugiere si algún rubro disparador tiene saldo distinto de cero',
      'Un documento aceptado no se elimina solo: si su saldo queda en cero se muestra una advertencia',
    ],
    notes: [
      'Las sugerencias no son definitivas: la decisión final siempre es del contador.',
      'La nota de moneda extranjera queda preparada para cuando exista ese dato por cuenta.',
    ],
  },
  anexos: {
    title: 'Anexos',
    purpose:
      'Reúne en un solo lugar los anexos que aceptaste en "Anexos y notas". Cada anexo aceptado aparece como una pestaña: elegís cuál ver y cargás su detalle. Los anexos que todavía no tienen pantalla se muestran como "en construcción".',
    sources: [
      'Anexos aceptados en el paso "Anexos y notas" (según los saldos del ejercicio actual).',
      'Datos propios de cada anexo: bienes de uso, costo de ventas, gastos, etc.',
    ],
    formulas: [
      'Las pestañas que aparecen = los anexos aceptados. Si no aceptaste ninguno, no hay pestañas.',
    ],
    notes: ['Aceptar un anexo en "Anexos y notas" hace aparecer su pestaña acá.'],
  },
  'bienes-de-uso': {
    title: 'Anexo I - Bienes de Uso',
    purpose:
      'Arma el detalle de bienes de uso y calcula su valor residual. Este anexo se completa antes de notas y estados.',
    sources: [
      'Bienes cargados para el ejercicio actual.',
      'Neto residual del ejercicio anterior cuando existe ejercicio anterior vinculado.',
    ],
    formulas: [
      'Costo al cierre = Costo al inicio + Altas - Bajas +/- Ajustes',
      'Depreciación acumulada al cierre = Depreciación acumulada inicial + Depreciación del ejercicio - Depreciación de bajas',
      'Neto residual = Costo al cierre - Depreciación acumulada al cierre',
    ],
  },
  'costo-ventas': {
    title: 'Anexo II - Costo de Ventas',
    purpose:
      'Calcula el costo de los bienes vendidos o servicios. El Estado de Resultados toma este anexo cuando está cargado.',
    sources: [
      'Existencia inicial.',
      'Compras.',
      'Gastos de fabricación o producción.',
      'Existencia final.',
    ],
    formulas: [
      'Costo de ventas = Existencia inicial + Compras + Gastos de fabricación - Existencia final',
    ],
    notes: ['Este valor no debería duplicarse en notas si ya se informa por anexo.'],
  },
  gastos: {
    title: 'Anexo III - Gastos',
    purpose:
      'Agrupa los gastos por sección y muestra el detalle por clasificación. El Estado de Resultados toma estos totales cuando el anexo existe.',
    sources: [
      'Cuentas clasificadas en secciónes marcadas como gasto.',
      'Grupos de gasto configurados por el usuario.',
      'Ejercicio anterior vinculado para comparativos, si existe.',
    ],
    formulas: [
      'Total por clasificación = suma de cuentas asignadas a esa clasificación',
      'Total por sección = suma de clasificaciones dentro de la sección',
      'EERR toma los totales del Anexo III cuando hay datos de gastos cargados',
    ],
  },
  notas: {
    title: 'Notas',
    purpose:
      'Genera y permite editar las notas de composicion y criterios. Las notas deben explicar los rubros que corresponden, sin duplicar anexos ya completados.',
    sources: [
      'Cuentas clasificadas por rubro.',
      'Preguntas del modal de Nota I.',
      'Datos ya cargados en anexos cuando corresponda.',
    ],
    formulas: [
      'Total de nota = suma de las cuentas vinculadas al rubro de esa nota',
      'Número de nota = orden correlativo de notas visibles',
    ],
    notes: [
      'Gastos, costo de ventas y bienes de uso pueden no ir como notas si ya se presentan en sus anexos.',
    ],
  },
  'patrimonio-neto': {
    title: 'Estado de Evolución del Patrimonio Neto',
    purpose:
      'Permite cargar los movimientos del Patrimonio Neto y toma automáticamente el resultado del ejercicio desde el Estado de Resultados.',
    sources: [
      'Saldos al cierre del ejercicio anterior.',
      'Ajuste por inflación y modificaciones de inicio.',
      'Distribuciones y movimientos del ejercicio.',
      'Resultado del ejercicio calculado en el Estado de Resultados.',
    ],
    formulas: [
      'Total por fila = Capital + Ajuste de capital + Aportes + Reservas + Resultados no asignados',
      'Patrimonio Neto final = suma de todos los movimientos del cuadro',
      'El PN final se traslada al Estado de Situación Patrimonial',
    ],
    notes: [
      'El resultado del ejercicio no se carga manualmente acá: viene del EERR.',
      'El PN final debe coincidir con el Patrimonio Neto mostrado en el SSP.',
    ],
  },
  estados: {
    title: 'Estados contables',
    purpose:
      'Muestra el Estado de Situación Patrimonial y el Estado de Resultados usando las cuentas clasificadas y los anexos cargados.',
    sources: [
      'Cuentas clasificadas para SSP, PN y EERR.',
      'Anexo II para costo de ventas si está cargado.',
      'Anexo III para gastos si está cargado.',
      'Notas para mostrar referencias cuando corresponda.',
    ],
    formulas: [
      'SSP: Activo = Pasivo + Patrimonio Neto',
      'Utilidad bruta = Ingresos - Costo de ventas',
      'Resultado antes de impuesto = Utilidad bruta - Gastos + Resultados financieros',
      'Resultado del ejercicio = Resultado antes de impuesto - Impuesto a las ganancias',
    ],
    notes: [
      'El Patrimonio Neto debe coincidir con el saldo final del Estado de Evolución del Patrimonio Neto.',
      'Si hay descuadre, primero revisar cuentas sin clasificar, Activo, Pasivo y el cuadro de Patrimonio Neto.',
    ],
  },
}

export function isPasoKey(v: unknown): v is PasoKey {
  return typeof v === 'string' && v in PASO_TITULO
}
