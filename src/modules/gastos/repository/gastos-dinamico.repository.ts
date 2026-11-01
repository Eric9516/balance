import type { AnteriorManualFila } from '../domain/filasAnexo'
import { cache } from 'react'
import { db } from '@/lib/db'
import { SECCION_EERR_LABELS, SECCIONES_EERR_GASTO } from '@/modules/rubros-base/domain/secciones'
import { importe, sumar, sumarPor } from '@/lib/importe'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type GastoFila = {
  cuentaId: string
  cuentaNombre: string // nombre de la cuenta contable individual
  importe: number
  importeAnterior: number
}

export type GastoSeccion = {
  key: string
  grupoId: string | null
  grupoNombre: string
  grupoSigla: string | null
  esGastoDefault: boolean
  aparecEnEERR: boolean
  filas: GastoFila[]
  total: number
  totalAnterior: number
}

export type GastosSecciones = {
  /** Anterior manual ya ajustado: el mismo anexo con lo cargado, para mostrarlo al lado. */
  cargado?: GastosSecciones
  secciones: GastoSeccion[]
  /**
   * Ejercicio anterior fila por fila, cargado a mano. Solo en modo MANUAL (ver resolverGastos);
   * ausente cuando el anterior se deriva del ejercicio vinculado.
   */
  anteriorManualPorFila?: AnteriorManualFila[]
  todasSecciones: {
    key: string
    nombre: string
    sigla: string | null
    esGastoDefault: boolean
    aparecEnEERR: boolean
  }[]
}

// Secciones EERR legacy que van en el Anexo III
const EERR_GASTOS_LABELS = Object.fromEntries(
  SECCIONES_EERR_GASTO.map((s) => [s, SECCION_EERR_LABELS[s]]),
)

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Memoizado por request (React cache): los estados y la pantalla de gastos lo piden en el
 * mismo render. Solo lo usan lecturas.
 */
export const findGastosDinamicos = cache(_findGastosDinamicos)

