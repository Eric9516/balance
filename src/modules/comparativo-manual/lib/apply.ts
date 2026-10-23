/**
 * Aplica los comparativos manuales a los datos de estados y gastos.
 * Puro — no modifica los originales, devuelve copias con los valores sobreescritos.
 */

import type { EstadosData, EERRData, RubroFila } from '@/modules/estados/domain/types'
import type {
  GastosSecciones,
  GastoSeccion,
} from '@/modules/gastos/repository/gastos-dinamico.repository'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import { esRubroHuerfano } from '@/modules/estados/lib/rubroHuerfano'
import { tieneAnteriorCargado, totalesNota, type NotaDTO } from '@/modules/notas/domain/types'
import { netoAnteriorManualBDU, type BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import { parsSeccionDeClaveHuerfano, type ComparativoManualDTO } from '../domain/types'
import { restar, sumar, sumarPor } from '@/lib/importe'

// ─── Aplicar comparativos al EstadosData (SSP + EERR) ────────────────────────

export function applyComparativosToEstados(
  data: EstadosData,
  comparativos: ComparativoManualDTO[],
  nivelSSP: 'SECCION' | 'RUBRO',
): EstadosData {
  const sspItems = comparativos.filter((c) => c.modulo === 'SSP')
  const eerrItems = comparativos.filter((c) => c.modulo === 'EERR')
  const gastosItems = comparativos.filter((c) => c.modulo === 'GASTOS')

  const eerrMap = new Map(eerrItems.map((c) => [c.clave, c.valor]))
  const gastosMap = new Map(gastosItems.map((c) => [c.clave, c.valor]))

  // ── SSP ────────────────────────────────────────────────────────────────────
  let sspRubros: RubroFila[] = data.sspRubros

  if (nivelSSP === 'RUBRO' && sspItems.length > 0) {
    const sspMap = new Map(sspItems.map((c) => [c.clave, c.valor]))
    // Override displayValueAnt para rubros existentes
    sspRubros = data.sspRubros.map((r) => ({
      ...r,
      displayValueAnt: sspMap.has(r.id) ? (sspMap.get(r.id) ?? 0) : r.displayValueAnt,
    }))
    // Agregar rubros huérfanos (existían antes, ya no existen)
    // Si el clave tiene sección codificada (sec:{seccion}:{ts}), se asigna
    // a la sección correcta y contribuye a sus totales.
    // Si no tiene sección (formato legacy), seccionSSP = null → aparece
    // en la sección "Del período anterior" al final del SSP.
    const huerfanos = sspItems.filter((c) => c.esHuerfano)
    for (const h of huerfanos) {
      const seccionSSP = parsSeccionDeClaveHuerfano(h.clave)
      sspRubros.push({
        id: h.clave,
        codigo: h.clave,
        nombre: h.label,
        estadoDestino: 'SSP',
        seccionSSP,
        seccionEERR: null,
        naturalezaEsperada: 'DEUDORA',
        orden: 9999 + h.orden,
        displayValue: 0,
        displayValueAnt: h.valor,
        notaNumero: null,
        cuentas: [],
      })
    }
  }

  // ── EERR ───────────────────────────────────────────────────────────────────
  const ingresosAnt = eerrMap.get('INGRESOS') ?? data.eerr.ingresosAnt
  const costoVentasAnt = eerrMap.get('COSTO_VENTAS') ?? data.eerr.costoVentasAnt
  const rfAnt = eerrMap.get('RESULTADOS_FINANCIEROS') ?? data.eerr.resultadosFinancierosAnt
  const igAnt = eerrMap.get('IMPUESTO_GANANCIAS') ?? data.eerr.impuestoGananciasAnt

  // Gastos: override totalAnt por sección + agregar secciones huérfanas
  const seccionesGasto = data.eerr.seccionesGasto.map((s) => ({
    ...s,
    totalAnt: gastosMap.has(s.key) ? (gastosMap.get(s.key) ?? 0) : s.totalAnt,
  }))
  const huerfanosGastos = gastosItems.filter((c) => c.esHuerfano)
  for (const h of huerfanosGastos) {
    seccionesGasto.push({ key: h.clave, nombre: h.label, total: 0, totalAnt: h.valor })
  }

  // Recalcular subtotales comparativos
  const totalGastosAnt = sumarPor(seccionesGasto, (s) => s.totalAnt)
  const utilidadBrutaAnt = restar(ingresosAnt, costoVentasAnt)
  const resultadoAntesIGAnt = sumar(restar(utilidadBrutaAnt, totalGastosAnt), rfAnt)
  const utilidadEjercicioAnt = restar(resultadoAntesIGAnt, igAnt)

  const eerr: EERRData = {
    ...data.eerr,
    ingresosAnt,
    costoVentasAnt,
    resultadosFinancierosAnt: rfAnt,
    impuestoGananciasAnt: igAnt,
    seccionesGasto,
    utilidadBrutaAnt,
    resultadoAntesIGAnt,
    utilidadEjercicioAnt,
  }

  return { ...data, sspRubros, eerr }
}

// ─── El anterior de cada rubro del SSP desde su nota ─────────────────────────

/**
 * Carga manual: el anterior de un rubro del SSP que lleva nota con detalle por cuenta se carga en
 * esa nota, una sola vez, y el estado toma su total; en el estado no se escribe. Si la nota todavía
 * no tiene el anterior, se muestra el importe que se hubiera escrito en el estado antes de esta
 * regla (los ejercicios ya cargados no cambian) o, si no hay, cero.
 *
 * `anteriorEnNotas`: los rubros que llevan nota con detalle (ver generaNotaCuantitativa) y su nota,
 * o null si las notas todavía no se generaron. `escritos`: los rubros con un importe escrito en el
 * estado (filas manuales del SSP).
 */
export function aplicarAnteriorDesdeNotas(
  data: EstadosData,
  anteriorEnNotas: Map<string, NotaDTO | null>,
  escritos: Set<string>,
): EstadosData {
  const sspRubros = data.sspRubros.map((r): RubroFila => {
    if (esRubroHuerfano(r.id) || !anteriorEnNotas.has(r.id)) return r
    const nota = anteriorEnNotas.get(r.id) ?? null
    const cargada = nota !== null && nota.tipo === 'CUANTITATIVA' && tieneAnteriorCargado(nota)
    // Sin nota cargada se conserva lo que ya tenía el rubro: lo escrito en el estado o, en bienes
    // de cambio, la existencia final del Anexo II.
    const estado = cargada ? 'CARGADO' : escritos.has(r.id) ? 'ESCRITO_ANTES' : 'PENDIENTE'
    return {
      ...r,
      displayValueAnt: cargada ? totalesNota(nota).anterior : r.displayValueAnt,
      anteriorDesdeDetalle: {
        fuente: 'NOTA',
        estado,
        notaId: nota?.id ?? null,
        notaNumero: nota?.numero ?? null,
        notaTitulo: nota?.titulo ?? null,
        filas: cargada
          ? nota.detalles
              .filter((d) => !d.esTotal)
              .map((d) => ({ concepto: d.concepto, importeAnterior: d.importeAnterior }))
          : [],
      },
    }
  })
  return { ...data, sspRubros }
}

/**
 * Carga manual: el anterior del rubro de bienes de uso es la suma del neto residual del ejercicio
 * anterior de las categorías del Anexo I, que se carga ahí; en el estado no se escribe. Solo si el
 * ejercicio tiene Anexo I. Sin neto anterior cargado, igual que con las notas: se muestra lo escrito
 * antes en el estado o queda pendiente.
 */
export function aplicarAnteriorDesdeAnexoI(
  data: EstadosData,
  anexoI: { rubroIds: Set<string>; categorias: BienDeUsoDTO[] } | undefined,
  escritos: Set<string>,
): EstadosData {
  if (!anexoI || anexoI.categorias.length === 0) return data
  const netos = anexoI.categorias.map(netoAnteriorManualBDU)
  const cargado = netos.some((n) => n != null)
  const total = sumarPor(netos, (n) => n)
  const sspRubros = data.sspRubros.map((r): RubroFila => {
    if (!anexoI.rubroIds.has(r.id)) return r
    const estado = cargado ? 'CARGADO' : escritos.has(r.id) ? 'ESCRITO_ANTES' : 'PENDIENTE'
    return {
      ...r,
      displayValueAnt: cargado ? total : r.displayValueAnt,
      anteriorDesdeDetalle: {
        fuente: 'ANEXO_I',
        estado,
        notaId: null,
        notaNumero: null,
        notaTitulo: null,
        filas: [],
      },
    }
  })
  return { ...data, sspRubros }
}

// ─── Aplicar comparativos al GastosSecciones ─────────────────────────────────

export function applyComparativosToGastos(
  data: GastosSecciones,
  comparativos: ComparativoManualDTO[],
): GastosSecciones {
  const gastosMap = new Map(
    comparativos.filter((c) => c.modulo === 'GASTOS').map((c) => [c.clave, c]),
  )

  const secciones: GastoSeccion[] = data.secciones.map((s) => ({
    ...s,
    totalAnterior: gastosMap.has(s.key)
      ? (gastosMap.get(s.key)?.valor ?? s.totalAnterior)
      : s.totalAnterior,
  }))

  // Secciones huérfanas: existían antes, ya no existen en el ejercicio actual
  const huerfanos = [...gastosMap.values()].filter((c) => c.esHuerfano)
  for (const h of huerfanos) {
    secciones.push({
      key: h.clave,
      grupoId: null,
      grupoNombre: h.label,
      grupoSigla: null,
      esGastoDefault: false,
      aparecEnEERR: true,
      filas: [],
      total: 0,
      totalAnterior: h.valor,
    })
  }

  return { ...data, secciones }
}

// ─── Construir CostoVentasDTO anterior desde comparativos manuales ────────────

export function buildCostoVentasAntFromComparativos(
  ejercicioId: string,
  comparativos: ComparativoManualDTO[],
  existenciaFinalPropuesta: number | null = null,
): CostoVentasDTO | null {
  const items = comparativos.filter((c) => c.modulo === 'COSTO_VENTAS')
  if (items.length === 0) return null
  const map = new Map(items.map((c) => [c.clave, c.valor]))
  return {
    id: 'manual',
    ejercicioId,
    existenciaInicial: map.get('existenciaInicial') ?? 0,
    compras: map.get('compras') ?? 0,
    gastosFabricacion: map.get('gastosFabricacion') ?? 0,
    // Sin escribir (o en cero), la propuesta desde la nota de bienes de cambio.
    existenciaFinal: map.get('existenciaFinal') || existenciaFinalPropuesta || 0,
  }
}
