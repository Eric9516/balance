import { db } from '@/lib/db'
import type { EstadoEjercicio } from '@prisma/client'
import { toEjercicioDTO, type EjercicioContableDTO } from '../domain/types'
import type { CreateEjercicioInput, UpdateEjercicioInput } from '../schemas/ejercicio.schemas'

const auditorSelect = { select: { nombre: true, apellido: true } } as const

function parseOptionalInt(val?: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function parseOptionalDecimal(val?: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseFloat(val.trim().replace(',', '.'))
  return isNaN(n) ? null : n
}

function buildDenominacion(fechaCierre: string): string {
  const d = new Date(fechaCierre)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `Ejercicio al ${day}/${month}/${year}`
}

function buildData(input: CreateEjercicioInput) {
  return {
    auditorId: input.auditorId || null,
    ejercicioAnteriorId: input.ejercicioAnteriorId || null,
    numeroEjercicio: parseOptionalInt(input.numeroEjercicio),
    fechaInicio: new Date(input.fechaInicio),
    fechaCierre: new Date(input.fechaCierre),
    fechaInformeAuditor: input.fechaInformeAuditor ? new Date(input.fechaInformeAuditor) : null,
    denominacion: input.denominacion?.trim() || buildDenominacion(input.fechaCierre),
    clasificacionEntidad: input.clasificacionEntidad || null,
    indiceInflacionAnterior: parseOptionalDecimal(input.indiceInflacionAnterior),
    indiceInflacionActual: parseOptionalDecimal(input.indiceInflacionActual),
    // Se guarda independientemente de si hay ejercicio anterior vinculado o no
    balanceAnteriorDisponible: input.balanceAnteriorDisponible ?? true,
    nivelComparativoSSP: input.balanceAnteriorDisponible === false
      ? (input.nivelComparativoSSP ?? 'SECCION')
      : null,
  }
}

export async function findEjerciciosBySociedad(sociedadId: string): Promise<EjercicioContableDTO[]> {
  const rows = await db.ejercicioContable.findMany({
    where: { sociedadId },
    include: { auditor: auditorSelect },
    orderBy: [{ fechaCierre: 'desc' }],
  })
  return rows.map(toEjercicioDTO)
}

export async function findEjercicioById(id: string): Promise<EjercicioContableDTO | null> {
  const e = await db.ejercicioContable.findUnique({
    where: { id },
    include: { auditor: auditorSelect },
  })
  return e ? toEjercicioDTO(e) : null
}

export async function createEjercicio(
  sociedadId: string,
  estudioId: string,
  input: CreateEjercicioInput,
): Promise<EjercicioContableDTO> {
  const e = await db.ejercicioContable.create({
    data: { estudioId, sociedadId, ...buildData(input) },
    include: { auditor: auditorSelect },
  })
  return toEjercicioDTO(e)
}

export async function updateEjercicio(
  id: string,
  input: UpdateEjercicioInput,
): Promise<EjercicioContableDTO> {
  const e = await db.ejercicioContable.update({
    where: { id },
    data: buildData(input),
    include: { auditor: auditorSelect },
  })
  return toEjercicioDTO(e)
}

export async function cambiarEstado(
  id: string,
  estado: EstadoEjercicio,
): Promise<EjercicioContableDTO> {
  const e = await db.ejercicioContable.update({
    where: { id },
    data: { estado },
    include: { auditor: auditorSelect },
  })
  return toEjercicioDTO(e)
}

export async function deleteEjercicio(id: string): Promise<void> {
  await db.ejercicioContable.delete({ where: { id } })
}

/** Revoca la confirmación de estados cuando se hace un cambio que puede descuadrar el balance. */
export async function resetEstadosConfirmado(ejercicioId: string): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: { estadosConfirmado: false },
  })
}
