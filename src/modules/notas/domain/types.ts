import type { NotaEjercicio, DetalleNota } from '@prisma/client'
import { importe, sumarPor } from '@/lib/importe'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type DetalleNotaDTO = {
  id: string
  notaEjercicioId: string
  orden: number
  concepto: string
  importeActual: number
  importeAnterior: number
  esTotal: boolean
}

export type NotaDTO = {
  id: string
  ejercicioId: string
  numero: number | null
  titulo: string
  tipo: 'INFORMATIVA' | 'CUANTITATIVA' | 'POLITICA_CONTABLE'
  orden: number
  criterioMedicion: string | null
  textoApertura: string | null
  detalles: DetalleNotaDTO[]
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type NotaRaw = NotaEjercicio & { detalles: DetalleNota[] }

export function toNotaDTO(n: NotaRaw): NotaDTO {
  return {
    id: n.id,
    ejercicioId: n.ejercicioId,
    numero: n.numero,
    titulo: n.titulo,
    tipo: n.tipo,
    orden: n.orden,
    criterioMedicion: n.criterioMedicion,
    textoApertura: n.textoApertura,
    detalles: [...n.detalles]
      .sort((a, b) => a.orden - b.orden)
      .map((d) => ({
        id: d.id,
        notaEjercicioId: d.notaEjercicioId,
        orden: d.orden,
        concepto: d.concepto,
        importeActual: importe(d.importeActual),
        importeAnterior: importe(d.importeAnterior),
        esTotal: d.esTotal,
      })),
  }
}

// ─── Totales ──────────────────────────────────────────────────────────────────

/** Total de una nota cuantitativa: suma de sus filas de detalle (sin la fila de total). */
export function totalesNota(nota: Pick<NotaDTO, 'detalles'>): { actual: number; anterior: number } {
  const filas = nota.detalles.filter((d) => !d.esTotal)
  return {
    actual: sumarPor(filas, (d) => d.importeActual),
    anterior: sumarPor(filas, (d) => d.importeAnterior),
  }
}

/** ¿La nota tiene cargada la columna "Ejercicio anterior"? (alguna fila con importe) */
export function tieneAnteriorCargado(nota: Pick<NotaDTO, 'detalles'>): boolean {
  return nota.detalles.some((d) => !d.esTotal && d.importeAnterior !== 0)
}

/** Clave para comparar un concepto de la nota con el nombre de una cuenta. */
export function claveConcepto(texto: string): string {
  return texto.trim().toLowerCase()
}

/**
 * Nota de composición de cada rubro: la vinculada a sus cuentas. La generación de notas vincula
 * todas las cuentas de un rubro a la misma nota.
 */
export function notaPorRubro(
  cuentas: { rubroBaseId: string | null; notaEjercicioId: string | null }[],
  notas: NotaDTO[],
): Map<string, NotaDTO> {
  const porId = new Map(notas.map((n) => [n.id, n]))
  const porRubro = new Map<string, NotaDTO>()
  for (const c of cuentas) {
    if (!c.rubroBaseId || !c.notaEjercicioId || porRubro.has(c.rubroBaseId)) continue
    const nota = porId.get(c.notaEjercicioId)
    if (nota) porRubro.set(c.rubroBaseId, nota)
  }
  return porRubro
}
