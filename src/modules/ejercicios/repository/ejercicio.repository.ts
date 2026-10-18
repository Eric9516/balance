import { cache } from 'react'
import { db } from '@/lib/db'
import type { EstadoEjercicio, ModoEjercicioAnterior } from '@prisma/client'
import { CATEGORIA_ENTE_LABELS, toEjercicioDTO, type EjercicioContableDTO } from '../domain/types'
import type {
  ConfigAnterior,
  EfectosCambioModo,
  EjercicioResumen,
} from '../domain/ejercicioAnterior'
import type { CreateEjercicioInput, UpdateEjercicioInput } from '../schemas/ejercicio.schemas'

const auditorSelect = { select: { nombre: true, apellido: true } } as const

const resumenSelect = {
  id: true,
  sociedadId: true,
  denominacion: true,
  fechaInicio: true,
  fechaCierre: true,
  ejercicioAnteriorId: true,
  estado: true,
} as const

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
  const modoAnterior: ModoEjercicioAnterior = input.modoAnterior
  // Invariante: solo VINCULADO guarda vínculo (ya validado en schema/servicio).
  const ejercicioAnteriorId =
    modoAnterior === 'VINCULADO' ? input.ejercicioAnteriorId || null : null
  return {
    auditorId: input.auditorId || null,
    modoAnterior,
    ejercicioAnteriorId,
    categoriaEnte: input.categoriaEnte,
    // Legacy: se mantienen coherentes hasta que se eliminen las columnas.
    clasificacionEntidad: CATEGORIA_ENTE_LABELS[input.categoriaEnte],
    balanceAnteriorDisponible: modoAnterior !== 'MANUAL',
    nivelComparativoSSP: null,
    numeroEjercicio: parseOptionalInt(input.numeroEjercicio),
    fechaInicio: new Date(input.fechaInicio),
    fechaCierre: new Date(input.fechaCierre),
    fechaInformeAuditor: input.fechaInformeAuditor ? new Date(input.fechaInformeAuditor) : null,
    denominacion: input.denominacion?.trim() || buildDenominacion(input.fechaCierre),
    indiceInflacionAnterior: parseOptionalDecimal(input.indiceInflacionAnterior),
    indiceInflacionActual: parseOptionalDecimal(input.indiceInflacionActual),
  }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

export async function findEjerciciosBySociedad(
  sociedadId: string,
): Promise<EjercicioContableDTO[]> {
  const rows = await db.ejercicioContable.findMany({
    where: { sociedadId },
    include: { auditor: auditorSelect },
    orderBy: [{ fechaCierre: 'desc' }],
  })
  return rows.map(toEjercicioDTO)
}

/** Memoizado por request (React cache): generateMetadata, la página y las acciones lo repiten. */
export const findEjercicioById = cache(async (id: string): Promise<EjercicioContableDTO | null> => {
  const e = await db.ejercicioContable.findUnique({
    where: { id },
    include: { auditor: auditorSelect },
  })
  return e ? toEjercicioDTO(e) : null
})

/** Resúmenes livianos de los ejercicios de una sociedad (para elegir/validar el anterior). */
export async function findResumenesBySociedad(sociedadId: string): Promise<EjercicioResumen[]> {
  return db.ejercicioContable.findMany({
    where: { sociedadId },
    select: resumenSelect,
    orderBy: [{ fechaCierre: 'desc' }],
  })
}

export async function findResumenById(id: string): Promise<EjercicioResumen | null> {
  return db.ejercicioContable.findUnique({ where: { id }, select: resumenSelect })
}

/** Modo y vínculo actuales de un ejercicio. */
export async function findConfigAnterior(id: string): Promise<ConfigAnterior | null> {
  return db.ejercicioContable.findUnique({
    where: { id },
    select: { modoAnterior: true, ejercicioAnteriorId: true },
  })
}

/**
 * Ids de la cadena de anteriores a partir de `desdeId` (el anterior de ese, el anterior
 * del anterior, ...). Corta a 100 saltos por seguridad.
 */
export async function findCadenaAnterior(desdeId: string): Promise<string[]> {
  const cadena: string[] = []
  let actual: string | null = desdeId
  for (let i = 0; i < 100 && actual; i++) {
    const row: { ejercicioAnteriorId: string | null } | null =
      await db.ejercicioContable.findUnique({
        where: { id: actual },
        select: { ejercicioAnteriorId: true },
      })
    actual = row?.ejercicioAnteriorId ?? null
    if (actual) {
      if (cadena.includes(actual)) break
      cadena.push(actual)
    }
  }
  return cadena
}

/** Id del ejercicio que usa a `anteriorId` como su ejercicio anterior, si existe. */
export async function findSucesorId(anteriorId: string): Promise<string | null> {
  const row = await db.ejercicioContable.findFirst({
    where: { ejercicioAnteriorId: anteriorId },
    select: { id: true },
  })
  return row?.id ?? null
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

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

/** Efectos de cambiar modo/vínculo (ver domain/ejercicioAnterior.efectosCambioModo). */
export async function aplicarEfectosCambioModo(
  id: string,
  efectos: EfectosCambioModo,
): Promise<void> {
  const data: {
    comparativoAutorizadoEn?: null
    comparativoAutorizadoPor?: null
    pnConfirmado?: boolean
    estadosConfirmado?: boolean
  } = {}
  if (efectos.anularAutorizacion) {
    data.comparativoAutorizadoEn = null
    data.comparativoAutorizadoPor = null
  }
  if (efectos.desconfirmar) {
    data.pnConfirmado = false
    data.estadosConfirmado = false
  }
  await db.$transaction([
    ...(efectos.limpiarComparativosManuales
      ? [db.comparativoManual.deleteMany({ where: { ejercicioId: id } })]
      : []),
    ...(Object.keys(data).length > 0 ? [db.ejercicioContable.update({ where: { id }, data })] : []),
  ])
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

/** Autorización explícita de los saldos del ejercicio anterior cargados a mano. */
export async function autorizarComparativo(ejercicioId: string, por: string): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: { comparativoAutorizadoEn: new Date(), comparativoAutorizadoPor: por },
  })
}

/**
 * Cualquier escritura sobre la columna "Ejercicio anterior" invalida la autorización
 * y la confirmación de estados (sus números cambiaron).
 */
export async function marcarComparativoModificado(ejercicioId: string): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: {
      comparativoAutorizadoEn: null,
      comparativoAutorizadoPor: null,
      estadosConfirmado: false,
    },
  })
}
