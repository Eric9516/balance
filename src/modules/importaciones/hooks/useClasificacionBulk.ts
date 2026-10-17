'use client'

import { useMemo, useState, useTransition } from 'react'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { asignarRubroAction, asignarRubrosBulkAction } from '../actions/clasificacion.actions'
import type { CuentaContableDTO, RubroBaseSimple } from '../domain/types'

/** Asignación de rubro por cuenta (individual y en lote) con estado optimista. */
export function useClasificacionBulk(
  cuentas: CuentaContableDTO[],
  rubros: RubroBaseSimple[],
  ejercicioId: string,
  sociedadId: string,
) {
  const [asignaciones, setAsignaciones] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRubroId, setBulkRubroId] = useState<string>('')
  const [isBulkPending, startBulkTransition] = useTransition()
  const rubroOriginalPorCuenta = useMemo(
    () => new Map(cuentas.map((c) => [c.id, c.rubroBaseId])),
    [cuentas],
  )

  /** Rubro vigente de la cuenta: la asignación optimista local si existe, si no el persistido. */
  function rubroEfectivo(cuentaId: string): string | null {
    const asignado = asignaciones[cuentaId]
    return asignado !== undefined ? asignado : (rubroOriginalPorCuenta.get(cuentaId) ?? null)
  }

  function getEffectiveRubroId(c: CuentaContableDTO): string | null {
    return rubroEfectivo(c.id)
  }

  async function handleAsignar(cuentaId: string, nuevoRubroId: string | null) {
    const prev = rubroEfectivo(cuentaId)
    setAsignaciones((a) => ({ ...a, [cuentaId]: nuevoRubroId }))
    setSaving((s) => {
      const ns = new Set(s)
      ns.add(cuentaId)
      return ns
    })
    const result = await asignarRubroAction(cuentaId, nuevoRubroId, ejercicioId, sociedadId)
    setSaving((s) => {
      const ns = new Set(s)
      ns.delete(cuentaId)
      return ns
    })
    if (!result.ok) {
      toastError(result.error)
      setAsignaciones((a) => ({ ...a, [cuentaId]: prev }))
    }
  }

  function handleBulkAsignar() {
    if (!bulkRubroId || selected.size === 0) return
    const ids = Array.from(selected)
    const prevs = new Map(ids.map((id) => [id, rubroEfectivo(id)]))

    setAsignaciones((a) => {
      const copy = { ...a }
      for (const id of ids) copy[id] = bulkRubroId
      return copy
    })

    startBulkTransition(async () => {
      const result = await asignarRubrosBulkAction(ids, bulkRubroId, ejercicioId, sociedadId)
      if (!result.ok) {
        toastError(result.error)
        setAsignaciones((a) => {
          const copy = { ...a }
          for (const [id, prev] of prevs) copy[id] = prev
          return copy
        })
      } else {
        const rubroNombre = rubros.find((r) => r.id === bulkRubroId)?.nombre ?? 'rubro'
        toastSuccess(
          `${ids.length} ${ids.length === 1 ? 'cuenta clasificada' : 'cuentas clasificadas'} como "${rubroNombre}"`,
        )
        setSelected(new Set())
        setBulkRubroId('')
      }
    })
  }

  function handleToggleSelect(id: string) {
    setSelected((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }

  function handleSelectAllVisibles(visibles: CuentaContableDTO[]) {
    if (selected.size === visibles.length && visibles.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibles.map((c) => c.id)))
    }
  }

  return {
    asignaciones,
    saving,
    selected,
    setSelected,
    bulkRubroId,
    setBulkRubroId,
    isBulkPending,
    getEffectiveRubroId,
    handleAsignar,
    handleBulkAsignar,
    handleToggleSelect,
    handleSelectAllVisibles,
  }
}
