import { db } from '@/lib/db'
import type { EstadoImportacion } from '@prisma/client'
import { toImportacionDTO, type ImportacionDTO } from '../domain/types'

export async function createImportacion(data: {
  ejercicioId: string
  nombreArchivo: string
  hashArchivo: string
  mapeoSnapshot: object
}): Promise<ImportacionDTO> {
  const i = await db.importacionExcel.create({
    data: {
      ...data,
      estado: 'PROCESANDO',
      modo: 'REEMPLAZAR',
      mapeoSnapshot: data.mapeoSnapshot,
    },
  })
  return toImportacionDTO(i)
}

export async function updateImportacion(
  id: string,
  data: {
    estado: EstadoImportacion
    totalFilas?: number
    filasImportadas?: number
    filasError?: number
    erroresDetalle?: object
  },
): Promise<void> {
  await db.importacionExcel.update({ where: { id }, data })
}
