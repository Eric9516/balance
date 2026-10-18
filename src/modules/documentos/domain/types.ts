import type { TipoDoc } from './reglas'

export type EstadoDoc = 'SUGERIDO' | 'ACEPTADO' | 'DESCARTADO' | 'NO_APLICA'
export type OrigenDoc = 'AUTOMATICO' | 'MANUAL'

/** Fila persistida de decisión del contador. */
export type DocumentoEjercicioDTO = {
  id: string
  ejercicioId: string
  reglaClave: string | null
  tipo: TipoDoc
  titulo: string
  estado: EstadoDoc
  origen: OrigenDoc
  saldoAlAceptar: number | null
}

/** Rubro que disparó una sugerencia (para mostrar el "por qué"). */
export type MotivoRubro = {
  codigo: string
  nombre: string
  saldo: number
}

/**
 * Resultado evaluado que consume la UI. Combina:
 *  - reglas que corresponden (con o sin decisión guardada), y
 *  - documentos manuales.
 * Un SUGERIDO no tiene fila en DB (documentoId undefined).
 */
export type DocumentoEvaluado = {
  clave: string // reglaClave, o el id del documento si es manual
  tipo: TipoDoc
  titulo: string
  estado: EstadoDoc
  origen: OrigenDoc
  /** true = sugerencia nueva sin decisión previa del contador. */
  esNuevo: boolean
  /** true = la regla matchea con los saldos actuales. */
  corresponde: boolean
  /** true = está ACEPTADO pero su saldo relacionado quedó en cero → revisar. */
  advertenciaSaldoCero: boolean
  /**
   * true = el año pasado se incluyó este anexo/nota, pero ESTE año el rubro no
   * tiene saldo. Es solo una referencia/advertencia: NO se sugiere ni se obliga.
   * El contador puede incluirlo igual (aceptar) o ignorarlo.
   */
  referenciaAnioAnterior?: boolean
  /**
   * true = es una NOTA que ya fue generada en el paso "Notas" (existe en DB).
   * No se sugiere: se muestra como ya incluida ("generada automáticamente").
   */
  autoGenerada?: boolean
  /** Rubros que lo dispararon (vacío para manuales / moneda extranjera). */
  motivo: MotivoRubro[]
  /** Id de la fila persistida, si existe. */
  documentoId?: string
}

export function toDocumentoDTO(r: {
  id: string
  ejercicioId: string
  reglaClave: string | null
  tipo: string
  titulo: string
  estado: string
  origen: string
  saldoAlAceptar: { toNumber(): number } | number | null
}): DocumentoEjercicioDTO {
  return {
    id: r.id,
    ejercicioId: r.ejercicioId,
    reglaClave: r.reglaClave,
    tipo: r.tipo as TipoDoc,
    titulo: r.titulo,
    estado: r.estado as EstadoDoc,
    origen: r.origen as OrigenDoc,
    saldoAlAceptar: r.saldoAlAceptar == null ? null : Number(r.saldoAlAceptar),
  }
}
