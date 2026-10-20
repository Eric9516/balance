import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { idAnteriorDerivable } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { toDocumentoDTO, type DocumentoEjercicioDTO } from '../domain/types'
import type { TipoDoc } from '../domain/reglas'
import { importe } from '@/lib/importe'

// ─── Saldos del balance, indexados por CÓDIGO de rubro ───────────────────────
// Reusa la misma fuente que aggregate.ts: suma de saldoFinal de las cuentas,
// agrupadas por rubroBaseId, mapeadas a RubroBase.codigo.

export async function saldoPorCodigoRubro(ejercicioId: string): Promise<Map<string, number>> {
  const [grupos, rubros] = await Promise.all([
    db.cuentaContable.groupBy({
      by: ['rubroBaseId'],
      where: { ejercicioId, rubroBaseId: { not: null } },
      _sum: { saldoFinal: true },
    }),
    db.rubroBase.findMany({ select: { id: true, codigo: true } }),
  ])
  const codigoDe = new Map(rubros.map((r) => [r.id, r.codigo]))
  const out = new Map<string, number>()
  for (const g of grupos) {
    const cod = g.rubroBaseId ? codigoDe.get(g.rubroBaseId) : undefined
    if (cod) out.set(cod, importe(g._sum.saldoFinal))
  }
  return out
}

/** Catálogo código → nombre, para mostrar el "por qué" de una sugerencia. */
export async function nombrePorCodigoRubro(): Promise<Map<string, string>> {
  const rubros = await db.rubroBase.findMany({ select: { codigo: true, nombre: true } })
  return new Map(rubros.map((r) => [r.codigo, r.nombre]))
}

/**
 * Títulos de las notas YA generadas (normalizados a MAYÚSCULAS), para detectar
 * qué notas ya existen y no volver a sugerirlas. El generador titula cada nota
 * como `rubro.nombre.toUpperCase()`, así que se matchea por nombre de rubro.
 */
export async function findTitulosNotas(ejercicioId: string): Promise<Set<string>> {
  const rows = await db.notaEjercicio.findMany({
    where: { ejercicioId },
    select: { titulo: true },
  })
  return new Set(rows.map((r) => r.titulo.trim().toUpperCase()))
}

/** ¿El ejercicio tiene un Costo de Ventas (Anexo II) cargado? */
export async function existeCostoVentas(ejercicioId: string): Promise<boolean> {
  const row = await db.costoVentasEjercicio.findFirst({
    where: { ejercicioId },
    select: { id: true },
  })
  return row !== null
}

/**
 * ¿Hay cuentas en moneda extranjera?
 * PREPARADO pero no implementado: CuentaContable aún no tiene el dato.
 * Cuando exista (esMonedaExtranjera / monedaId), acá se hace el count y listo —
 * no hay que tocar el motor ni el catálogo de reglas.
 */
export async function hayCuentasEnMonedaExtranjera(_ejercicioId: string): Promise<boolean> {
  return false
}

// ─── Decisiones persistidas ──────────────────────────────────────────────────

export async function findDocumentosByEjercicio(
  ejercicioId: string,
): Promise<DocumentoEjercicioDTO[]> {
  const rows = await db.documentoEjercicio.findMany({
    where: { ejercicioId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toDocumentoDTO)
}

/**
 * Contexto del ejercicio que afecta la evaluación: anterior derivable (solo modo
 * VINCULADO, para la referencia blanda) y si es primera adopción de RT 54.
 */
export async function getContextoEjercicio(
  ejercicioId: string,
): Promise<{ ejercicioAnteriorId: string | null; esPrimeraAdopcion: boolean }> {
  const ej = await db.ejercicioContable.findUnique({
    where: { id: ejercicioId },
    select: { ejercicioAnteriorId: true, modoAnterior: true, adopcionRT54: true },
  })
  return {
    ejercicioAnteriorId: ej ? idAnteriorDerivable(ej) : null,
    esPrimeraAdopcion: ej?.adopcionRT54 === 'PRIMERA_ADOPCION',
  }
}

/**
 * Claves de regla que estaban ACEPTADAS en el ejercicio anterior.
 * Se usan SOLO como referencia (punto 6): no obligan ni heredan nada.
 */
export async function findReglasAceptadasAnterior(
  ejercicioAnteriorId: string,
): Promise<Set<string>> {
  const rows = await db.documentoEjercicio.findMany({
    where: { ejercicioId: ejercicioAnteriorId, estado: 'ACEPTADO', reglaClave: { not: null } },
    select: { reglaClave: true },
  })
  return new Set(rows.map((r) => r.reglaClave!))
}

/** Upsert de la decisión de una regla (clave no nula). */
export async function upsertDecisionRegla(input: {
  ejercicioId: string
  reglaClave: string
  tipo: TipoDoc
  titulo: string
  estado: 'ACEPTADO' | 'DESCARTADO' | 'NO_APLICA'
  saldoAlAceptar?: number | null
}): Promise<DocumentoEjercicioDTO> {
  const { ejercicioId, reglaClave, tipo, titulo, estado, saldoAlAceptar = null } = input
  const row = await db.documentoEjercicio.upsert({
    where: { ejercicioId_reglaClave: { ejercicioId, reglaClave } },
    create: { ejercicioId, reglaClave, tipo, titulo, estado, origen: 'AUTOMATICO', saldoAlAceptar },
    update: { estado, saldoAlAceptar },
  })
  return toDocumentoDTO(row)
}

/** Borra la decisión de una regla → la sugerencia vuelve a estado SUGERIDO. */
export async function deleteDecisionRegla(ejercicioId: string, reglaClave: string): Promise<void> {
  await db.documentoEjercicio.deleteMany({ where: { ejercicioId, reglaClave } })
}

/** Crea un documento manual (siempre ACEPTADO, sin regla asociada). */
export async function createDocumentoManual(input: {
  ejercicioId: string
  tipo: TipoDoc
  titulo: string
}): Promise<DocumentoEjercicioDTO> {
  const row = await db.documentoEjercicio.create({
    data: {
      ejercicioId: input.ejercicioId,
      reglaClave: null,
      tipo: input.tipo,
      titulo: input.titulo,
      estado: 'ACEPTADO',
      origen: 'MANUAL',
    },
  })
  return toDocumentoDTO(row)
}

/**
 * Borra un documento MANUAL solo si es de este ejercicio (los automáticos se descartan, no se
 * borran). Devuelve si borró.
 */
export async function deleteDocumentoManual(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.documentoEjercicio.deleteMany({
    where: { id, ejercicioId, origen: 'MANUAL' },
  })
  return count > 0
}
