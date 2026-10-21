import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { esSeccionHuerfana } from '../lib/seccionHuerfana'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'
import {
  advertenciaFilasSinSeccion,
  anteriorPorSeccionDesdeFilas,
  claveFilaAnteriorEnSeccion,
  filasAnexoGastos,
  type FilaAnexoGastos,
} from '../domain/filasAnexo'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import {
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import { sumarPor } from '@/lib/importe'

export function TablaGastos({
  secciones,
  huerfanas = [],
  filas,
  conComparativo,
  editarAnterior,
  comparativo,
  ejercicioId,
  sociedadId,
}: {
  secciones: GastosSecciones['secciones']
  huerfanas?: GastosSecciones['secciones']
  /** Filas del anexo (filasAnexoGastos): una por cuenta y, en carga manual, las solo del anterior. */
  filas: FilaAnexoGastos[]
  /** false (SIN_ANTERIOR / PENDIENTE): no se renderiza nada del ejercicio anterior. */
  conComparativo: boolean
  /** true (MANUAL): el ejercicio anterior se carga a mano, fila por fila. */
  editarAnterior: boolean
  comparativo: ReturnType<typeof useComparativoLote>
  ejercicioId: string
  sociedadId: string
}) {
  // Sin comparativo tampoco hay edición del anterior, aunque el padre la habilite.
  const editandoAnt = conComparativo && editarAnterior && comparativo.editando
  // Las secciones huérfanas solo existen en el ejercicio anterior.
  const huerfanasVisibles = conComparativo ? huerfanas : []
  if (secciones.length === 0 && huerfanasVisibles.length === 0) return null

  // Columnas: secciones del ejercicio actual + (en carga manual) las del anterior.
  const cols = [...secciones, ...huerfanasVisibles]
  const nombreSeccion = new Map(cols.map((s) => [s.key, s.grupoNombre]))

  // En carga manual las filas se recalculan con lo que muestra el borrador (en edición) o lo
  // guardado: así la fila de totales por sección se actualiza mientras se carga cada fila.
  const filasVivas = !conComparativo
    ? filas.filter((f) => !f.soloAnterior)
    : editarAnterior
      ? filasAnexoGastos(
          cols,
          [...comparativo.entradas.values()]
            .filter((e) => e.modulo === 'GASTOS_FILA')
            .map((e) => ({
              clave: e.clave,
              nombre: e.label,
              valor: e.valor,
              soloAnterior: !!e.esHuerfano,
            })),
        )
      : filas

  // Total del anterior por sección (fila de abajo, va al Estado de Resultados). En carga manual se
  // calcula desde las filas; con el anterior vinculado sale de las cuentas del anterior.
  const porSeccion = anteriorPorSeccionDesdeFilas(filasVivas)
  const anteriorDeSeccion = (s: (typeof cols)[number]) =>
    editarAnterior ? (porSeccion.get(s.key) ?? 0) : s.totalAnterior

  const grandTotalActual = sumarPor(cols, (sec) => sec.total)
  const totalAnteriorPorSeccion = sumarPor(cols, anteriorDeSeccion)
  const totalColumnaAnterior = editarAnterior
    ? sumarPor(filasVivas, (f) => f.totalAnterior)
    : totalAnteriorPorSeccion
  const colAnteriorPorFila = conComparativo
  const colSpanTotal = cols.length + (colAnteriorPorFila ? 2 : 1)
  const advertencia =
    conComparativo && editarAnterior ? advertenciaFilasSinSeccion(filasVivas) : null

  return (
    <div className="space-y-3">
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
            {filasVivas.map((fila) => (
              <tr
                key={fila.clave}
                className={cn(
                  'border-b border-slate-100 hover:bg-acento-suave',
                  fila.soloAnterior && 'bg-amber-50/30',
                )}
              >
                <td className="px-4 py-2 text-sm text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span>{fila.nombre}</span>
                    {fila.soloAnterior && (
                      <span className="text-[10px] text-amber-600">
                        · solo año anterior,{' '}
                        {fila.secciones[0]
                          ? (nombreSeccion.get(fila.secciones[0]) ?? 'clasificación oculta')
                          : 'sin clasificación'}
                      </span>
                    )}
                    {fila.soloAnterior && editandoAnt && (
                      <EliminarFilaAnterior
                        ejercicioId={ejercicioId}
                        sociedadId={sociedadId}
                        modulo="GASTOS_FILA"
                        clave={fila.clave}
                        onDeleted={() => comparativo.quitar(fila.clave)}
                      />
                    )}
                  </div>
                </td>
                {cols.map((s) => {
                  const importe = fila.importes[s.key]
                  return (
                    <td
                      key={s.key}
                      className="border-l border-slate-100 px-3 py-2 text-right font-mono text-sm text-slate-700 tabular-nums"
                    >
                      {importe ? formatCurrency(importe, { decimales: 2 }) : ''}
                    </td>
                  )
                })}
                <td className="border-l border-slate-200 bg-slate-50/60 px-3 py-2 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {fila.soloAnterior ? '–' : formatCurrency(fila.totalActual, { decimales: 2 })}
                </td>
                {colAnteriorPorFila && (
                  <td className="border-l border-slate-100 px-2 py-1.5 text-right font-mono text-sm text-slate-500 tabular-nums">
                    {editandoAnt ? (
                      <CeldaAnteriorDeFila
                        fila={fila}
                        comparativo={comparativo}
                        nombreSeccion={nombreSeccion}
                      />
                    ) : (
                      <span className="px-1">
                        {fila.totalAnterior
                          ? formatCurrency(fila.totalAnterior, { decimales: 2 })
                          : '–'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {/* Agregar un gasto o una columna que solo existieron en el período anterior */}
            {editandoAnt && (
              <tr className="border-b border-slate-100 bg-blue-50/30">
                <td colSpan={colSpanTotal + 1} className="space-y-1 px-4 py-2">
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="GASTOS_FILA"
                    ordenBase={filasVivas.filter((f) => f.soloAnterior).length}
                    texto="Agregar gasto del período anterior"
                    opcionesSeccion={cols.map((s) => ({ clave: s.key, label: s.grupoNombre }))}
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
                  {/* La columna nueva aparece al recargar los datos del anexo (no lleva importe
                      propio: su total sale de los gastos que se le asignen). */}
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="GASTOS"
                    ordenBase={huerfanasVisibles.length}
                    texto="Agregar columna (clasificación) del período anterior"
                  />
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {/* Fila 1: Total Ejercicio Actual (y total de la columna anterior por fila) */}
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
                  {totalColumnaAnterior
                    ? formatCurrency(totalColumnaAnterior, { decimales: 2 })
                    : '–'}
                </td>
              )}
            </tr>
            {/* Fila 2: Total Ejercicio Anterior por sección (calculado; va al Estado de Resultados) */}
            {conComparativo && (
              <tr className="border-t border-slate-600 bg-slate-700">
                <td className="px-4 py-2.5 text-xs font-bold tracking-wide text-slate-200 uppercase">
                  Total Ejercicio Anterior
                </td>
                {cols.map((s) => {
                  const valor = anteriorDeSeccion(s)
                  return (
                    <td
                      key={s.key}
                      className="border-l border-slate-600 px-3 py-2.5 text-right font-mono text-sm font-bold text-slate-200 tabular-nums"
                    >
                      {valor ? formatCurrency(valor, { decimales: 2 }) : '–'}
                    </td>
                  )
                })}
                <td className="border-l border-slate-600 px-3 py-2.5 text-right font-mono text-sm font-bold text-slate-200 tabular-nums">
                  {totalAnteriorPorSeccion
                    ? formatCurrency(totalAnteriorPorSeccion, { decimales: 2 })
                    : '–'}
                </td>
                {colAnteriorPorFila && <td className="border-l border-slate-600" />}
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {editarAnterior && conComparativo && (
        <p className="text-xs text-slate-500">
          El ejercicio anterior se carga fila por fila en la columna &quot;Total Ejercicio
          Anterior&quot;. La fila &quot;Total Ejercicio Anterior&quot; de abajo se calcula sola:
          cada gasto suma en la columna donde está este año.
        </p>
      )}

      {advertencia && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          {advertencia}
        </p>
      )}
    </div>
  )
}

/**
 * Importe anterior de una fila en edición. Una fila en una sola sección (o solo del anterior) tiene
 * un importe; una fila que este año está en varias secciones, uno por sección, para que cada parte
 * sume en su columna.
 */
function CeldaAnteriorDeFila({
  fila,
  comparativo,
  nombreSeccion,
}: {
  fila: FilaAnexoGastos
  comparativo: ReturnType<typeof useComparativoLote>
  nombreSeccion: Map<string, string>
}) {
  if (fila.soloAnterior || fila.secciones.length <= 1) {
    return (
      <CeldaNumero
        value={fila.totalAnterior}
        editando
        onSave={(v) => comparativo.setValor(fila.clave, v)}
      />
    )
  }
  return (
    <div className="space-y-1">
      {fila.secciones.map((s) => {
        const clave = claveFilaAnteriorEnSeccion(fila.nombre, s)
        return (
          <label key={s} className="flex items-center gap-1.5">
            <span className="max-w-20 truncate text-[10px] text-slate-400">
              {nombreSeccion.get(s)}
            </span>
            <CeldaNumero
              value={fila.anteriorPorSeccion[s] ?? 0}
              editando
              onSave={(v) => comparativo.setValor(clave, v)}
            />
          </label>
        )
      })}
    </div>
  )
}
