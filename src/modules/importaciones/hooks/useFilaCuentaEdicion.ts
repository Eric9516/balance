'use client'

import { useState, useTransition } from 'react'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { actualizarCuentaAction, eliminarCuentaAction } from '../actions/clasificacion.actions'
import type { CuentaContableDTO } from '../domain/types'
import { importesDeFila } from '../domain/importacion'
import { importeEditable, parseImporte } from '@/lib/utils/parseImporte'

export type DraftRow = {
  nombre: string
  saldoDeudor: string
  saldoAcreedor: string
  saldoFinal: string
}

/** Edición inline + eliminación de una fila de cuenta. Un solo origen de verdad por tabla. */
export function useFilaCuentaEdicion(ejercicioId: string, sociedadId: string) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draftRow, setDraftRow] = useState<DraftRow | null>(null)
  const [isSavingEdit, startEditTransition] = useTransition()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  function handleEditStart(c: CuentaContableDTO) {
    setEditingRowId(c.id)
    setDraftRow({
      nombre: c.nombre,
      saldoDeudor: importeEditable(c.saldoDeudor),
      saldoAcreedor: importeEditable(c.saldoAcreedor),
      saldoFinal: importeEditable(c.saldoFinal),
    })
  }

  function handleEditCancel() {
    setEditingRowId(null)
    setDraftRow(null)
  }

  /** Cambiar debe o haber recalcula el saldo automáticamente. */
  function actualizarImporte(campo: 'saldoDeudor' | 'saldoAcreedor', v: string) {
    if (!draftRow) return
    const fila = { ...draftRow, [campo]: v }
    setDraftRow({ ...fila, saldoFinal: importeEditable(importesDeFila(fila).saldoFinal) })
  }
  const handleDraftDeudorChange = (v: string) => actualizarImporte('saldoDeudor', v)
  const handleDraftAcreedorChange = (v: string) => actualizarImporte('saldoAcreedor', v)

  function setDraftField(field: 'nombre' | 'saldoFinal', value: string) {
    if (!draftRow) return
    setDraftRow({ ...draftRow, [field]: value })
  }

  function handleEditSave(cuentas: CuentaContableDTO[]) {
    if (!editingRowId || !draftRow) return
    const c = cuentas.find((x) => x.id === editingRowId)
    if (!c) return

    const nombre = draftRow.nombre.trim() || c.nombre
    const saldoDeudor = parseImporte(draftRow.saldoDeudor)
    const saldoAcreedor = parseImporte(draftRow.saldoAcreedor)
    const saldoFinal = parseImporte(draftRow.saldoFinal)

    const data: Parameters<typeof actualizarCuentaAction>[1] = {}
    if (nombre !== c.nombre) data.nombre = nombre
    if (saldoDeudor !== c.saldoDeudor) data.saldoDeudor = saldoDeudor
    if (saldoAcreedor !== c.saldoAcreedor) data.saldoAcreedor = saldoAcreedor
    if (saldoFinal !== c.saldoFinal) data.saldoFinal = saldoFinal

    // Sin cambios → cerrar sin llamar al servidor
    if (Object.keys(data).length === 0) {
      setEditingRowId(null)
      setDraftRow(null)
      return
    }

    startEditTransition(async () => {
      const result = await actualizarCuentaAction(editingRowId, data, ejercicioId, sociedadId)
      if (result.ok) {
        toastSuccess('Cuenta actualizada')
        setEditingRowId(null)
        setDraftRow(null)
      } else {
        toastError(result.error)
      }
    })
  }

  async function handleDeleteConfirm(cuentaId: string) {
    setConfirmDeleteId(null)
    setIsDeletingId(cuentaId)
    const result = await eliminarCuentaAction(cuentaId, ejercicioId, sociedadId)
    setIsDeletingId(null)
    if (!result.ok) toastError(result.error)
  }

  function resetSeleccion() {
    setEditingRowId(null)
    setDraftRow(null)
    setConfirmDeleteId(null)
  }

  return {
    editingRowId,
    draftRow,
    isSavingEdit,
    confirmDeleteId,
    isDeletingId,
    setDraftField,
    handleEditStart,
    handleEditCancel,
    handleDraftDeudorChange,
    handleDraftAcreedorChange,
    handleEditSave,
    handleDeleteConfirm,
    setConfirmDeleteId,
    resetSeleccion,
  }
}
