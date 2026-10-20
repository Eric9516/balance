import type { DocumentoEvaluado } from '@/modules/documentos/domain/types'

/** Clave de la "Nota de primera aplicación de la RT 54" en el catálogo de documentos. */
export const CLAVE_NOTA_TRANSICION = 'NOTA_TRANSICION_RT54'

export const ADVERTENCIA_NOTA_TRANSICION_NO_INCLUIDA =
  'La Nota de primera aplicación de la RT 54 no está incluida en los estados. El ejercicio está ' +
  'configurado como primera aplicación de la RT 54 y la norma exige esa nota: incluila desde la ' +
  'configuración de anexos. Si no corresponde, cambiá la adopción de la RT 54 con "Volver a ' +
  'configurar" de la Nota I.'

export type InclusionNotaTransicion =
  | { incluir: true }
  | { incluir: false; motivo: 'NO_ES_PRIMERA_ADOPCION' }
  | { incluir: false; motivo: 'NO_INCLUIDA'; advertencia: string }

/**
 * Única regla que decide si la Nota de primera aplicación de la RT 54 va en la pantalla de Notas y
 * en el documento imprimible. Funciona igual que los anexos de la configuración de anexos:
 * - Solo existe en la primera aplicación de la RT 54 (configuración de la Nota I del ejercicio).
 * - Aparece solo si el contador la incluyó (ACEPTADO). Sugerida, descartada o "no aplica", no
 *   aparece: "Quitar de los estados" la devuelve a sugerida.
 * - Como la norma la exige en la primera aplicación, si no está incluida queda una advertencia.
 */
export function inclusionNotaTransicion(
  esPrimeraAdopcion: boolean,
  documentos: readonly Pick<DocumentoEvaluado, 'clave' | 'estado'>[],
): InclusionNotaTransicion {
  if (!esPrimeraAdopcion) return { incluir: false, motivo: 'NO_ES_PRIMERA_ADOPCION' }
  const estado = documentos.find((d) => d.clave === CLAVE_NOTA_TRANSICION)?.estado
  if (estado === 'ACEPTADO') return { incluir: true }
  return {
    incluir: false,
    motivo: 'NO_INCLUIDA',
    advertencia: ADVERTENCIA_NOTA_TRANSICION_NO_INCLUIDA,
  }
}
