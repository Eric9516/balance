import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { esSeccionHuerfana } from '../lib/seccionHuerfana'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'
import {
  advertenciaCuadreAnterior,
  cuadreAnteriorGastos,
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
  /** true (MANUAL): el ejercicio anterior se carga a mano, fila por fila y por sección. */
  editarAnterior: boolean
  comparativo: ReturnType<typeof useComparativoLote>
  ejercicioId: string
  sociedadId: string
}) {
  // Sin comparativo tampoco hay edición del anterior, aunque el padre la habilite.
  const editandoAnt = conComparativo && comparativo.editando
  // Las secciones huérfanas solo existen en el ejercicio anterior.
  const huerfanasVisibles = conComparativo ? huerfanas : []
  // Las filas solo del anterior existen únicamente con comparativo.
  const filasVisibles = conComparativo ? filas : filas.filter((f) => !f.soloAnterior)
  if (secciones.length === 0 && huerfanasVisibles.length === 0) return null

  // Columnas: secciones del ejercicio actual + (en carga manual) las del anterior.
  const cols = [...secciones, ...huerfanasVisibles]

  // Valores del anterior: en edición, los del borrador; si no, los guardados.
  const anteriorDeSeccion = (s: (typeof cols)[number]) =>
    comparativo.entradas.get(s.key)?.valor ?? s.totalAnterior
  const anteriorDeFila = (f: FilaAnexoGastos) =>
    editarAnterior ? (comparativo.entradas.get(f.clave)?.valor ?? f.totalAnterior) : f.totalAnterior

  const grandTotalActual = sumarPor(cols, (sec) => sec.total)
  const totalAnteriorPorSeccion = sumarPor(cols, anteriorDeSeccion)
  // Columna "Total Ejercicio Anterior" fila por fila, como el modelo de la RT 54. Con el anterior
  // vinculado su total sigue siendo el de las secciones; en carga manual, la suma de las filas.
  const totalColumnaAnterior = editarAnterior
    ? sumarPor(filasVisibles, anteriorDeFila)
    : totalAnteriorPorSeccion
  const colAnteriorPorFila = conComparativo
  const colSpanTotal = cols.length + (colAnteriorPorFila ? 2 : 1)

  // En carga manual, la columna por fila tiene que sumar lo mismo que los totales por sección.
  const advertencia =
    conComparativo && editarAnterior
      ? advertenciaCuadreAnterior(
          cuadreAnteriorGastos(filasVisibles.map(anteriorDeFila), cols.map(anteriorDeSeccion)),
        )
      : null

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
            {filasVisibles.map((fila) => (
              <tr
                key={fila.clave}
                className={cn(
                  'border-b border-slate-100 hover:bg-acento-suave',
                  fila.soloAnterior && 'bg-amber-50/30',
                )}
              >
                <td className="px-4 py-2 text-sm text-slate-700">
                  <div className="flex items-center gap-1.5">
                    {fila.soloAnterior && (
                      <span className="text-[9px] tracking-wide text-amber-500 uppercase">
                        solo ant.
                      </span>
                    )}
                    <span>{fila.nombre}</span>
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
                    {editandoAnt && editarAnterior ? (
                      <CeldaNumero
                        value={anteriorDeFila(fila)}
                        editando
                        onSave={(v) => comparativo.setValor(fila.clave, v)}
                      />
                    ) : (
                      <span className="px-1">
                        {anteriorDeFila(fila)
                          ? formatCurrency(anteriorDeFila(fila), { decimales: 2 })
                          : '–'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {/* Agregar una fila o una sección del período anterior — dentro de la tabla */}
            {editandoAnt && (
              <tr className="border-b border-slate-100 bg-blue-50/30">
                <td colSpan={colSpanTotal + 1} className="space-y-1 px-4 py-2">
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="GASTOS_FILA"
                    ordenBase={filasVisibles.filter((f) => f.soloAnterior).length}
                    texto="Agregar gasto del período anterior"
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
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="GASTOS"
                    ordenBase={huerfanasVisibles.length}
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
            {/* Fila 2: Total Ejercicio Anterior por sección (va al Estado de Resultados) */}
            {conComparativo && (
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
                        value={anteriorDeSeccion(s)}
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

      {advertencia && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          {advertencia}
        </p>
      )}
    </div>
  )
}
