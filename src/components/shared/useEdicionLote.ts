'use client'

import { useState } from 'react'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { useGuardarAccion } from './useGuardarAccion'
import type { ActionResult } from '@/modules/errores/types'

/**
 * Modo edición ÚNICO de la app para regiones con números editables:
 * Editar → se edita un borrador local (nada se persiste) → Guardar (un solo
 * commit) o Cancelar (descarta el borrador). Reemplaza el auto-guardado on-blur
 * por celda: ninguna `CeldaNumero` debe llamar a una server action directamente,
 * solo debe actualizar el borrador vía `actualizar`.
 *
 * `guardar` recibe el borrador completo y hace el/los llamados a la(s) server
 * action(s) que correspondan; se ejecuta a través de `useGuardarAccion` así
 * el manejo de pending/error queda centralizado.
 */
export function useEdicionLote<T>(
  data: T,
  guardar: (borrador: T) => Promise<ActionResult<T>>,
  mensajeExito = 'Guardado',
) {
  const [guardado, setGuardado] = useState(data)
  const [borrador, setBorrador] = useState(data)
  const [editando, setEditando] = useState(false)
  const { isPending, ejecutar } = useGuardarAccion()

  function iniciarEdicion() {
    setBorrador(guardado)
    setEditando(true)
  }

  function cancelar() {
    setBorrador(guardado)
    setEditando(false)
  }

  function actualizar(updater: T | ((prev: T) => T)) {
    setBorrador((prev) =>
      typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater,
    )
  }

  function confirmar() {
    ejecutar(
      () => guardar(borrador),
      (resultado) => {
        setGuardado(resultado)
        setBorrador(resultado)
        setEditando(false)
        toastSuccess(mensajeExito)
      },
    )
  }

  /** Sincroniza el valor base cuando cambia desde el servidor sin pasar por este hook (ej. revalidate). */
  function sincronizar(nuevo: T) {
    setGuardado(nuevo)
    if (!editando) setBorrador(nuevo)
  }

  return {
    valor: editando ? borrador : guardado,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
    sincronizar,
  }
}
