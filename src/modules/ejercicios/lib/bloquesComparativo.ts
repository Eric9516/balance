/**
 * Estado de carga de la columna "Ejercicio anterior" por bloque (modo MANUAL).
 * Alimenta el checklist del paso "Ejercicio anterior". Puro.
 */

import type { EstadosData } from '@/modules/estados/domain/types'
import { esRubroHuerfano } from '@/modules/estados/lib/rubroHuerfano'
import type { EvolucionPNData } from '@/modules/patrimonio-neto/domain/types'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import type { BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import type { NotaDTO } from '@/modules/notas/domain/types'

export type BloqueComparativo = {
  clave: string
  label: string
  descripcion: string
  cargados: number
  total: number
  /** false = el ejercicio no tiene este anexo/nota, no se exige */
  aplica: boolean
  href: string
}

const CLAVES_EERR = ['INGRESOS', 'COSTO_VENTAS', 'RESULTADOS_FINANCIEROS', 'IMPUESTO_GANANCIAS']
const CLAVES_CV = ['existenciaInicial', 'compras', 'gastosFabricacion', 'existenciaFinal']

export function armarBloquesComparativo(params: {
  base: string
  estadosData: EstadosData
  pnData: EvolucionPNData
  comparativos: ComparativoManualDTO[]
  bienes: BienDeUsoDTO[]
  notas: NotaDTO[]
  tieneBDU: boolean
  tieneCostoVentas: boolean
  tieneNotas: boolean
}): BloqueComparativo[] {
  const {
    base,
    estadosData,
    pnData,
    comparativos,
    bienes,
    notas,
    tieneBDU,
    tieneCostoVentas,
    tieneNotas,
  } = params
  const claves = (modulo: string) =>
    new Set(comparativos.filter((c) => c.modulo === modulo).map((c) => c.clave))

  const sspClaves = claves('SSP')
  // El patrimonio neto anterior no se carga por rubro en el SSP: sale del E.E.P.N.
  const sspRubros = estadosData.sspRubros.filter(
    (r) => !esRubroHuerfano(r.id) && r.seccionSSP !== 'PATRIMONIO_NETO',
  )
  const eerrClaves = claves('EERR')
  const secciones = estadosData.eerr.seccionesGasto.filter((s) => !esRubroHuerfano(s.key))
  const cvClaves = claves('COSTO_VENTAS')
  const cuantitativas = notas.filter((n) => n.tipo === 'CUANTITATIVA')

  return [
    {
      clave: 'SSP',
      label: 'Estado de Situación Patrimonial',
      descripcion: 'Un importe por cada rubro del activo, pasivo y patrimonio neto.',
      cargados: sspRubros.filter((r) => sspClaves.has(r.id)).length,
      total: sspRubros.length,
      aplica: sspRubros.length > 0,
      href: `${base}?paso=estados`,
    },
    {
      clave: 'EERR',
      label: 'Estado de Resultados',
      descripcion: 'Ingresos, costo de ventas, resultados financieros e impuesto a las ganancias.',
      cargados: CLAVES_EERR.filter((k) => eerrClaves.has(k)).length,
      total: CLAVES_EERR.length,
      aplica: true,
      href: `${base}?paso=estados`,
    },
    {
      clave: 'GASTOS',
      label: 'Gastos (Anexo III)',
      descripcion:
        'Importes del ejercicio anterior fila por fila en el Anexo III; el total de cada sección se calcula solo.',
      // En carga manual el total por sección se calcula desde las filas del anexo: cuenta como
      // cargada la sección que tiene importe del ejercicio anterior.
      cargados: secciones.filter((s) => s.totalAnt !== 0).length,
      total: secciones.length,
      aplica: secciones.length > 0,
      href: `${base}?paso=anexos&anexo=gastos`,
    },
    {
      clave: 'EEPN',
      label: 'Evolución del Patrimonio Neto',
      descripcion: 'Saldos al inicio por componente y columna "Ejercicio anterior".',
      cargados: pnData.movimientos.some((m) => m.totalAnterior !== 0) ? 1 : 0,
      total: 1,
      aplica: true,
      href: `${base}?paso=patrimonio-neto`,
    },
    {
      clave: 'BDU',
      label: 'Bienes de Uso (Anexo I)',
      descripcion: 'Neto residual del ejercicio anterior por categoría.',
      cargados: bienes.filter((b) => b.netoResidualAnteriorManual != null).length,
      total: bienes.length,
      aplica: tieneBDU && bienes.length > 0,
      href: `${base}?paso=anexos&anexo=bienes-de-uso`,
    },
    {
      clave: 'COSTO_VENTAS',
      label: 'Costo de Ventas (Anexo II)',
      descripcion: 'Existencias, compras y gastos del ejercicio anterior.',
      cargados: CLAVES_CV.filter((k) => cvClaves.has(k)).length,
      total: CLAVES_CV.length,
      aplica: tieneCostoVentas,
      href: `${base}?paso=anexos&anexo=costo-ventas`,
    },
    {
      clave: 'NOTAS',
      label: 'Notas de composición',
      descripcion: 'Importe del ejercicio anterior en cada nota cuantitativa.',
      cargados: cuantitativas.filter((n) => n.detalles.some((d) => d.importeAnterior !== 0)).length,
      total: cuantitativas.length,
      aplica: tieneNotas && cuantitativas.length > 0,
      href: `${base}?paso=notas`,
    },
  ]
}
