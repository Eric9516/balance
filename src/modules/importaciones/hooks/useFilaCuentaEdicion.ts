'use client'

import { useState, useTransition } from 'react'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import type { ActionResult } from '@/modules/errores/types'
import {
  actualizarCuentaAction,
  eliminarCuentaAction,
  type CambioCuentaHecho,
} from '../actions/clasificacion.actions'
import type { CuentaContableDTO } from '../domain/types'
import {
  efectoDeCambio,
  efectoEnCuadre,
  importesDeFila,
  type EfectoEnCuadre,
} from '../domain/importacion'
import { importeEditable, parseImporte } from '@/lib/utils/parseImporte'

export type DraftRow = {
  nombre: string
  saldoDeudor: string
  saldoAcreedor: string
  saldoFinal: string
}

type CambiosCuenta = Parameters<typeof actualizarCuentaAction>[1]

/** Un cambio que descuadra el balance, esperando que la persona lo confirme en el cartel. */
export type CambioPorConfirmar = {
  tipo: 'EDITAR' | 'BORRAR'
  cuenta: Pick<CuentaContableDTO, 'id' | 'codigo' | 'nombre'>
  efecto: EfectoEnCuadre
  /** Lo que se guarda si se confirma (solo al editar). */
  data?: CambiosCuenta
}

/**
 * Edición inline + eliminación de una fila de cuenta. Un solo origen de verdad por tabla.
 *
 * Si el cambio descuadra el balance de sumas y saldos (o agranda el descuadre), antes de guardar
 * se pregunta con el cartel (`porConfirmar`). El servidor hace el mismo control (NEG-069): si la
 * pantalla quedó vieja y él ve el descuadre, el cartel se abre con lo que calculó él.
 */
export function useFilaCuentaEdicion(ejercicioId: string, sociedadId: string) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draftRow, setDraftRow] = useState<DraftRow | null>(null)
  const [isSavingEdit, startEditTransition] = useTransition()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  const [porConfirmar, setPorConfirmar] = useState<CambioPorConfirmar | null>(null)

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

  /** Si el servidor rechazó por descuadre (NEG-069), abre el cartel con lo que calculó él. */
  function pedirConfirmacion(
    result: ActionResult<CambioCuentaHecho>,
    tipo: CambioPorConfirmar['tipo'],
    cuenta: CambioPorConfirmar['cuenta'],
    data?: CambiosCuenta,
  ): boolean {
    if (result.ok || result.error.codigo !== 'NEG-069') return false
    const { antes, despues } = result.error.contexto ?? {}
    if (typeof antes !== 'number' || typeof despues !== 'number') return false
    setPorConfirmar({ tipo, cuenta, efecto: efectoEnCuadre(antes, despues), data })
    return true
  }

  function guardarEdicion(
    cuenta: CambioPorConfirmar['cuenta'],
    data: CambiosCuenta,
    aceptar: boolean,
  ) {
    startEditTransition(async () => {
      const result = await actualizarCuentaAction(cuenta.id, data, ejercicioId, sociedadId, {
        aceptarDescuadre: aceptar,
      })
      if (result.ok) {
        setPorConfirmar(null)
        toastSuccess(
          result.data.efecto?.arregla
            ? 'Cuenta actualizada. El balance cuadra.'
            : 'Cuenta actualizada',
        )
        setEditingRowId(null)
        setDraftRow(null)
      } else if (!pedirConfirmacion(result, 'EDITAR', cuenta, data)) {
        setPorConfirmar(null)
        toastError(result.error)
      }
    })
  }

  function handleEditSave(cuentas: CuentaContableDTO[]) {
    if (!editingRowId || !draftRow) return
    const c = cuentas.find((x) => x.id === editingRowId)
    if (!c) return

    const nombre = draftRow.nombre.trim() || c.nombre
    const saldoDeudor = parseImporte(draftRow.saldoDeudor)
    const saldoAcreedor = parseImporte(draftRow.saldoAcreedor)
    const saldoFinal = parseImporte(draftRow.saldoFinal)

    const data: CambiosCuenta = {}
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

    // Si cambia el debe o el haber, antes de guardar se mira qué le pasa al cuadre
    if (data.saldoDeudor !== undefined || data.saldoAcreedor !== undefined) {
      const efecto = efectoDeCambio(cuentas, {
        tipo: 'EDITAR',
        cuentaId: c.id,
        saldoDeudor,
        saldoAcreedor,
      })
      if (efecto.descuadra) {
        setPorConfirmar({ tipo: 'EDITAR', cuenta: c, efecto, data })
        return
      }
    }
    guardarEdicion(c, data, false)
  }

  /** Tacho: si borrarla descuadra el balance, pregunta el cartel; si no, el "¿Borrar?" de la fila. */
  function pedirBorrado(cuenta: CuentaContableDTO, cuentas: CuentaContableDTO[]) {
    handleEditCancel()
    const efecto = efectoDeCambio(cuentas, { tipo: 'BORRAR', cuentaId: cuenta.id })
    if (efecto.descuadra) {
      setConfirmDeleteId(null)
      setPorConfirmar({ tipo: 'BORRAR', cuenta, efecto })
    } else {
      setConfirmDeleteId(cuenta.id)
    }
  }

  async function borrar(cuenta: CambioPorConfirmar['cuenta'], aceptar: boolean) {
    setConfirmDeleteId(null)
    setIsDeletingId(cuenta.id)
    const result = await eliminarCuentaAction(cuenta.id, ejercicioId, sociedadId, {
      aceptarDescuadre: aceptar,
    })
    setIsDeletingId(null)
    if (result.ok) {
      setPorConfirmar(null)
      if (result.data.efecto?.arregla) toastSuccess('Cuenta borrada. El balance cuadra.')
    } else if (!pedirConfirmacion(result, 'BORRAR', cuenta)) {
      setPorConfirmar(null)
      toastError(result.error)
    }
  }

  const handleDeleteConfirm = (cuenta: CuentaContableDTO) => borrar(cuenta, false)

  /** "Guardar igual" / "Borrar igual" del cartel: el servidor guarda aunque descuadre. */
  function confirmarDescuadre() {
    if (!porConfirmar) return
    if (porConfirmar.tipo === 'EDITAR') {
      if (porConfirmar.data) guardarEdicion(porConfirmar.cuenta, porConfirmar.data, true)
    } else {
      void borrar(porConfirmar.cuenta, true)
    }
  }

  /** "Volver": no se guarda nada; si se estaba editando, la fila sigue con lo escrito. */
  const cancelarDescuadre = () => setPorConfirmar(null)

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
    porConfirmar,
    guardandoConfirmado: isSavingEdit || isDeletingId !== null,
    setDraftField,
    handleEditStart,
    handleEditCancel,
    handleDraftDeudorChange,
    handleDraftAcreedorChange,
    handleEditSave,
    handleDeleteConfirm,
    pedirBorrado,
    confirmarDescuadre,
    cancelarDescuadre,
    setConfirmDeleteId,
    resetSeleccion,
  }
}
