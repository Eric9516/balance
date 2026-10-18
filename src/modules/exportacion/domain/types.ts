/**
 * Modelo del juego de estados contables impreso. Es una composición de los datos
 * que ya calculan los servicios de cada módulo: acá no se recalcula nada, solo se
 * decide qué se incluye, en qué orden y con qué textos.
 */

import type { ResultadoAutorizacion } from '@/modules/ejercicios/domain/autorizacion'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import type { SociedadDTO } from '@/modules/sociedades/domain/types'
import type { CaratulaModelo } from '@/modules/sociedades/domain/caratula'
import type { AuditorDTO } from '@/modules/auditores/domain/types'
import type { EstadosData } from '@/modules/estados/domain/types'
import type { LineaEERR } from '@/modules/estados/domain/lineasEERR'
import type { EvolucionPNData } from '@/modules/patrimonio-neto/domain/types'
import type { FlujoData } from '@/modules/flujo-efectivo/domain/calculo'
import type { ResultadoArrastreBDU } from '@/modules/bienes-de-uso/domain/saldosInicio'
import type { ResultadoArrastreCV } from '@/modules/costo-ventas/domain/saldosInicio'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { DocumentoEvaluado } from '@/modules/documentos/domain/types'
import type { NotaDTO } from '@/modules/notas/domain/types'
import type { NotaTransicionGenerada } from '@/modules/transicion-rt54/lib/generarNota'

/** Anexo II ya resuelto: arrastre + columna anterior + conceptos solo del anterior. */
export type AnexoCostoVentas = ResultadoArrastreCV & {
  datosAnteriores: CostoVentasDTO | null
  conceptosExtra: ComparativoManualDTO[]
}

export type ColumnasDocumento = {
  fechaInicio: Date
  fechaCierre: Date
  /** null = sin columna comparativa. */
  fechaCierreAnterior: Date | null
  mostrarAnterior: boolean
  /** La columna anterior se cargó a mano (modo MANUAL). */
  anteriorManual: boolean
}

export type EncabezadoDocumento = {
  razonSocial: string
  cuit: string
  /** "Estados contables al dd/mm/aaaa · Ejercicio económico N° X" */
  linea: string
  leyendaMoneda: string
}

export type FirmasDocumento = {
  representante: { rol: string }
  /** null = sin auditor asignado. */
  auditor: { lineas: string[]; leyenda: string } | null
}

export type SeccionDocumento =
  | { tipo: 'caratula'; caratula: CaratulaModelo }
  | { tipo: 'ssp'; titulo: string; subtitulo: string; estados: EstadosData }
  | { tipo: 'eerr'; titulo: string; subtitulo: string; lineas: LineaEERR[] }
  | { tipo: 'eepn'; titulo: string; subtitulo: string; pn: EvolucionPNData }
  | { tipo: 'flujo'; titulo: string; subtitulo: string; flujo: FlujoData }
  | { tipo: 'anexo-bienes-uso'; titulo: string; subtitulo: string; anexo: ResultadoArrastreBDU }
  | { tipo: 'anexo-costo-ventas'; titulo: string; subtitulo: string; anexo: AnexoCostoVentas }
  | { tipo: 'anexo-gastos'; titulo: string; subtitulo: string; anexo: GastosSecciones }
  | {
      tipo: 'notas'
      titulo: string
      subtitulo: string
      notaUno: { titulo: string; detalle: string }
      transicion: { titulo: string; nota: NotaTransicionGenerada } | null
      notas: NotaDTO[]
    }
  | { tipo: 'pendiente'; clave: 'INFORME_AUDITOR' | 'MEMORIA'; titulo: string; detalle: string }

export type DocumentoBalance = {
  ejercicioId: string
  sociedadId: string
  encabezado: EncabezadoDocumento
  columnas: ColumnasDocumento
  firmas: FirmasDocumento
  /** Marca de agua: hay bloqueantes en la compuerta de autorización. */
  borrador: { es: boolean; motivos: string[] }
  /** Avisos que no impiden imprimir (se muestran en pantalla, no en el papel). */
  advertencias: string[]
  /** Partes del juego que todavía no se pueden imprimir. */
  pendientes: string[]
  secciones: SeccionDocumento[]
}

/** Todo lo que necesita armarDocumento, ya cargado por los servicios de cada módulo. */
export type InsumosDocumento = {
  sociedad: SociedadDTO
  ejercicio: EjercicioContableDTO
  auditor: AuditorDTO | null
  /** Cierre del ejercicio anterior (vinculado o derivado de la fecha de inicio). */
  fechaCierreAnterior: Date | null
  estados: EstadosData
  pn: EvolucionPNData
  flujo: FlujoData
  anexos: {
    bienesDeUso: ResultadoArrastreBDU | null
    costoVentas: AnexoCostoVentas | null
    gastos: GastosSecciones | null
  }
  /** Decisiones de "Anexos y notas" (qué anexos están aceptados). */
  documentos: Pick<DocumentoEvaluado, 'clave' | 'tipo' | 'titulo' | 'estado'>[]
  notas: NotaDTO[]
  notaTransicion: NotaTransicionGenerada | null
  evaluacion: ResultadoAutorizacion
}
