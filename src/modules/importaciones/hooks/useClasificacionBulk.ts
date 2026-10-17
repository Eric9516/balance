'use client'

import { useState, useTransition } from 'react'
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

  function getEffectiveRubroId(c: CuentaContableDTO): string | null {
    return c.id in asignaciones ? asignaciones[c.id] : c.rubroBaseId
  }

  async function handleAsignar(cuentaId: string, nuevoRubroId: string | null) {
    const prev = getEffectiveRubroId(cuentas.find((c) => c.id === cuentaId)!)
    setAsignaciones((a) => ({ ...a, [cuentaId]: nuevoRubroId }))
    setSaving((s) => { const ns = new Set(s); ns.add(cuentaId); return ns })
    const result = await asignarRubroAction(cuentaId, nuevoRubroId, ejercicioId, sociedadId)
    setSaving((s) => { const ns = new Set(s); ns.delete(cuentaId); return ns })
    if (!result.ok) {
      toastError(result.error)
      setAsignaciones((a) => ({ ...a, [cuentaId]: prev }))
    }
  }

  function handleBulkAsignar() {
    if (!bulkRubroId || selected.size === 0) return
    const ids = Array.from(selected)
    const prevs: Record<string, string | null> = {}
    for (const id of ids) prevs[id] = getEffectiveRubroId(cuentas.find((c) => c.id === id)!)

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
          for (const id of ids) copy[id] = prevs[id]
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
