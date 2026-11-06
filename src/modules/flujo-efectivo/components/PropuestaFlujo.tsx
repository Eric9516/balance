'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { importeEditable, parseImporte } from '@/lib/utils/parseImporte'
import { restar } from '@/lib/importe'
import {
  proponerFlujo,
  rubroIncluido,
  SIN_ELECCIONES,
  tipoDeGasto,
  TIPO_GASTO_LABELS,
  type EleccionesPropuesta,
  type InsumosPropuesta,
  type TipoGasto,
} from '../domain/propuesta'
import { LINEAS_DE_LA_APP, SECCION_FLUJO_LABELS } from '../domain/types'

const pesos = (n: number) => formatCurrency(n, { decimales: 'todos' })

/**
 * "Proponer desde el balance": la app arma las líneas del flujo con lo que ya tiene y muestra de
 * dónde sale cada una. El contador clasifica los gastos, elige los rubros de las variaciones, carga
 * lo que la app no puede ver (ganancias pagado, préstamos) y decide si la usa.
 */
export function PropuestaFlujo({
  insumos,
  aplicando,
  onClose,
  onUsar,
}: {
  /** Lo que se leyó del balance al abrirla; null = cerrada. */
  insumos: InsumosPropuesta | null
  aplicando: boolean
  onClose: () => void
  onUsar: (elecciones: EleccionesPropuesta) => void
}) {
  const [elecciones, setElecciones] = useState<EleccionesPropuesta>(SIN_ELECCIONES)

  const propuesta = insumos ? proponerFlujo(insumos, elecciones) : null
  const cambiar = (c: Partial<EleccionesPropuesta>) => setElecciones((e) => ({ ...e, ...c }))

  return (
    <Dialogo
      open={insumos !== null}
      onClose={onClose}
      title="Proponer desde el balance"
      bloqueado={aplicando}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={aplicando}>
            Cancelar
          </Button>
          <Button onClick={() => onUsar(elecciones)} disabled={!propuesta || aplicando}>
            {aplicando ? 'Guardando…' : 'Usar esta propuesta'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        La app arma estas líneas con lo que ya tiene el balance. Revisalas: al usarlas, se ponen en
        el flujo (las líneas que escribiste vos no se tocan). El RECPAM se recalcula y queda
        pendiente de revisión.
      </p>

      {!insumos || !propuesta ? (
        <p className="py-8 text-center text-sm text-slate-400">Leyendo el balance…</p>
      ) : (
        <>
          {/* Las líneas */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 font-medium">Línea</th>
                <th className="w-44 py-1.5 text-right font-medium">Ejercicio actual</th>
              </tr>
            </thead>
            <tbody>
              {propuesta.lineas.map((l) => (
                <tr key={l.origen} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3">
                    <details>
                      <summary className="cursor-pointer text-slate-800">
                        {LINEAS_DE_LA_APP[l.origen].concepto}
                        <span className="ml-2 text-xs text-slate-400">
                          {SECCION_FLUJO_LABELS[LINEAS_DE_LA_APP[l.origen].seccion]}
                        </span>
                      </summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
                        {l.detalle.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td
                    className={cn(
                      'py-1.5 text-right font-mono text-xs tabular-nums',
                      l.importe < 0 ? 'text-red-700' : 'text-slate-800',
                    )}
                  >
                    {formatCurrency(l.importe)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {propuesta.avisos.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              {propuesta.avisos.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {/* Lo que la app no puede ver */}
          <fieldset className="space-y-2 rounded-lg border border-slate-200 px-3.5 py-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              Lo que carga el contador
            </legend>
            <p className="text-xs text-slate-500">
              El balance de sumas y saldos tiene saldos, no movimientos: estos importes los sabe el
              estudio. Si los dejás vacíos, no se agrega la línea y la diferencia queda en el
              RECPAM.
            </p>
            <EntradaImporte
              label="Impuesto a las ganancias pagado en el ejercicio (con los anticipos)"
              referencia={`Devengado en el Estado de Resultados: ${pesos(insumos.referencias.impuestoGanancias)}`}
              valor={elecciones.gananciasPagado}
              onCambio={(v) => cambiar({ gananciasPagado: v })}
            />
            <EntradaImporte
              label="Préstamos recibidos en el ejercicio"
              referencia={`Saldo de préstamos: ${pesos(insumos.referencias.prestamos.anterior)} al inicio (ajustado) y ${pesos(insumos.referencias.prestamos.actual)} al cierre (variación ${pesos(restar(insumos.referencias.prestamos.actual, insumos.referencias.prestamos.anterior))})`}
              valor={elecciones.prestamosRecibidos}
              onCambio={(v) => cambiar({ prestamosRecibidos: v })}
            />
            <EntradaImporte
              label="Préstamos devueltos en el ejercicio"
              valor={elecciones.prestamosCancelados}
              onCambio={(v) => cambiar({ prestamosCancelados: v })}
            />
          </fieldset>

          {/* Gastos del Anexo III */}
          <details className="rounded-lg border border-slate-200 px-3.5 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Gastos del Anexo III ({insumos.gastos.length}): qué es cada uno
            </summary>
            <p className="mt-1.5 text-xs text-slate-500">
              La app sugiere por el nombre de la cuenta. Cambiá lo que no corresponda.
            </p>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {insumos.gastos.map((g) => (
                  <tr key={g.cuentaId} className="border-b border-slate-100">
                    <td className="py-1 pr-2 text-slate-800">{g.nombre}</td>
                    <td className="py-1 pr-2 text-slate-400">{g.seccion}</td>
                    <td className="w-32 py-1 pr-2 text-right font-mono tabular-nums">
                      {formatCurrency(g.importe)}
                    </td>
                    <td className="w-60 py-1">
                      <select
                        value={tipoDeGasto(g, elecciones)}
                        onChange={(e) =>
                          cambiar({
                            tiposGasto: {
                              ...elecciones.tiposGasto,
                              [g.cuentaId]: e.target.value as TipoGasto,
                            },
                          })
                        }
                        aria-label={`Qué es ${g.nombre}`}
                        className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
                      >
                        {Object.entries(TIPO_GASTO_LABELS).map(([valor, texto]) => (
                          <option key={valor} value={valor}>
                            {texto}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {/* Rubros de las variaciones */}
          <details className="rounded-lg border border-slate-200 px-3.5 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Rubros corrientes de las variaciones ({insumos.rubros.length})
            </summary>
            <p className="mt-1.5 text-xs text-slate-500">
              Actual contra el anterior ajustado. Los que no entran por defecto dicen por qué; podés
              cambiarlo.
            </p>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {insumos.rubros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="w-8 py-1">
                      <input
                        type="checkbox"
                        checked={rubroIncluido(r, elecciones)}
                        onChange={(e) =>
                          cambiar({ rubros: { ...elecciones.rubros, [r.id]: e.target.checked } })
                        }
                        aria-label={`Incluir ${r.nombre}`}
                        className="accent-blue-600"
                      />
                    </td>
                    <td className="py-1 pr-2 text-slate-800">
                      {r.nombre}
                      <span className="ml-1.5 text-slate-400">
                        ({r.lado === 'ACTIVO' ? 'activo' : 'pasivo'})
                      </span>
                      {r.motivoExcluido && <div className="text-slate-400">{r.motivoExcluido}</div>}
                    </td>
                    <td className="w-32 py-1 pr-2 text-right font-mono tabular-nums">
                      {formatCurrency(r.actual)}
                    </td>
                    <td className="w-32 py-1 pr-2 text-right font-mono text-slate-400 tabular-nums">
                      {formatCurrency(r.anterior)}
                    </td>
                    <td className="w-32 py-1 text-right font-mono tabular-nums">
                      {formatCurrency(restar(r.actual, r.anterior))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Dialogo>
  )
}

/** Un importe que carga el contador: vacío = no lo cargó. */
function EntradaImporte({
  label,
  referencia,
  valor,
  onCambio,
}: {
  label: string
  referencia?: string
  valor: number | null
  onCambio: (v: number | null) => void
}) {
  const [texto, setTexto] = useState(valor === null ? '' : importeEditable(valor))
  return (
    <label className="block text-xs">
      <span className="text-slate-700">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => onCambio(texto.trim() === '' ? null : parseImporte(texto))}
        placeholder="Sin cargar"
        className="mt-1 block w-56 rounded border border-slate-200 px-2 py-1 text-right font-mono text-xs focus:border-blue-400 focus:outline-none"
      />
      {referencia && <span className="mt-0.5 block text-slate-400">{referencia}</span>}
    </label>
  )
}