async function _findGastosDinamicos(
  estudioId: string,
  ejercicioId: string,
  ejercicioAnteriorId: string | null,
): Promise<GastosSecciones> {
  // ── 1. Secciones personalizadas (RubroGrupo) ────────────────────────────────
  // Las siete lecturas dependen solo de los ids: una sola oleada, un solo viaje a la base.
  // Las cuentas de grupos de gasto se filtran por la relación (esGasto) y no por una lista
  // de ids, para no depender del resultado de gruposAll. El rubro de cada cuenta se toma del
  // catálogo (pedido en la misma oleada) y no con un `select` anidado, que Prisma resuelve con
  // una segunda consulta después de la primera.
  const whereGrupoGasto = { rubroBase: { rubroGrupo: { esGasto: true, activo: true } } }
  const whereLegacy = {
    rubroBase: { rubroGrupoId: null, seccionEERR: { in: [...SECCIONES_EERR_GASTO] } },
  }
  const legacyKeys = Object.keys(EERR_GASTOS_LABELS).map((k) => `legacy:${k}`)

  const [
    gruposAll,
    grupoActual,
    legacyActual,
    grupoAnterior,
    legacyAnterior,
    legacyConfigs,
    rubros,
  ] = await Promise.all([
    db.rubroGrupo.findMany({
      where: { estudioId, activo: true },
      select: {
        id: true,
        nombre: true,
        sigla: true,
        esGasto: true,
        aparecEnEERR: true,
        orden: true,
      },
      orderBy: { orden: 'asc' },
    }),
    // ── 2. Cuentas clasificadas bajo RubroGrupos de gasto (actual) ────────────
    db.cuentaContable.findMany({
      where: { ejercicioId, ...whereGrupoGasto },
      select: { id: true, nombre: true, saldoFinal: true, rubroBaseId: true },
      orderBy: { nombre: 'asc' },
    }),
    // ── 3. Cuentas clasificadas bajo secciones legacy EERR (actual) ───────────
    db.cuentaContable.findMany({
      where: { ejercicioId, ...whereLegacy },
      select: { id: true, nombre: true, saldoFinal: true, rubroBaseId: true },
      orderBy: { nombre: 'asc' },
    }),
    // ── 4. Lo mismo para ejercicio anterior ───────────────────────────────────
    ejercicioAnteriorId
      ? db.cuentaContable.findMany({
          where: { ejercicioId: ejercicioAnteriorId, ...whereGrupoGasto },
          select: { nombre: true, saldoFinal: true, rubroBaseId: true },
          orderBy: { nombre: 'asc' },
        })
      : Promise.resolve([]),
    ejercicioAnteriorId
      ? db.cuentaContable.findMany({
          where: { ejercicioId: ejercicioAnteriorId, ...whereLegacy },
          select: { nombre: true, saldoFinal: true, rubroBaseId: true },
          orderBy: { nombre: 'asc' },
        })
      : Promise.resolve([]),
    // ── 7. Config de secciones legacy (orden + aparecEnEERR) ──────────────────
    db.gastoSeccionConfig.findMany({ where: { estudioId, clave: { in: legacyKeys } } }),
    // ── Catálogo de rubros (grupo y sección de cada uno), en la misma oleada ──
    db.rubroBase.findMany({
      where: { estudioId },
      select: { id: true, rubroGrupoId: true, seccionEERR: true },
    }),
  ])

  const rubroPorId = new Map(rubros.map((r) => [r.id, r]))
  const conRubro = <T extends { rubroBaseId: string | null }>(cuentas: T[]) =>
    cuentas.map((c) => ({
      ...c,
      rubroBase: c.rubroBaseId ? (rubroPorId.get(c.rubroBaseId) ?? null) : null,
    }))
  const cuentasGrupoActual = conRubro(grupoActual)
  const cuentasLegacyActual = conRubro(legacyActual)
  const cuentasGrupoAnterior = conRubro(grupoAnterior)
  const cuentasLegacyAnterior = conRubro(legacyAnterior)

  // ── 5. Mapas de importe anterior por (key_seccion, nombre_cuenta) ────────────
  // key = `grupo:${grupoId}:${cuentaNombre}` o `legacy:${seccionEERR}:${cuentaNombre}`
  const anteriorMap = new Map<string, number>()

  for (const c of cuentasGrupoAnterior) {
    const key = `grupo:${c.rubroBase?.rubroGrupoId}:${c.nombre}`
    anteriorMap.set(key, sumar(anteriorMap.get(key), Math.abs(importe(c.saldoFinal))))
  }
  for (const c of cuentasLegacyAnterior) {
    const key = `legacy:${c.rubroBase?.seccionEERR}:${c.nombre}`
    anteriorMap.set(key, sumar(anteriorMap.get(key), Math.abs(importe(c.saldoFinal))))
  }

  /**
   * Cuentas de la sección que solo existieron en el ejercicio anterior: van al final, sin importe
   * actual y con su anterior. Sin ellas el anexo y el estado de resultados del anterior quedaban
   * cortos (vinculado: las filas salen de las cuentas de este año).
   */
  const filasSoloAnterior = (seccionKey: string, actuales: { nombre: string }[]): GastoFila[] => {
    const prefijo = `${seccionKey}:`
    const nombres = new Set(actuales.map((c) => c.nombre))
    return [...anteriorMap]
      .filter(([k]) => k.startsWith(prefijo) && !nombres.has(k.slice(prefijo.length)))
      .map(([k, valor]) => ({
        cuentaId: `anterior:${k}`,
        cuentaNombre: k.slice(prefijo.length),
        importe: 0,
        importeAnterior: valor,
      }))
  }

  // ── 6. Construir secciones de grupo personalizado ───────────────────────────
  const seccionesGrupo: GastoSeccion[] = gruposAll.map((g) => {
    const cuentas = cuentasGrupoActual.filter((c) => c.rubroBase?.rubroGrupoId === g.id)
    const filas: GastoFila[] = [
      ...cuentas.map((c) => ({
        cuentaId: c.id,
        cuentaNombre: c.nombre,
        importe: Math.abs(importe(c.saldoFinal)),
        importeAnterior: anteriorMap.get(`grupo:${g.id}:${c.nombre}`) ?? 0,
      })),
      ...filasSoloAnterior(`grupo:${g.id}`, cuentas),
    ]
    return {
      key: `grupo:${g.id}`,
      grupoId: g.id,
      grupoNombre: g.nombre,
      grupoSigla: g.sigla,
      esGastoDefault: g.esGasto,
      aparecEnEERR: g.aparecEnEERR,
      filas,
      total: sumarPor(filas, (f) => f.importe),
      totalAnterior: sumarPor(filas, (f) => f.importeAnterior),
    }
  })

  // ── 7. Config de secciones legacy (orden + aparecEnEERR) ─────────────────────
  // Solo lectura (ya cargada en la oleada inicial) — los registros se crean al primer
  // toggle/reorden desde las actions. Sin config: defaults (aparecEnEERR=true, orden=9999).
  const legacyConfigMap = new Map(legacyConfigs.map((c) => [c.clave, c]))

  // ── 8. Construir secciones legacy ────────────────────────────────────────────
  const seccionesLegacy: GastoSeccion[] = []
  for (const [seccionEERR, label] of Object.entries(EERR_GASTOS_LABELS)) {
    const key = `legacy:${seccionEERR}`
    const cuentas = cuentasLegacyActual.filter((c) => c.rubroBase?.seccionEERR === seccionEERR)
    const filas: GastoFila[] = [
      ...cuentas.map((c) => ({
        cuentaId: c.id,
        cuentaNombre: c.nombre,
        importe: Math.abs(importe(c.saldoFinal)),
        importeAnterior: anteriorMap.get(`${key}:${c.nombre}`) ?? 0,
      })),
      ...filasSoloAnterior(key, cuentas),
    ]
    if (filas.length === 0) continue
    const cfg = legacyConfigMap.get(key)
    seccionesLegacy.push({
      key,
      grupoId: null,
      grupoNombre: label,
      grupoSigla: null,
      esGastoDefault: true,
      aparecEnEERR: cfg?.aparecEnEERR ?? true,
      filas,
      total: sumarPor(filas, (f) => f.importe),
      totalAnterior: sumarPor(filas, (f) => f.importeAnterior),
    })
  }

  // ── 9. todasSecciones para el modal — orden unificado (custom + legacy juntos) ─
  const todasSinOrdenar = [
    ...seccionesGrupo.map((s) => ({
      key: s.key,
      nombre: s.grupoNombre,
      sigla: s.grupoSigla,
      esGastoDefault: s.esGastoDefault,
      aparecEnEERR: s.aparecEnEERR,
      orden: gruposAll.find((g) => `grupo:${g.id}` === s.key)?.orden ?? 9999,
    })),
    ...Object.entries(EERR_GASTOS_LABELS).map(([seccionEERR, label]) => {
      const key = `legacy:${seccionEERR}`
      const cfg = legacyConfigMap.get(key)
      return {
        key,
        nombre: label,
        sigla: null as string | null,
        esGastoDefault: true,
        aparecEnEERR: cfg?.aparecEnEERR ?? true,
        orden: cfg?.orden ?? 9999,
      }
    }),
  ]
  const todasSecciones = todasSinOrdenar.sort((a, b) => a.orden - b.orden)

  const secciones = [...seccionesGrupo.filter((s) => s.filas.length > 0), ...seccionesLegacy]

  return { secciones, todasSecciones }
}
