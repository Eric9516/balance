import type { NotaEjercicio, DetalleNota } from '@prisma/client'

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
        importeActual: Number(d.importeActual),
        importeAnterior: Number(d.importeAnterior),
        esTotal: d.esTotal,
      })),
  }
}
