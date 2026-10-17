'use client'

import { useState } from 'react'
import { PlusCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import type { ActionResult } from '@/modules/errores/types'
import {
  actualizarNotaAction,
  eliminarNotaAction,
  crearDetalleAction,
  actualizarDetalleAction,
  eliminarDetalleAction,
} from '../actions/notas.actions'
import type { NotaDTO } from '../domain/types'

// Persiste todos los detalles editados de la nota + los campos de la nota, de una vez.
async function guardarNota(
  ejercicioId: string,
  sociedadId: string,
  borrador: NotaDTO,
): Promise<ActionResult<NotaDTO>> {
  const detalleResultados = await Promise.all(
    borrador.detalles
      .filter((d) => !d.esTotal)
      .map((d) =>
        actualizarDetalleAction(d.id, ejercicioId, sociedadId, {
          concepto: d.concepto,
          importeActual: d.importeActual,
          importeAnterior: d.importeAnterior,
        }),
      ),
  )
  const falloDetalle = detalleResultados.find((r) => !r.ok)
  if (falloDetalle && !falloDetalle.ok) return falloDetalle
  return actualizarNotaAction(borrador.id, ejercicioId, sociedadId, {
    criterioMedicion: borrador.criterioMedicion,
    textoApertura: borrador.textoApertura,
  })
}

// ─── Celda editable inline ────────────────────────────────────────────────────

function CeldaConcepto({
  value,
  onBlur,
  placeholder,
}: {
  value: string
  onBlur: (v: string) => void
  placeholder?: string
}) {
  const [local, setLocal] = useState(value)

  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onBlur(local)}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-slate-900 transition-colors hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none"
    />
  )
}

// ─── Nota cuantitativa ────────────────────────────────────────────────────────

