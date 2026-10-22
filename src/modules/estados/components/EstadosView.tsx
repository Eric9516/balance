'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadosData } from '../domain/types'
import { calcularCuadreSP } from '../lib/cuadre'
import { esRubroHuerfano } from '../lib/rubroHuerfano'
import { confirmarEstadosAction } from '../actions/estados.actions'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import {
  ToggleEditarAnterior,
  useComparativoLote,
  type ComparativoEntry,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import { SSPTab } from './SSPTab'
import { EERRTab } from './EERRTab'

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  data: EstadosData
  ejercicioId: string
  sociedadId: string
  estadosConfirmado?: boolean
  /** Edición manual de la columna "Ejercicio anterior" (modo MANUAL). */
  editarAnterior?: boolean
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  /** Denominación del ejercicio anterior vinculado (origen de los valores con candado). */
  anteriorDenominacion: string | null
  /** Pestaña "Estado de Flujo de Efectivo" (la arma la página con su propio módulo). */
  flujo?: ReactNode
}

export function EstadosView({
  data,
  ejercicioId,
  sociedadId,
  estadosConfirmado: initialConfirmado = false,
  editarAnterior = false,
  fechaCierre,
  fechaCierreAnterior,
  anteriorDenominacion,
  flujo,
}: Props) {
  const [tab, setTab] = useState<'ssp' | 'eerr' | 'flujo'>('ssp')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmado, setConfirmado] = useState(initialConfirmado)
  const [isPending, startTransition] = useTransition()

  // Columna "Ejercicio Anterior" — un solo borrador para SSP + EERR (comparten el toggle).
  // Los rubros cuyo anterior sale de su nota no entran: no se escriben en el estado.
  const entradasAnterior: ComparativoEntry[] = [
    ...data.sspRubros
      .filter((r) => !r.anteriorDesdeDetalle)
      .map((r) => ({
        modulo: 'SSP' as const,
        clave: r.id,
        label: r.nombre,
        valor: r.displayValueAnt,
        esHuerfano: esRubroHuerfano(r.id),
      })),
    { modulo: 'EERR' as const, clave: 'INGRESOS', label: 'Ingresos', valor: data.eerr.ingresosAnt },
    {
      modulo: 'EERR' as const,
      clave: 'COSTO_VENTAS',
      label: 'Costo de Ventas',
      valor: data.eerr.costoVentasAnt,
    },
    {
      modulo: 'EERR' as const,
      clave: 'RESULTADOS_FINANCIEROS',
      label: 'Resultados Financieros',
      valor: data.eerr.resultadosFinancierosAnt,
    },
    {
      modulo: 'EERR' as const,
      clave: 'IMPUESTO_GANANCIAS',
      label: 'Impuesto a las Ganancias',
      valor: data.eerr.impuestoGananciasAnt,
    },
  ]
  const comparativo = useComparativoLote(entradasAnterior, ejercicioId, sociedadId)
  const editandoAnterior = editarAnterior && comparativo.editando
  // Columna anterior visible pero no editable = valores tomados del ejercicio vinculado.
  const anteriorBloqueado = data.hayEjercicioAnterior && !editarAnterior

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }

  const hasSSP = data.sspRubros.length > 0
  const hasEERR = data.eerrRubros.length > 0
  const hayPendientes = data.sinClasificar > 0

  const { cuadrado } = calcularCuadreSP(data.sspRubros, data.patrimonioNetoFinal)

  if (!hasSSP && !hasEERR) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">No hay cuentas clasificadas todavía.</p>
        <p className="mt-1 text-xs text-slate-400">
          Clasificá las cuentas del ejercicio para generar los estados.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Warning: cuentas sin clasificar */}
      {hayPendientes && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{data.sinClasificar}</strong>{' '}
            {data.sinClasificar === 1 ? 'cuenta sin clasificar' : 'cuentas sin clasificar'} — los
            estados pueden estar incompletos.
          </span>
        </div>
      )}

      {/* Tabs + botón confirmar en la misma línea */}
      <div className="mb-5 flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-0">
          {(
            [
              ['ssp', 'Estado de Situación Patrimonial'],
              ['eerr', 'Estado de Resultados'],
              ...(flujo ? [['flujo', 'Flujo de Efectivo']] : []),
            ] as ['ssp' | 'eerr' | 'flujo', string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                '-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition-colors',
                tab === value
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {editarAnterior && tab !== 'flujo' && (
            <ToggleEditarAnterior
              editando={comparativo.editando}
              isPending={comparativo.isPending}
              onEditar={comparativo.iniciarEdicion}
              onGuardar={comparativo.confirmar}
              onCancelar={comparativo.cancelar}
            />
          )}
          {cuadrado && (
            <button
              onClick={() => {
                if (confirmado) return
                startTransition(async () => {
                  const result = await confirmarEstadosAction(ejercicioId, sociedadId)
                  if (result.ok) {
                    setConfirmado(true)
                    toastSuccess('Estados confirmados')
                  } else {
                    toastError(result.error)
                  }
                })
              }}
              disabled={isPending}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
                confirmado
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {confirmado ? 'Confirmado' : 'Confirmar estados'}
            </button>
          )}
        </div>
      </div>

      {tab === 'ssp' && (
        <SSPTab
          sspRubros={data.sspRubros}
          patrimonioNetoFinal={data.patrimonioNetoFinal}
          patrimonioNetoFinalAnt={data.patrimonioNetoFinalAnt}
          expanded={expanded}
          onToggle={toggleExpand}
          mostrarAnterior={data.hayEjercicioAnterior}
          editarAnterior={editandoAnterior}
          comparativo={comparativo}
          ejercicioId={ejercicioId}
          sociedadId={sociedadId}
          fechaCierre={fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          anteriorBloqueado={anteriorBloqueado}
          anteriorDenominacion={anteriorDenominacion}
        />
      )}
      {tab === 'eerr' && (
        <EERRTab
          eerr={data.eerr}
          conComparativo={data.hayEjercicioAnterior}
          comparativo={comparativo}
          editarAnterior={editandoAnterior}
          ejercicioId={ejercicioId}
          sociedadId={sociedadId}
          fechaCierre={fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          anteriorBloqueado={anteriorBloqueado}
          anteriorDenominacion={anteriorDenominacion}
        />
      )}
      {/* Envuelto: el slot llega del servidor y como hijo único no entra en la lista de hermanos. */}
      {tab === 'flujo' && <div>{flujo}</div>}
    </div>
  )
}
