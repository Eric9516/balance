import React from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import type { AnteriorDesdeDetalle, RubroFila } from '../domain/types'
import {
  SECCIONES_PASIVO,
  SSP_STRUCTURE,
  patrimonioNetoSSP,
  rubrosDeSeccion,
  sumarSeccion,
  sumarSecciones,
} from '../domain/estructuraSSP'
import { calcularCuadreSP } from '../lib/cuadre'
import { esRubroHuerfano } from '../lib/rubroHuerfano'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'
import { ThCargado, TdCargado } from '@/modules/comparativo-manual/components/ColumnaCargado'
import { claveConcepto } from '@/modules/notas/domain/types'
import { SECCION_SSP_LABELS } from '@/modules/rubros-base/domain/secciones'
import {
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import { sumar } from '@/lib/importe'

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const TH_IMPORTE =
  'w-44 px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase'
const TH_FECHA = 'text-[10px] font-normal tracking-normal text-slate-400'

/**
 * Encabezados de las columnas de importes: "Ejercicio actual" / "Ejercicio anterior",
 * cada uno con su fecha de cierre debajo. Compartido por SSP y EERR para no duplicar
 * la regla. Si la columna anterior viene del ejercicio vinculado (no editable), muestra
 * un candado con el origen. Va dentro del <tr> del <thead>, después de "Concepto".
 */
export function EncabezadosEjercicio({
  fechaCierre,
  fechaCierreAnterior,
  mostrarAnterior,
  anteriorBloqueado,
  anteriorDenominacion,
  verCargado = false,
}: {
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  mostrarAnterior: boolean
  anteriorBloqueado: boolean
  anteriorDenominacion: string | null
  /** Anterior manual ya ajustado: agrega la columna con lo cargado. */
  verCargado?: boolean
}) {
  const tituloCandado = anteriorDenominacion
    ? `Tomado de ${anteriorDenominacion}`
    : 'Cargado a mano y ajustado por inflación'
  return (
    <>
      <th className={TH_IMPORTE}>
        <div>Ejercicio actual</div>
        <div className={TH_FECHA}>{formatFecha(fechaCierre)}</div>
      </th>
      {mostrarAnterior && (
        <th className={TH_IMPORTE}>
          <div className="flex items-center justify-end gap-1">
            {anteriorBloqueado && (
              <span className="inline-flex" title={tituloCandado} aria-label={tituloCandado}>
                <Lock className="h-3 w-3 text-slate-400" />
              </span>
            )}
            <span>Ejercicio anterior</span>
          </div>
          {fechaCierreAnterior && (
            <div className={TH_FECHA}>{formatFecha(fechaCierreAnterior)}</div>
          )}
        </th>
      )}
      {verCargado && <ThCargado />}
    </>
  )
}

function TotalRow({
  label,
  value,
  valueAnt,
  mostrarAnterior = false,
  variant = 'section',
  cargado,
}: {
  label: string
  value: number
  valueAnt?: number
  mostrarAnterior?: boolean
  variant?: 'section' | 'bloque' | 'final'
  cargado?: number
}) {
  const isNegative = value < 0
  const antNegative = (valueAnt ?? 0) < 0
  return (
    <tr
      className={cn(
        variant === 'final'
          ? 'border-t-2 border-slate-900 bg-slate-900 text-white'
          : variant === 'bloque'
            ? 'border-t border-slate-300 bg-slate-100'
            : 'border-t border-slate-100 bg-slate-50',
      )}
    >
      <td
        className={cn(
          'px-4 py-2 text-sm',
          variant === 'final'
            ? 'font-bold text-white'
            : variant === 'bloque'
              ? 'font-semibold text-slate-800'
              : 'font-medium text-slate-600',
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          'px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums',
          variant === 'final' ? 'text-white' : isNegative ? 'text-red-600' : 'text-slate-900',
        )}
      >
        {formatCurrency(value)}
      </td>
      {mostrarAnterior && (
        <td
          className={cn(
            'px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums',
            variant === 'final'
              ? 'text-slate-200'
              : antNegative
                ? 'text-red-500'
                : 'text-slate-600',
          )}
        >
          {formatCurrency(valueAnt ?? 0)}
        </td>
      )}
      {cargado !== undefined && <TdCargado valor={cargado} fuerte oscuro={variant === 'final'} />}
    </tr>
  )
}

function nombreNota(a: AnteriorDesdeDetalle): string {
  if (a.fuente === 'ANEXO_I') return 'el Anexo I'
  return a.notaNumero != null ? `la Nota N° ${a.notaNumero}` : `la nota "${a.notaTitulo}"`
}

function hrefDetalle(a: AnteriorDesdeDetalle): string {
  if (a.fuente === 'ANEXO_I') return '?paso=anexos&anexo=bienes-de-uso'
  return a.notaId ? `?paso=notas#nota-${a.notaId}` : '?paso=notas'
}

function tituloAnterior(a: AnteriorDesdeDetalle): string {
  const antes = a.estado === 'ESCRITO_ANTES' ? 'Importe escrito a mano en el estado. ' : ''
  if (a.fuente === 'ANEXO_I') {
    return a.estado === 'CARGADO'
      ? 'Suma del neto residual del ejercicio anterior del Anexo I. Para cambiarlo, editá el Anexo I.'
      : `${antes}El anterior de este rubro se carga en el Anexo I: neto residual del ejercicio anterior por categoría.`
  }
  if (a.notaId === null) {
    return `${antes}El anterior de este rubro se carga en su nota, cuenta por cuenta: generá las notas y cargalo ahí.`
  }
  switch (a.estado) {
    case 'CARGADO':
      return `Total de la columna "Ejercicio anterior" de ${nombreNota(a)}. Para cambiarlo, editá la nota.`
    case 'ESCRITO_ANTES':
      return `${antes}Ahora el anterior se carga en ${nombreNota(a)}, cuenta por cuenta: apenas lo cargues ahí, reemplaza este importe.`
    case 'PENDIENTE':
      return `El anterior de este rubro se carga en ${nombreNota(a)}, cuenta por cuenta.`
  }
}

/** Importe anterior de un rubro que se carga en su detalle: candado, aviso y acceso al detalle. */
function AnteriorDeDetalle({ rubro, a }: { rubro: RubroFila; a: AnteriorDesdeDetalle }) {
  const titulo = tituloAnterior(a)
  const ir = a.fuente === 'NOTA' && a.notaId === null ? 'Ir a Notas' : `Ir a ${nombreNota(a)}`
  return (
    <div className="flex items-center justify-end gap-1">
      {a.estado === 'ESCRITO_ANTES' && (
        <span className="inline-flex" title={titulo} aria-label={titulo}>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </span>
      )}
      <CeldaBloqueada value={rubro.displayValueAnt} titulo={titulo} className="px-1" />
      <Link
        href={hrefDetalle(a)}
        title={ir}
        aria-label={ir}
        className="rounded p-0.5 text-blue-600 transition-colors hover:bg-blue-50"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/**
 * Importe anterior de cada cuenta según la nota (mismo criterio que la generación de notas:
 * concepto = nombre de la cuenta) y las filas de la nota que no son cuentas de este ejercicio.
 */
function anteriorPorCuenta(rubro: RubroFila) {
  const filas = rubro.anteriorDesdeDetalle?.filas ?? []
  const porConcepto = new Map<string, number>()
  for (const f of filas) {
    const clave = claveConcepto(f.concepto)
    porConcepto.set(clave, sumar(porConcepto.get(clave), f.importeAnterior))
  }
  const nombres = new Set(rubro.cuentas.map((c) => claveConcepto(c.nombre)))
  const soloAnterior = filas.filter(
    (f) => f.importeAnterior !== 0 && !nombres.has(claveConcepto(f.concepto)),
  )
  return { porConcepto, soloAnterior }
}

function RubroExpandableRow({
  rubro,
  expanded,
  onToggle,
  deduccion,
  mostrarAnterior = false,
  editarAnterior = false,
  comparativo,
  ejercicioId,
  sociedadId,
  cargado,
}: {
  rubro: RubroFila
  expanded: boolean
  onToggle: () => void
  deduccion?: boolean
  mostrarAnterior?: boolean
  editarAnterior?: boolean
  comparativo?: ReturnType<typeof useComparativoLote>
  ejercicioId?: string
  sociedadId?: string
  cargado?: number
}) {
  const displayText = deduccion
    ? `(${formatCurrency(Math.abs(rubro.displayValue))})`
    : formatCurrency(rubro.displayValue)
  const isNegative = rubro.displayValue < 0
  const huerfano = esRubroHuerfano(rubro.id)
  const desdeNota = rubro.anteriorDesdeDetalle
  const antCuentas = anteriorPorCuenta(rubro)
  const formatear = (v: number) =>
    deduccion ? `(${formatCurrency(Math.abs(v))})` : formatCurrency(v)

  // ── Fila huérfana (solo período anterior): sin expand, con borrar ───────────
  if (huerfano) {
    return (
      <tr className="border-b border-slate-100 hover:bg-acento-suave">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-600 uppercase">
              solo anterior
            </span>
            <span className="text-sm text-slate-700">{rubro.nombre}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums">—</td>
        {mostrarAnterior && (
          <td className="px-2 py-2 text-right">
            {editarAnterior && ejercicioId && sociedadId && comparativo ? (
              <div className="flex items-center justify-end gap-1">
                <div className="w-36">
                  <CeldaNumero
                    value={comparativo.entradas.get(rubro.id)?.valor ?? rubro.displayValueAnt}
                    editando
                    onSave={(v) => comparativo.setValor(rubro.id, v)}
                  />
                </div>
                <EliminarFilaAnterior
                  ejercicioId={ejercicioId}
                  sociedadId={sociedadId}
                  modulo="SSP"
                  clave={rubro.id}
                  onDeleted={() => comparativo.quitar(rubro.id)}
                />
              </div>
            ) : (
              <span className="font-mono text-sm text-slate-500 tabular-nums">
                {formatCurrency(rubro.displayValueAnt)}
              </span>
            )}
          </td>
        )}
        {cargado !== undefined && <TdCargado valor={cargado} />}
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-slate-100 transition-colors hover:bg-acento-suave">
        <td className="cursor-pointer px-4 py-2.5" onClick={onToggle}>
          <div className="flex items-center gap-1.5">
            <span className="flex-shrink-0 text-slate-400">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="text-sm text-slate-700">{rubro.nombre}</span>
            <span className="font-mono text-xs text-slate-400">({rubro.cuentas.length})</span>
          </div>
        </td>
        <td
          className={cn(
            'cursor-pointer px-4 py-2.5 text-right font-mono text-sm tabular-nums',
            isNegative ? 'text-red-600' : 'text-slate-700',
          )}
          onClick={onToggle}
        >
          {displayText}
        </td>
        {mostrarAnterior && (
          <td className="px-2 py-2 text-right">
            {desdeNota ? (
              <AnteriorDeDetalle rubro={rubro} a={desdeNota} />
            ) : editarAnterior && ejercicioId && sociedadId && comparativo ? (
              <div className="ml-auto w-36">
                <CeldaNumero
                  value={comparativo.entradas.get(rubro.id)?.valor ?? rubro.displayValueAnt}
                  editando
                  onSave={(v) => comparativo.setValor(rubro.id, v)}
                />
              </div>
            ) : (
              <span className="font-mono text-sm text-slate-500 tabular-nums">
                {formatCurrency(rubro.displayValueAnt)}
              </span>
            )}
          </td>
        )}
        {cargado !== undefined && <TdCargado valor={cargado} />}
      </tr>
      {expanded && (
        <>
          {rubro.cuentas.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 bg-slate-50/40">
              <td className="py-1.5 pr-4 pl-10">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{c.codigo}</span>
                  <span className="text-xs text-slate-500">{c.nombre}</span>
                </div>
              </td>
              <td
                className={cn(
                  'px-4 py-1.5 text-right font-mono text-[11px] tabular-nums',
                  c.displayValue < 0 ? 'text-red-500' : 'text-slate-500',
                )}
              >
                {formatear(c.displayValue)}
              </td>
              {mostrarAnterior && (
                <td className="px-4 py-1.5 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                  {desdeNota && antCuentas.porConcepto.has(claveConcepto(c.nombre))
                    ? formatear(antCuentas.porConcepto.get(claveConcepto(c.nombre)) ?? 0)
                    : null}
                </td>
              )}
              {cargado !== undefined && <TdCargado valor={null} />}
            </tr>
          ))}
          {mostrarAnterior &&
            antCuentas.soloAnterior.map((f, i) => (
              <tr key={`ant-${i}`} className="border-b border-slate-50 bg-slate-50/40">
                <td className="py-1.5 pr-4 pl-10">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded border border-amber-200 bg-amber-50 px-1 text-[10px] text-amber-600 uppercase">
                      solo anterior
                    </span>
                    <span className="text-xs text-slate-500">{f.concepto}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-[11px] text-slate-300 tabular-nums">
                  —
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                  {formatear(f.importeAnterior)}
                </td>
                {cargado !== undefined && <TdCargado valor={null} />}
              </tr>
            ))}
        </>
      )}
    </>
  )
}

// ─── SSP Tab ──────────────────────────────────────────────────────────────────

export function SSPTab({
  sspRubros,
  patrimonioNetoFinal,
  patrimonioNetoFinalAnt,
  expanded,
  onToggle,
  mostrarAnterior,
  editarAnterior,
  comparativo,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  anteriorBloqueado,
  anteriorDenominacion,
  cargado = null,
}: {
  sspRubros: RubroFila[]
  patrimonioNetoFinal: number | null
  patrimonioNetoFinalAnt: number | null
  expanded: Set<string>
  onToggle: (id: string) => void
  mostrarAnterior: boolean
  editarAnterior: boolean
  comparativo: ReturnType<typeof useComparativoLote>
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  /** Columna anterior tomada del ejercicio vinculado (candado en el encabezado). */
  anteriorBloqueado: boolean
  anteriorDenominacion: string | null
  /** Anterior manual ya ajustado, con la columna visible: los mismos rubros con lo cargado. */
  cargado?: { sspRubros: RubroFila[]; patrimonioNetoFinalAnt: number | null } | null
}) {
  const cargadoDe = (id: string) =>
    cargado ? (cargado.sspRubros.find((r) => r.id === id)?.displayValueAnt ?? 0) : undefined
  const cargadoSeccion = (key: string) =>
    cargado ? sumarSeccion(cargado.sspRubros, key, 'anterior') : undefined
  const cargadoPN = cargado
    ? patrimonioNetoSSP(cargado.sspRubros, cargado.patrimonioNetoFinalAnt, 'anterior')
    : undefined
  const cargadoBloque = (sections: readonly string[]) =>
    cargado ? sumarSecciones(cargado.sspRubros, sections, 'anterior') : undefined
  // Estructura y sumas: fuente única con el documento imprimible (domain/estructuraSSP).
  const getSeccionRubros = (seccionKey: string) => rubrosDeSeccion(sspRubros, seccionKey)
  const seccionTotal = (seccionKey: string) => sumarSeccion(sspRubros, seccionKey, 'actual')
  const seccionTotalAnt = (seccionKey: string) => sumarSeccion(sspRubros, seccionKey, 'anterior')
  const bloqueTotal = (sections: readonly string[]) => sumarSecciones(sspRubros, sections, 'actual')
  const bloqueTotalAnt = (sections: readonly string[]) =>
    sumarSecciones(sspRubros, sections, 'anterior')

  const totalPasivo = bloqueTotal(SECCIONES_PASIVO)
  const totalPasivoAnt = bloqueTotalAnt(SECCIONES_PASIVO)
  const totalPN = patrimonioNetoSSP(sspRubros, patrimonioNetoFinal, 'actual')
  const totalPNAnt = patrimonioNetoSSP(sspRubros, patrimonioNetoFinalAnt, 'anterior')
  const totalPasivoPN = sumar(totalPasivo, totalPN)
  const totalPasivoPNAnt = sumar(totalPasivoAnt, totalPNAnt)
  const { diferencia: diferenciaCuadre, cuadrado } = calcularCuadreSP(
    sspRubros,
    patrimonioNetoFinal,
  )

  const colSpan = (mostrarAnterior ? 3 : 2) + (cargado ? 1 : 0)

  return (
    <div>
      {/* Cuadre indicator */}
      <div
        className={cn(
          'mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
          cuadrado
            ? 'border border-emerald-200 bg-emerald-50'
            : 'border border-amber-200 bg-amber-50',
        )}
      >
        {cuadrado ? (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
        )}
        <span className={cuadrado ? 'text-emerald-700' : 'text-amber-700'}>
          {cuadrado
            ? 'Balance cuadrado - Activo = Pasivo + Patrimonio Neto'
            : `Descuadre de ${formatCurrency(Math.abs(diferenciaCuadre), { decimales: 'todos' })} — revisá las clasificaciones`}
        </span>
      </div>

      {editarAnterior && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
          Los rubros con nota se cargan en su nota, cuenta por cuenta, y bienes de uso en el Anexo
          I: acá se ve el total, con candado (la flecha lleva a donde se carga). Los demás se cargan
          en la columna de la derecha. Usá
          <em> “Agregar rubro del período anterior” </em> dentro de cada sección para rubros que el
          ejercicio actual no tiene.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-encabezado">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Concepto
              </th>
              <EncabezadosEjercicio
                fechaCierre={fechaCierre}
                fechaCierreAnterior={fechaCierreAnterior}
                mostrarAnterior={mostrarAnterior}
                anteriorBloqueado={anteriorBloqueado}
                anteriorDenominacion={anteriorDenominacion}
                verCargado={Boolean(cargado)}
              />
            </tr>
          </thead>
          <tbody>
            {SSP_STRUCTURE.map(({ bloque, sections, totalLabel }) => {
              const bloqueHasData =
                editarAnterior ||
                sections.some((s) => getSeccionRubros(s).length > 0) ||
                (bloque === 'PATRIMONIO NETO' && patrimonioNetoFinal !== null)
              if (!bloqueHasData) return null
              const esPN = bloque === 'PATRIMONIO NETO'

              return (
                <React.Fragment key={bloque}>
                  {/* Bloque header */}
                  <tr className="border-b border-slate-200 bg-slate-800">
                    <td
                      colSpan={colSpan}
                      className="px-4 py-2 text-xs font-bold tracking-widest text-slate-300 uppercase"
                    >
                      {bloque}
                    </td>
                  </tr>

                  {/* Regla: PN no muestra rubros individuales — el detalle va en el E.E.P.N. */}
                  {!esPN &&
                    sections.map((secKey) => {
                      const rubros = getSeccionRubros(secKey)
                      // En modo edición mostramos la sección aunque esté vacía (para agregar).
                      if (rubros.length === 0 && !editarAnterior) return null
                      const showSubHeader = sections.length > 1

                      return (
                        <React.Fragment key={secKey}>
                          {showSubHeader && (
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <td
                                colSpan={colSpan}
                                className="px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                              >
                                {SECCION_SSP_LABELS[secKey]}
                              </td>
                            </tr>
                          )}
                          {rubros.map((r) => (
                            <RubroExpandableRow
                              key={r.id}
                              rubro={r}
                              expanded={expanded.has(r.id)}
                              onToggle={() => onToggle(r.id)}
                              mostrarAnterior={mostrarAnterior}
                              editarAnterior={editarAnterior}
                              comparativo={comparativo}
                              ejercicioId={ejercicioId}
                              sociedadId={sociedadId}
                              cargado={cargadoDe(r.id)}
                            />
                          ))}
                          {editarAnterior && (
                            <tr>
                              <td colSpan={colSpan} className="px-4 py-2">
                                <AgregarFilaAnterior
                                  ejercicioId={ejercicioId}
                                  sociedadId={sociedadId}
                                  modulo="SSP"
                                  seccion={secKey}
                                  ordenBase={rubros.length}
                                  texto={`Agregar rubro a ${SECCION_SSP_LABELS[secKey]}`}
                                  onAdded={(dto) =>
                                    comparativo.agregar({
                                      modulo: dto.modulo,
                                      clave: dto.clave,
                                      label: dto.label,
                                      valor: dto.valor,
                                      esHuerfano: true,
                                      orden: dto.orden,
                                    })
                                  }
                                />
                              </td>
                            </tr>
                          )}
                          {showSubHeader && rubros.length > 0 && (
                            <TotalRow
                              label={`Subtotal ${SECCION_SSP_LABELS[secKey]}`}
                              value={seccionTotal(secKey)}
                              valueAnt={seccionTotalAnt(secKey)}
                              mostrarAnterior={mostrarAnterior}
                              variant="section"
                              cargado={cargadoSeccion(secKey)}
                            />
                          )}
                        </React.Fragment>
                      )
                    })}

                  {/* Para PN: una sola línea con el total y referencia al E.E.P.N. */}
                  {esPN && (
                    <tr className="border-b border-slate-100 hover:bg-acento-suave">
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        Patrimonio Neto
                        <span className="ml-2 text-xs text-slate-400">(Ver E.E.P.N.)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-700 tabular-nums">
                        {formatCurrency(totalPN)}
                      </td>
                      {mostrarAnterior && (
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-500 tabular-nums">
                          {formatCurrency(totalPNAnt)}
                        </td>
                      )}
                      {cargadoPN !== undefined && <TdCargado valor={cargadoPN} />}
                    </tr>
                  )}

                  <TotalRow
                    label={totalLabel}
                    value={esPN ? totalPN : bloqueTotal(sections)}
                    valueAnt={esPN ? totalPNAnt : bloqueTotalAnt(sections)}
                    mostrarAnterior={mostrarAnterior}
                    variant="bloque"
                    cargado={esPN ? cargadoPN : cargadoBloque(sections)}
                  />
                </React.Fragment>
              )
            })}

            {/* Rubros huérfanos legacy (sin sección): existían antes, ya no hoy */}
            {(() => {
              const huerfanos = sspRubros.filter(
                (r) => r.seccionSSP === null && (r.displayValueAnt !== 0 || esRubroHuerfano(r.id)),
              )
              if (huerfanos.length === 0) return null
              return (
                <React.Fragment>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <td
                      colSpan={colSpan}
                      className="px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                    >
                      Del período anterior
                    </td>
                  </tr>
                  {huerfanos.map((r) => (
                    <RubroExpandableRow
                      key={r.id}
                      rubro={r}
                      expanded={expanded.has(r.id)}
                      onToggle={() => onToggle(r.id)}
                      mostrarAnterior={mostrarAnterior}
                      editarAnterior={editarAnterior}
                      comparativo={comparativo}
                      ejercicioId={ejercicioId}
                      sociedadId={sociedadId}
                      cargado={cargadoDe(r.id)}
                    />
                  ))}
                </React.Fragment>
              )
            })()}
          </tbody>
          <tfoot>
            <TotalRow
              label="TOTAL PASIVO + PATRIMONIO NETO"
              value={totalPasivoPN}
              valueAnt={totalPasivoPNAnt}
              mostrarAnterior={mostrarAnterior}
              variant="final"
              cargado={cargado ? sumar(cargadoBloque(SECCIONES_PASIVO), cargadoPN) : undefined}
            />
          </tfoot>
        </table>
      </div>
    </div>
  )
}
