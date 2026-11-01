import { cache } from 'react'
import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
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

type AuditorResumen = { id: string; nombre: string; apellido: string }

/**
 * Completa los auditores que faltan (por ejemplo, si se reasignó uno entre dos consultas
 * paralelas). Normalmente no hace ninguna consulta.
 */
async function completarAuditores(
  auditorIds: (string | null)[],
  porId: Map<string, AuditorResumen>,
): Promise<void> {
  const faltantes = [...new Set(auditorIds.filter((id): id is string => !!id && !porId.has(id)))]
  if (faltantes.length === 0) return
  const extra = await db.auditor.findMany({
    where: { id: { in: faltantes } },
    select: { id: true, ...auditorSelect.select },
  })
  for (const a of extra) porId.set(a.id, a)
}

/**
 * Los ejercicios y sus auditores se piden EN PARALELO (un solo viaje a la base): con `include`,
 * Prisma pediría los auditores en una segunda consulta, después de la primera.
 */
export async function findEjerciciosBySociedad(
  sociedadId: string,
): Promise<EjercicioContableDTO[]> {
  if (!esUuid(sociedadId)) return []
  const [rows, auditores] = await Promise.all([
    db.ejercicioContable.findMany({ where: { sociedadId }, orderBy: [{ fechaCierre: 'desc' }] }),
    db.auditor.findMany({
      where: { ejercicios: { some: { sociedadId } } },
      select: { id: true, ...auditorSelect.select },
    }),
  ])
  const porId = new Map(auditores.map((a) => [a.id, a]))
  await completarAuditores(
    rows.map((e) => e.auditorId),
    porId,
  )
  return rows.map((e) =>
    toEjercicioDTO({ ...e, auditor: e.auditorId ? (porId.get(e.auditorId) ?? null) : null }),
  )
}

/**
 * Memoizado por request (React cache): generateMetadata, la página y las acciones lo repiten.
 * El ejercicio y su auditor van EN PARALELO, en un solo viaje a la base.
 */
export const findEjercicioById = cache(async (id: string): Promise<EjercicioContableDTO | null> => {
  if (!esUuid(id)) return null
  const [e, auditor] = await Promise.all([
    db.ejercicioContable.findUnique({ where: { id } }),
    db.auditor.findFirst({
      where: { ejercicios: { some: { id } } },
      select: { id: true, ...auditorSelect.select },
    }),
  ])
  if (!e) return null
  const porId = new Map(auditor ? [[auditor.id, auditor]] : [])
  await completarAuditores([e.auditorId], porId)
  return toEjercicioDTO({ ...e, auditor: e.auditorId ? (porId.get(e.auditorId) ?? null) : null })
})

/** Resúmenes livianos de los ejercicios de una sociedad (para elegir/validar el anterior). */
export async function findResumenesBySociedad(sociedadId: string): Promise<EjercicioResumen[]> {
  if (!esUuid(sociedadId)) return []
  return db.ejercicioContable.findMany({
    where: { sociedadId },
    select: resumenSelect,
    orderBy: [{ fechaCierre: 'desc' }],
  })
}

export async function findResumenById(id: string): Promise<EjercicioResumen | null> {
  if (!esUuid(id)) return null
  return db.ejercicioContable.findUnique({ where: { id }, select: resumenSelect })
}

/** Modo y vínculo actuales de un ejercicio. */
export async function findConfigAnterior(
  id: string,
): Promise<(ConfigAnterior & { anteriorAjustadoEn: Date | null }) | null> {
  if (!esUuid(id)) return null
  return db.ejercicioContable.findUnique({
    where: { id },
    select: { modoAnterior: true, ejercicioAnteriorId: true, anteriorAjustadoEn: true },
  })
}

/** Máximo de saltos al recorrer la cadena de anteriores (protección contra datos corruptos). */
const MAX_SALTOS_CADENA = 100

/**
 * Ids de la cadena de anteriores a partir de `desdeId` (el anterior de ese, el anterior
 * del anterior, ...). Corta a 100 saltos y en el primer id repetido (ciclo).
 *
 * Una sola consulta recursiva: antes era una consulta por año, una detrás de otra
 * (15 años = 15 viajes a la base). Nombres de tabla y columna escritos a mano: si cambian
 * en el esquema, hay que cambiarlos acá (lo cubre la prueba de integración de la cadena).
 */
export async function findCadenaAnterior(desdeId: string): Promise<string[]> {
  if (!esUuid(desdeId)) return []
  const filas = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE cadena (id, nivel) AS (
      SELECT e."ejercicio_anterior_id", 1
        FROM "ejercicios_contables" e
       WHERE e."id" = ${desdeId}
      UNION ALL
      SELECT e."ejercicio_anterior_id", c.nivel + 1
        FROM cadena c
        JOIN "ejercicios_contables" e ON e."id" = c.id
       WHERE c.nivel < ${MAX_SALTOS_CADENA}
    )
    SELECT id FROM cadena WHERE id IS NOT NULL ORDER BY nivel`
  const cadena: string[] = []
  for (const { id } of filas) {
    if (cadena.includes(id)) break
    cadena.push(id)
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

/**
 * Cambia el estado solo si el ejercicio sigue en `desde`: si otro lo cambió entre la lectura y la
 * escritura, no matchea y Prisma avisa que no lo encontró.
 */
export async function cambiarEstado(
  id: string,
  desde: EstadoEjercicio,
  hacia: EstadoEjercicio,
): Promise<EjercicioContableDTO> {
  const e = await db.ejercicioContable.update({
    where: { id, estado: desde },
    data: { estado: hacia },
    include: { auditor: auditorSelect },
  })
  return toEjercicioDTO(e)
}

/** Solo se borra un ejercicio en Borrador (también en la condición, por si cambió recién). */
export async function deleteEjercicio(id: string): Promise<void> {
  await db.ejercicioContable.delete({ where: { id, estado: 'BORRADOR' } })
}

/** Revoca la confirmación de estados cuando se hace un cambio que puede descuadrar el balance. */
export async function resetEstadosConfirmado(ejercicioId: string): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: { estadosConfirmado: false },
  })
}

/** Texto de la Nota 1 escrito por el contador; null vuelve al que genera la app. */
export async function guardarNotaUno(ejercicioId: string, texto: string | null): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: { notaUnoTexto: texto, notaUnoEditadaEn: texto === null ? null : new Date() },
  })
}

/** El E.E.P.N. cambió: se vuelve a confirmar, y también los estados que lo usan. */
export async function desconfirmarPN(ejercicioId: string): Promise<void> {
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: { pnConfirmado: false, estadosConfirmado: false },
  })
}

/** Autorización explícita de los saldos del ejercicio anterior cargados a mano. */
export async function autorizarComparativo(
  ejercicioId: string,
  por: string,
  /** Si el ajuste cambia los importes, lo que ya se había confirmado se confirma de nuevo. */
  desconfirmar: boolean,
): Promise<void> {
  const ahora = new Date()
  await db.ejercicioContable.update({
    where: { id: ejercicioId },
    data: {
      comparativoAutorizadoEn: ahora,
      comparativoAutorizadoPor: por,
      anteriorAjustadoEn: ahora,
      ...(desconfirmar ? { estadosConfirmado: false, pnConfirmado: false } : {}),
    },
  })
}

/**
 * Cualquier escritura sobre la columna "Ejercicio anterior" invalida la autorización
 * y la confirmación de estados (sus números cambiaron). La base quita también el ajuste.
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