export function NotaCuantitativa({
  nota: notaInicial,
  fechaCierre,
  fechaCierreAnterior,
  mostrarAnterior,
  ejercicioId,
  sociedadId,
  onChange,
  onDelete,
}: {
  nota: NotaDTO
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  mostrarAnterior: boolean
  ejercicioId: string
  sociedadId: string
  onChange: (updated: NotaDTO) => void
  onDelete: () => void
}) {
  const {
    valor: nota,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
    sincronizar,
  } = useEdicionLote(notaInicial, (borrador) => guardarNota(ejercicioId, sociedadId, borrador))
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()

  const totalActual = nota.detalles
    .filter((d) => !d.esTotal)
    .reduce((acc, d) => acc + d.importeActual, 0)
  const totalAnterior = nota.detalles
    .filter((d) => !d.esTotal)
    .reduce((acc, d) => acc + d.importeAnterior, 0)

  // ── Borrador: campo de nota (criterio, textoApertura) — se persiste al Guardar
  function saveNotaField(field: 'criterioMedicion' | 'textoApertura', value: string) {
    actualizar((prev) => ({ ...prev, [field]: value || null }))
  }

  // ── Borrador: detalle — se persiste al Guardar
  function saveDetalle(
    id: string,
    field: 'concepto' | 'importeActual' | 'importeAnterior',
    value: string | number,
  ) {
    actualizar((prev) => ({
      ...prev,
      detalles: prev.detalles.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    }))
  }

  // ── Agregar fila — estructural, se persiste de inmediato
  function agregarFila() {
    const orden = nota.detalles.filter((d) => !d.esTotal).length + 1
    ejecutar(
      () => crearDetalleAction(nota.id, ejercicioId, sociedadId, orden),
      (detalle) => {
        const actualizada = { ...nota, detalles: [...nota.detalles, detalle] }
        sincronizar(actualizada)
        onChange(actualizada)
      },
    )
  }

  // ── Eliminar fila — estructural, se persiste de inmediato
  function eliminarFila(id: string) {
    ejecutar(
      () => eliminarDetalleAction(id, ejercicioId, sociedadId),
      () => {
        const actualizada = { ...nota, detalles: nota.detalles.filter((d) => d.id !== id) }
        sincronizar(actualizada)
        onChange(actualizada)
      },
    )
  }

  // ── Eliminar nota
  function eliminarNota() {
    ejecutar(() => eliminarNotaAction(nota.id, ejercicioId, sociedadId), onDelete)
  }

  const isPendingTotal = isPending || isPendingAcciones
  const filasData = nota.detalles.filter((d) => !d.esTotal)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white',
        isPendingTotal && 'opacity-70',
      )}
    >
      {/* Encabezado de nota — idéntico al PDF */}
      <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900">Nota N° {nota.numero ?? '?'}:</span>
            <span className="text-sm font-bold text-slate-900 uppercase">{nota.titulo}</span>
          </div>

          {/* Criterio de medición — solo SSP (no EERR) */}
          {nota.criterioMedicion !== null && (
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-xs text-slate-500">Criterio de medición:</span>
              {editando ? (
                <input
                  type="text"
                  defaultValue={nota.criterioMedicion ?? ''}
                  onBlur={(e) => saveNotaField('criterioMedicion', e.target.value)}
                  className="min-w-[200px] border-b border-dashed border-slate-300 bg-transparent text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
                />
              ) : (
                <span className="text-xs text-slate-600">{nota.criterioMedicion}</span>
              )}
            </div>
          )}
        </div>

        <div className="ml-4 flex flex-shrink-0 items-center gap-2">
          {/* Fechas — columnas del PDF */}
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 tabular-nums">
              {formatFecha(fechaCierre)}
            </p>
            {mostrarAnterior && (
              <p className="text-xs text-slate-400 tabular-nums">
                {fechaCierreAnterior ? formatFecha(fechaCierreAnterior) : 'Ej. anterior'}
              </p>
            )}
          </div>
          {/* Editar — control único de la app */}
          <BotonEditar
            editando={editando}
            onEditar={iniciarEdicion}
            onGuardar={confirmar}
            onCancelar={cancelar}
            isPending={isPending}
          />
          <button
            type="button"
            onClick={eliminarNota}
            disabled={isPendingTotal}
            className="rounded p-1.5 text-slate-300 transition-colors hover:text-red-500"
            title="Eliminar nota"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Texto apertura */}
      {nota.textoApertura && (
        <div className="border-b border-slate-50 px-5 py-2">
          {editando ? (
            <input
              type="text"
              defaultValue={nota.textoApertura}
              onBlur={(e) => saveNotaField('textoApertura', e.target.value)}
              className="w-full border-b border-dashed border-slate-200 bg-transparent text-xs text-slate-500 italic focus:border-blue-400 focus:outline-none"
            />
          ) : (
            <span className="text-xs text-slate-500 italic">{nota.textoApertura}</span>
          )}
        </div>
      )}

      {/* Tabla de detalles */}
      <table className="w-full">
        <tbody>
          {filasData.map((det) => (
            <tr key={det.id} className="group border-b border-slate-50 hover:bg-slate-50/40">
              <td className="px-5 py-1.5">
                {editando ? (
                  <CeldaConcepto
                    value={det.concepto}
                    placeholder="Concepto"
                    onBlur={(v) => saveDetalle(det.id, 'concepto', v)}
                  />
                ) : (
                  <span className="text-sm text-slate-700">{det.concepto}</span>
                )}
              </td>
              <td className="w-36 px-3 py-1.5">
                <CeldaNumero
                  value={det.importeActual}
                  editando={editando}
                  onSave={(v) => saveDetalle(det.id, 'importeActual', v)}
                />
              </td>
              {mostrarAnterior && (
                <td className="w-36 px-3 py-1.5">
                  <CeldaNumero
                    value={det.importeAnterior}
                    editando={editando}
                    onSave={(v) => saveDetalle(det.id, 'importeAnterior', v)}
                  />
                </td>
              )}
              <td className="w-8 px-3 py-1.5 text-center">
                {editando && (
                  <button
                    type="button"
                    onClick={() => eliminarFila(det.id)}
                    disabled={isPendingTotal}
                    className="text-slate-200 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>

        {/* TOTAL — como en el PDF */}
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-5 py-2 text-sm font-bold text-slate-900">TOTAL</td>
            <td className="w-36 px-3 py-2 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
              {formatCurrency(totalActual, { decimales: 2 })}
            </td>
            {mostrarAnterior && (
              <td className="w-36 px-3 py-2 text-right font-mono text-sm font-bold text-slate-700 tabular-nums">
                {formatCurrency(totalAnterior, { decimales: 2 })}
              </td>
            )}
            <td className="w-8" />
          </tr>
        </tfoot>
      </table>

      {/* Agregar fila — solo en modo edición */}
      {editando && (
        <div className="border-t border-slate-100 px-5 py-2">
          <button
            type="button"
            onClick={agregarFila}
            disabled={isPendingTotal}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-blue-600"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Agregar fila
          </button>
        </div>
      )}
    </div>
  )
}
