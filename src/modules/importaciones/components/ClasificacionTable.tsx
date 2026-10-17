'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { buildGroups } from '../lib/grupos'
import { useFilaCuentaEdicion } from '../hooks/useFilaCuentaEdicion'
import { useClasificacionBulk } from '../hooks/useClasificacionBulk'
import { FilaCuenta } from './FilaCuenta'
import { BarraAsignacionBulk } from './BarraAsignacionBulk'
import type { CuentaContableDTO, RubroBaseSimple } from '../domain/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'todas' | 'sin-clasificar' | 'clasificadas'

interface Props {
  cuentas: CuentaContableDTO[]
  rubros: RubroBaseSimple[]
  ejercicioId: string
  sociedadId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClasificacionTable({ cuentas, rubros, ejercicioId, sociedadId }: Props) {
  const [tab, setTab] = useState<Tab>('sin-clasificar')

  const bulk = useClasificacionBulk(cuentas, rubros, ejercicioId, sociedadId)
  const edicion = useFilaCuentaEdicion(ejercicioId, sociedadId)

  // Select-all checkbox ref for indeterminate state
  const selectAllRef = useRef<HTMLInputElement>(null)

  // ─── Derived helpers ────────────────────────────────────────────────────────

  const totalClasificadas = useMemo(
    () => cuentas.filter((c) => bulk.getEffectiveRubroId(c) !== null).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuentas, bulk.asignaciones],
  )

  const sinClasificarCount = cuentas.length - totalClasificadas

  const visibles = useMemo(() => {
    switch (tab) {
      case 'sin-clasificar':
        return cuentas.filter((c) => !bulk.getEffectiveRubroId(c))
      case 'clasificadas':
        return cuentas.filter((c) => !!bulk.getEffectiveRubroId(c))
      default:
        return cuentas
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentas, tab, bulk.asignaciones])

  const groups = useMemo(() => buildGroups(rubros), [rubros])

  const progress =
    cuentas.length > 0 ? Math.round((totalClasificadas / cuentas.length) * 100) : 0

  // ─── Indeterminate checkbox ─────────────────────────────────────────────────

  useEffect(() => {
    if (selectAllRef.current) {
      const someSelected = bulk.selected.size > 0 && bulk.selected.size < visibles.length
      selectAllRef.current.indeterminate = someSelected
    }
  }, [bulk.selected.size, visibles.length])

  function handleTabChange(next: Tab) {
    setTab(next)
    bulk.setSelected(new Set())
    edicion.resetSeleccion()
  }

  // Pedir confirmación de borrado cancela cualquier edición en curso (otra fila).
  function handleRequestDelete(id: string | null) {
    edicion.setConfirmDeleteId(id)
    if (id) edicion.handleEditCancel()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (cuentas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">No hay cuentas importadas en este ejercicio.</p>
        <p className="mt-1 text-xs text-slate-400">
          Importá el balance de sumas y saldos primero.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Progress bar */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Progreso de clasificación</span>
            {progress < 100 && (
              <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {cuentas.length - totalClasificadas} pendientes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs tabular-nums', progress === 100 ? 'text-emerald-600' : 'text-slate-400')}>
              {totalClasificadas} de {cuentas.length}
            </span>
            <span className={cn('text-sm font-bold tabular-nums w-10 text-right', progress === 100 ? 'text-emerald-600' : 'text-blue-600')}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 relative overflow-hidden',
              progress === 100
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                : 'bg-gradient-to-r from-blue-400 to-blue-600',
            )}
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          </div>
        </div>
        {progress === 100 && (
          <p className="mt-2 text-xs font-medium text-emerald-600">
            ✓ Todas las cuentas están clasificadas
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-slate-200">
        {(
          [
            ['todas', `Todas (${cuentas.length})`],
            ['sin-clasificar', `Sin clasificar (${sinClasificarCount})`],
            ['clasificadas', `Clasificadas (${totalClasificadas})`],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => handleTabChange(value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === value
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty filtered state */}
      {visibles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">
            {tab === 'sin-clasificar'
              ? '¡Todas las cuentas están clasificadas!'
              : 'No hay cuentas en esta categoría.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={bulk.selected.size > 0 && bulk.selected.size === visibles.length}
                    onChange={() => bulk.handleSelectAllVisibles(visibles)}
                    className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">
                  Debe
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">
                  Haber
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">
                  Saldo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-72">
                  Rubro RT 54
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <FilaCuenta
                  key={c.id}
                  cuenta={c}
                  groups={groups}
                  efectivoRubroId={bulk.getEffectiveRubroId(c)}
                  isSaving={bulk.saving.has(c.id)}
                  isSelected={bulk.selected.has(c.id)}
                  isEditing={c.id === edicion.editingRowId}
                  draftRow={edicion.draftRow}
                  isSavingEdit={edicion.isSavingEdit}
                  confirmDeleteId={edicion.confirmDeleteId}
                  isDeletingId={edicion.isDeletingId}
                  onToggleSelect={() => bulk.handleToggleSelect(c.id)}
                  onAsignar={(rubroId) => bulk.handleAsignar(c.id, rubroId)}
                  onEditStart={() => edicion.handleEditStart(c)}
                  onEditCancel={edicion.handleEditCancel}
                  onEditSave={() => edicion.handleEditSave(cuentas)}
                  onDraftFieldChange={edicion.setDraftField}
                  onDraftDeudorChange={edicion.handleDraftDeudorChange}
                  onDraftAcreedorChange={edicion.handleDraftAcreedorChange}
                  onConfirmDeleteIdChange={handleRequestDelete}
                  onDeleteConfirm={() => edicion.handleDeleteConfirm(c.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk assignment bar */}
      {bulk.selected.size > 0 && (
        <BarraAsignacionBulk
          count={bulk.selected.size}
          bulkRubroId={bulk.bulkRubroId}
          groups={groups}
          isBulkPending={bulk.isBulkPending}
          onChangeRubro={bulk.setBulkRubroId}
          onAsignar={bulk.handleBulkAsignar}
          onCancelar={() => { bulk.setSelected(new Set()); bulk.setBulkRubroId('') }}
        />
      )}

      {/* Spacer so bulk bar doesn't cover last rows */}
      {bulk.selected.size > 0 && <div className="h-16" />}
    </>
  )
}
