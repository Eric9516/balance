import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { esSeccionHuerfana } from '../lib/seccionHuerfana'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import {
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'

export function TablaGastos({
  secciones,
  huerfanas = [],
  editarAnterior,
  comparativo,
  ejercicioId,
  sociedadId,
}: {
  secciones: GastosSecciones['secciones']
  huerfanas?: GastosSecciones['secciones']
  editarAnterior: boolean
  comparativo: ReturnType<typeof useComparativoLote>
  ejercicioId: string
  sociedadId: string
}) {
  const editandoAnt = comparativo.editando
  if (secciones.length === 0 && huerfanas.length === 0) return null

  // Columnas: secciones del ejercicio actual + (en edición) las del anterior.
  const cols = [...secciones, ...huerfanas]

  // Cuentas únicas como filas — ordenadas alfabéticamente
  const cuentasUnicas = Array.from(
    new Map(
      secciones.flatMap((s) => s.filas.map((f) => [f.cuentaNombre, f.cuentaNombre])),
    ).entries(),
  )
    .map(([nombre]) => nombre)
    .sort()

  const grandTotalActual = cols.reduce((s, sec) => s + sec.total, 0)
  const grandTotalAnterior = cols.reduce(
    (s, sec) => s + (comparativo.entradas.get(sec.key)?.valor ?? sec.totalAnterior),
    0,
  )

  // En modo manual no mostramos la columna anterior POR FILA (no hay cuentas del
  // ejercicio anterior); la carga es por total de sección en el pie.
  const colAnteriorPorFila = !editarAnterior
  const colSpanTotal = cols.length + (colAnteriorPorFila ? 2 : 1)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          {/* Título */}
          <tr className="bg-slate-800">
            <td
              colSpan={colSpanTotal + 1}
              className="px-4 py-2.5 text-center text-xs font-bold tracking-widest text-slate-200 uppercase"
            >
              Anexo III — Gastos
            </td>
          </tr>
          {/* Encabezados de columna */}
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="min-w-[220px] px-4 py-3 text-left text-xs font-semibold tracking-widest text-slate-500 uppercase">
              Rubros
            </th>
            {cols.map((s) => {
              const huerfana = esSeccionHuerfana(s.key)
              return (
                <th
                  key={s.key}
                  className={cn(
                    'w-36 border-l border-slate-200 px-3 py-3 text-center text-xs leading-tight font-semibold',
                    huerfana ? 'bg-amber-50/60 text-amber-700' : 'text-slate-700',
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    {huerfana && (
                      <span className="text-[9px] tracking-wide text-amber-500 uppercase">
                        solo ant.
                      </span>
                    )}
                    <span>{s.grupoNombre}</span>
                    {huerfana && editandoAnt && (
                      <EliminarFilaAnterior
                        ejercicioId={ejercicioId}
                        sociedadId={sociedadId}
                        modulo="GASTOS"
                        clave={s.key}
                        onDeleted={() => comparativo.quitar(s.key)}
                      />
                    )}
                  </div>
                </th>
              )
            })}
            <th className="w-36 border-l border-slate-300 bg-slate-100 px-3 py-3 text-center text-xs leading-tight font-semibold text-slate-800">
              Total Ejercicio Actual
            </th>
            {colAnteriorPorFila && (
              <th className="w-36 border-l border-slate-200 px-3 py-3 text-center text-xs leading-tight font-semibold text-slate-600">
                Total Ejercicio Anterior
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {cuentasUnicas.map((nombre) => {
            const totalActual = cols.reduce(
              (sum, s) => sum + (s.filas.find((f) => f.cuentaNombre === nombre)?.importe ?? 0),
              0,
            )
            const totalAnterior = cols.reduce(
              (sum, s) =>
                sum + (s.filas.find((f) => f.cuentaNombre === nombre)?.importeAnterior ?? 0),
              0,
            )

            return (
              <tr key={nombre} className="border-b border-slate-100 hover:bg-slate-50/40">
                <td className="px-4 py-2 text-sm text-slate-700">{nombre}</td>
                {cols.map((s) => {
                  const fila = s.filas.find((f) => f.cuentaNombre === nombre)
                  return (
                    <td
                      key={s.key}
                      className="border-l border-slate-100 px-3 py-2 text-right font-mono text-sm text-slate-700 tabular-nums"
                    >
                      {fila?.importe ? formatCurrency(fila.importe, { decimales: 2 }) : ''}
                    </td>
                  )
                })}
                <td className="border-l border-slate-200 bg-slate-50/60 px-3 py-2 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(totalActual, { decimales: 2 })}
                </td>
                {colAnteriorPorFila && (
                  <td className="border-l border-slate-100 px-3 py-2 text-right font-mono text-sm text-slate-500 tabular-nums">
                    {totalAnterior ? formatCurrency(totalAnterior, { decimales: 2 }) : '–'}
                  </td>
                )}
              </tr>
            )
          })}

          {/* Fila para agregar una sección del período anterior — dentro de la tabla */}
          {editandoAnt && (
            <tr className="border-b border-slate-100 bg-blue-50/30">
              <td colSpan={colSpanTotal + 1} className="px-4 py-2">
                <AgregarFilaAnterior
                  ejercicioId={ejercicioId}
                  sociedadId={sociedadId}
                  modulo="GASTOS"
                  ordenBase={huerfanas.length}
                  texto="Agregar sección del período anterior"
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
        </tbody>
        <tfoot>
          {/* Fila 1: Total Ejercicio Actual */}
          <tr className="border-t-2 border-slate-400 bg-slate-800">
            <td className="px-4 py-2.5 text-xs font-bold tracking-wide text-white uppercase">
              Total Ejercicio Actual
            </td>
            {cols.map((s) => (
              <td
                key={s.key}
                className="border-l border-slate-700 px-3 py-2.5 text-right font-mono text-sm font-bold text-white tabular-nums"
              >
                {esSeccionHuerfana(s.key) ? '–' : formatCurrency(s.total, { decimales: 2 })}
              </td>
            ))}
            <td className="border-l border-slate-600 px-3 py-2.5 text-right font-mono text-sm font-bold text-white tabular-nums">
              {formatCurrency(grandTotalActual, { decimales: 2 })}
            </td>
            {colAnteriorPorFila && (
              <td className="border-l border-slate-700 px-3 py-2.5 text-right font-mono text-sm font-bold text-slate-300 tabular-nums">
                {grandTotalAnterior ? formatCurrency(grandTotalAnterior, { decimales: 2 }) : '–'}
              </td>
            )}
          </tr>
          {/* Fila 2: Total Ejercicio Anterior (editable por sección solo con el lápiz) */}
          <tr className="border-t border-slate-600 bg-slate-700">
            <td className="px-4 py-2.5 text-xs font-bold tracking-wide text-slate-200 uppercase">
              Total Ejercicio Anterior
            </td>
            {cols.map((s) => (
              <td
                key={s.key}
                className="border-l border-slate-600 px-2 py-2 text-right font-mono text-sm font-bold tabular-nums"
              >
                {editandoAnt ? (
                  <CeldaNumero
                    value={comparativo.entradas.get(s.key)?.valor ?? s.totalAnterior}
                    editando
                    onSave={(v) => comparativo.setValor(s.key, v)}
                  />
                ) : (
                  <span className="text-slate-200">
                    {s.totalAnterior ? formatCurrency(s.totalAnterior, { decimales: 2 }) : '–'}
                  </span>
                )}
              </td>
            ))}
            <td className="border-l border-slate-600 px-3 py-2.5 text-right font-mono text-sm font-bold text-slate-200 tabular-nums">
              {grandTotalAnterior ? formatCurrency(grandTotalAnterior, { decimales: 2 }) : '–'}
            </td>
            {colAnteriorPorFila && <td className="border-l border-slate-600" />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
