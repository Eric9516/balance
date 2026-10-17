import { REGLAS, type EvalCtx } from '../domain/reglas'
import type { DocumentoEvaluado, MotivoRubro } from '../domain/types'
import {
  saldoPorCodigoRubro,
  nombrePorCodigoRubro,
  existeCostoVentas,
  hayCuentasEnMonedaExtranjera,
  findDocumentosByEjercicio,
  findTitulosNotas,
  getEjercicioAnteriorId,
  findReglasAceptadasAnterior,
} from '../repository/documento.repository'

// Umbral para considerar que un rubro "tiene saldo" (evita ruido de redondeo).
const EPSILON = 0.005

/**
 * Evalúa qué anexos/notas corresponden para un ejercicio.
 *
 * Principio (corrección punto 6/2026-06): SIEMPRE se evalúa según los SALDOS DEL
 * EJERCICIO ACTUAL, haya o no ejercicio anterior vinculado. El ejercicio anterior
 * NO decide qué documentos existen: solo se usa como REFERENCIA blanda (un anexo
 * que el año pasado se incluía y este año no tiene saldo se muestra como referencia,
 * sin sugerirlo ni obligarlo). Los comparativos del anterior van por otro camino
 * (comparativo-manual / ajuste.ts), no por acá.
 *
 * Garantías:
 *  - No genera documentos vacíos (regla sin saldo y sin decisión/referencia → no aparece).
 *  - No duplica (una fila por regla; merge por clave).
 *  - No hereda anexos del año anterior como definitivos.
 *  - No elimina nada automáticamente: si un ACEPTADO se queda sin saldo, se
 *    mantiene y se marca `advertenciaSaldoCero`.
 *  - Es PURO respecto de la DB: sólo lee, nunca escribe.
 */
export async function evaluarDocumentos(ejercicioId: string): Promise<DocumentoEvaluado[]> {
  const ejercicioAnteriorId = await getEjercicioAnteriorId(ejercicioId)
  const [
    saldos,
    nombres,
    costoVentasCargado,
    hayME,
    decididosList,
    titulosNotas,
    aceptadasAnterior,
  ] = await Promise.all([
    saldoPorCodigoRubro(ejercicioId),
    nombrePorCodigoRubro(),
    existeCostoVentas(ejercicioId),
    hayCuentasEnMonedaExtranjera(ejercicioId),
    findDocumentosByEjercicio(ejercicioId),
    findTitulosNotas(ejercicioId),
    ejercicioAnteriorId
      ? findReglasAceptadasAnterior(ejercicioAnteriorId)
      : Promise.resolve(new Set<string>()),
  ])

  const tiene = (cod: string) => Math.abs(saldos.get(cod) ?? 0) > EPSILON
  const ctx: EvalCtx = { saldos, tiene, costoVentasCargado, hayMonedaExtranjera: hayME }

  const decididos = new Map(
    decididosList.filter((d) => d.reglaClave).map((d) => [d.reglaClave!, d]),
  )

  const motivoDe = (rubros: string[]): MotivoRubro[] =>
    rubros.filter(tiene).map((codigo) => ({
      codigo,
      nombre: nombres.get(codigo) ?? codigo,
      saldo: saldos.get(codigo) ?? 0,
    }))

  // ── 1. Reglas del catálogo ──────────────────────────────────────────────────
  const desdeReglas: DocumentoEvaluado[] = []
  for (const r of REGLAS) {
    const corresponde = r.rubros.some(tiene) || r.cuando?.(ctx) === true
    const dec = decididos.get(r.clave)
    const motivo = motivoDe(r.rubros)
    // ¿Es una NOTA que ya fue generada en el paso "Notas"? (match por nombre de rubro)
    const notaCreada =
      r.tipo === 'NOTA' && motivo.some((m) => titulosNotas.has(m.nombre.trim().toUpperCase()))

    if (dec) {
      desdeReglas.push({
        clave: r.clave,
        tipo: r.tipo,
        titulo: r.titulo,
        estado: dec.estado,
        origen: dec.origen,
        esNuevo: false,
        corresponde,
        advertenciaSaldoCero: !corresponde && dec.estado === 'ACEPTADO',
        motivo,
        documentoId: dec.id,
      })
    } else if (notaCreada) {
      // La nota YA existe en el paso "Notas" → incluida automáticamente, no se sugiere.
      desdeReglas.push({
        clave: r.clave,
        tipo: r.tipo,
        titulo: r.titulo,
        estado: 'ACEPTADO',
        origen: 'AUTOMATICO',
        esNuevo: false,
        corresponde,
        advertenciaSaldoCero: false,
        autoGenerada: true,
        motivo,
      })
    } else if (corresponde) {
      // Saldo este año y sin decisión → sugerencia (sirve para rubros NUEVOS,
      // existiera o no el año anterior — punto 7).
      desdeReglas.push({
        clave: r.clave,
        tipo: r.tipo,
        titulo: r.titulo,
        estado: 'SUGERIDO',
        origen: 'AUTOMATICO',
        esNuevo: true,
        corresponde: true,
        advertenciaSaldoCero: false,
        motivo,
      })
    } else if (aceptadasAnterior.has(r.clave)) {
      // Sin saldo este año, pero el año pasado se incluía → REFERENCIA blanda
      // (punto 6): no se sugiere ni se obliga; el contador decide incluirlo o no.
      desdeReglas.push({
        clave: r.clave,
        tipo: r.tipo,
        titulo: r.titulo,
        estado: 'SUGERIDO',
        origen: 'AUTOMATICO',
        esNuevo: false,
        corresponde: false,
        advertenciaSaldoCero: false,
        referenciaAnioAnterior: true,
        motivo: [],
      })
    }
    // regla que no corresponde, sin decisión y sin referencia → no se agrega (nada vacío)
  }

  // ── 2. Documentos manuales (sin regla) ──────────────────────────────────────
  const manuales: DocumentoEvaluado[] = decididosList
    .filter((d) => !d.reglaClave)
    .map((d) => ({
      clave: d.id,
      tipo: d.tipo,
      titulo: d.titulo,
      estado: d.estado,
      origen: d.origen,
      esNuevo: false,
      corresponde: true,
      advertenciaSaldoCero: false,
      motivo: [],
      documentoId: d.id,
    }))

  return [...desdeReglas, ...manuales]
}

/**
 * Resumen liviano para el stepper / badges, sin traer todo el detalle.
 * Sirve para que el stepper use evaluarDocumentos() como fuente única.
 */
export async function resumenDocumentos(ejercicioId: string) {
  const docs = await evaluarDocumentos(ejercicioId)
  return {
    total: docs.length,
    sugeridos: docs.filter((d) => d.estado === 'SUGERIDO' && !d.referenciaAnioAnterior).length,
    aceptados: docs.filter((d) => d.estado === 'ACEPTADO').length,
    referencias: docs.filter((d) => d.referenciaAnioAnterior).length,
    conAdvertencia: docs.filter((d) => d.advertenciaSaldoCero).length,
    /** ¿Existe un anexo/nota aceptado para una regla puntual? (reemplazo de flags fijos) */
    aceptadoPorClave: (clave: string) =>
      docs.some((d) => d.clave === clave && d.estado === 'ACEPTADO'),
  }
}
