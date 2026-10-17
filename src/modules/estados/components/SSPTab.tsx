import React from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { RubroFila } from '../domain/types'
import { calcularCuadreSP } from '../lib/cuadre'
import { esRubroHuerfano } from '../lib/rubroHuerfano'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import {
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'

// ─── Constantes de estructura ─────────────────────────────────────────────────

const SSP_STRUCTURE = [
  {
    bloque: 'ACTIVO',
    sections: ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE'],
    totalLabel: 'TOTAL ACTIVO',
  },
  {
    bloque: 'PASIVO',
    sections: ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'],
    totalLabel: 'TOTAL PASIVO',
  },
  {
    bloque: 'PATRIMONIO NETO',
    sections: ['PATRIMONIO_NETO'],
    totalLabel: 'TOTAL PATRIMONIO NETO',
  },
] as const

const SECCION_SSP_LABELS: Record<string, string> = {
  ACTIVO_CORRIENTE: 'Activo Corriente',
  ACTIVO_NO_CORRIENTE: 'Activo No Corriente',
  PASIVO_CORRIENTE: 'Pasivo Corriente',
  PASIVO_NO_CORRIENTE: 'Pasivo No Corriente',
  PATRIMONIO_NETO: 'Patrimonio Neto',
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TotalRow({
  label,
  value,
  valueAnt,
  mostrarAnterior = false,
  variant = 'section',
}: {
  label: string
  value: number
  valueAnt?: number
  mostrarAnterior?: boolean
  variant?: 'section' | 'bloque' | 'final'
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
          'px-4 py-2 text-right font-mono text-sm tabular-nums font-semibold',
          variant === 'final'
            ? 'text-white'
            : isNegative
              ? 'text-red-600'
              : 'text-slate-900',
        )}
      >
        {formatCurrency(value)}
      </td>
      {mostrarAnterior && (
        <td
          className={cn(
            'px-4 py-2 text-right font-mono text-sm tabular-nums font-semibold',
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
    </tr>
  )
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
}) {
  const displayText = deduccion
    ? `(${formatCurrency(Math.abs(rubro.displayValue))})`
    : formatCurrency(rubro.displayValue)
  const isNegative = rubro.displayValue < 0
  const huerfano = esRubroHuerfano(rubro.id)

  // ── Fila huérfana (solo período anterior): sin expand, con borrar ───────────
  if (huerfano) {
    return (
      <tr className="border-b border-slate-100 hover:bg-slate-50/60">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
              solo anterior
            </span>
            <span className="text-sm text-slate-700">{rubro.nombre}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-slate-300">—</td>
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
              <span className="font-mono text-sm tabular-nums text-slate-500">
                {formatCurrency(rubro.displayValueAnt)}
              </span>
            )}
          </td>
        )}
      </tr>
    )
  }

  return (
    <>
      <tr
        className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
      >
        <td className="px-4 py-2.5 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 flex-shrink-0">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="text-sm text-slate-700">{rubro.nombre}</span>
            <span className="text-xs text-slate-400 font-mono">({rubro.cuentas.length})</span>
          </div>
        </td>
        <td
          className={cn(
            'px-4 py-2.5 text-right font-mono text-sm tabular-nums cursor-pointer',
            isNegative ? 'text-red-600' : 'text-slate-700',
          )}
          onClick={onToggle}
        >
          {displayText}
        </td>
        {mostrarAnterior && (
          <td className="px-2 py-2 text-right">
            {editarAnterior && ejercicioId && sociedadId && comparativo ? (
              <div className="w-36 ml-auto">
                <CeldaNumero
                  value={comparativo.entradas.get(rubro.id)?.valor ?? rubro.displayValueAnt}
                  editando
                  onSave={(v) => comparativo.setValor(rubro.id, v)}
                />
              </div>
            ) : (
              <span className="font-mono text-sm tabular-nums text-slate-500">
                {formatCurrency(rubro.displayValueAnt)}
              </span>
            )}
          </td>
        )}
      </tr>
      {expanded && (
        <>
          {rubro.cuentas.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 bg-slate-50/40">
              <td className="pl-10 pr-4 py-1.5">
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
                {deduccion
                  ? `(${formatCurrency(Math.abs(c.displayValue))})`
                  : formatCurrency(c.displayValue)}
              </td>
              {mostrarAnterior && <td />}
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
}) {
  const getSeccionRubros = (seccionKey: string) =>
    sspRubros.filter((r) => r.seccionSSP === seccionKey)

  const seccionTotal = (seccionKey: string) =>
    getSeccionRubros(seccionKey).reduce((acc, r) => acc + r.displayValue, 0)

  const seccionTotalAnt = (seccionKey: string) =>
    getSeccionRubros(seccionKey).reduce((acc, r) => acc + r.displayValueAnt, 0)

  const bloqueTotal = (sections: readonly string[]) =>
    sections.reduce((acc, s) => acc + seccionTotal(s), 0)
  const bloqueTotalAnt = (sections: readonly string[]) =>
    sections.reduce((acc, s) => acc + seccionTotalAnt(s), 0)

  const totalPasivo = bloqueTotal(['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'])
  const totalPasivoAnt = bloqueTotalAnt(['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'])
  const totalPN = patrimonioNetoFinal ?? bloqueTotal(['PATRIMONIO_NETO'])
  const totalPNAnt = patrimonioNetoFinalAnt ?? bloqueTotalAnt(['PATRIMONIO_NETO'])
  const totalPasivoPN = totalPasivo + totalPN
  const totalPasivoPNAnt = totalPasivoAnt + totalPNAnt
  const { diferencia: diferenciaCuadre, cuadrado } = calcularCuadreSP(sspRubros, patrimonioNetoFinal)

  const colSpan = mostrarAnterior ? 3 : 2

  return (
    <div>
      {/* Cuadre indicator */}
      <div
        className={cn(
          'mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
          cuadrado
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-amber-50 border border-amber-200',
        )}
      >
        {cuadrado ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        )}
        <span className={cuadrado ? 'text-emerald-700' : 'text-amber-700'}>
          {cuadrado
            ? 'Balance cuadrado - Activo = Pasivo + Patrimonio Neto'
            : `Descuadre de ${formatCurrency(Math.abs(diferenciaCuadre))} — revisá las clasificaciones`}
        </span>
      </div>

      {editarAnterior && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
          Cargá los importes del ejercicio anterior en la columna de la derecha. Usá
          <em> “Agregar rubro del período anterior” </em> dentro de cada sección para rubros que el
          ejercicio actual no tiene.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Concepto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-44">
                Importe
              </th>
              {mostrarAnterior && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-44">
                  Ej. Anterior
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {SSP_STRUCTURE.map(({ bloque, sections, totalLabel }) => {
              const bloqueHasData = editarAnterior
                || sections.some((s) => getSeccionRubros(s).length > 0)
                || (bloque === 'PATRIMONIO NETO' && patrimonioNetoFinal !== null)
              if (!bloqueHasData) return null
              const esPN = bloque === 'PATRIMONIO NETO'

              return (
                <React.Fragment key={bloque}>
                  {/* Bloque header */}
                  <tr className="border-b border-slate-200 bg-slate-800">
                    <td
                      colSpan={colSpan}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300"
                    >
                      {bloque}
                    </td>
                  </tr>

                  {/* Regla: PN no muestra rubros individuales — el detalle va en el E.E.P.N. */}
                  {!esPN && sections.map((secKey) => {
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
                              className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide"
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
                                onAdded={(dto) => comparativo.agregar({ modulo: dto.modulo, clave: dto.clave, label: dto.label, valor: dto.valor, esHuerfano: true, orden: dto.orden })}
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
                          />
                        )}
                      </React.Fragment>
                    )
                  })}

                  {/* Para PN: una sola línea con el total y referencia al E.E.P.N. */}
                  {esPN && (
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        Patrimonio Neto
                        <span className="ml-2 text-xs text-slate-400">(Ver E.E.P.N.)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-slate-700">
                        {formatCurrency(totalPN)}
                      </td>
                      {mostrarAnterior && (
                        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-slate-500">
                          {formatCurrency(totalPNAnt)}
                        </td>
                      )}
                    </tr>
                  )}

                  <TotalRow
                    label={totalLabel}
                    value={esPN ? totalPN : bloqueTotal(sections)}
                    valueAnt={esPN ? totalPNAnt : bloqueTotalAnt(sections)}
                    mostrarAnterior={mostrarAnterior}
                    variant="bloque"
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
                      className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
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
                      ejercicioId={ejercicioId}
                      sociedadId={sociedadId}
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
            />
          </tfoot>
        </table>
      </div>
    </div>
  )
}
