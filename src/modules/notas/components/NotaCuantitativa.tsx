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
import { totalesNota, type NotaDTO } from '../domain/types'

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

// ─── Encabezado de columna comparativa ───────────────────────────────────────
// Título + fecha de cierre (si la hay), alineado con la columna de importes.

function EncabezadoEjercicio({
  titulo,
  fecha,
  atenuado = false,
}: {
  titulo: string
  fecha: Date | null
  atenuado?: boolean
}) {
  return (
    <th className="w-36 px-3 py-1.5 text-right align-bottom">
      <div
        className={cn(
          'text-[10px] font-semibold tracking-wide uppercase',
          atenuado ? 'text-slate-400' : 'text-slate-500',
        )}
      >
        {titulo}
      </div>
      {fecha && (
        <div className="font-mono text-[11px] font-normal text-slate-400 tabular-nums">
          {formatFecha(fecha)}
        </div>
      )}
    </th>
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
  /**
   * Avisa a la lista de notas cómo cambió la nota ya guardada. Recibe una función para que la
   * lista la aplique sobre su propia copia (la usa al volver a dibujar las notas).
   */
  onChange: (cambio: (prev: NotaDTO) => NotaDTO) => void
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
  } = useEdicionLote(notaInicial, async (borrador) => {
    const resultado = await guardarNota(ejercicioId, sociedadId, borrador)
    if (resultado.ok) onChange(() => resultado.data)
    return resultado
  })
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()

  const { actual: totalActual, anterior: totalAnterior } = totalesNota(nota)

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

  /**
   * Alta o baja de una fila ya persistida: se aplica a lo guardado y al borrador por separado (las
   * ediciones sin guardar siguen siendo borrador) y a la copia de la lista de notas.
   */
  function aplicarEstructural(cambio: (n: NotaDTO) => NotaDTO) {
    sincronizar((prev) => cambio(prev))
    onChange(cambio)
  }

  // ── Agregar fila — estructural, se persiste de inmediato
  function agregarFila() {
    const orden = nota.detalles.filter((d) => !d.esTotal).length + 1
    ejecutar(
      () => crearDetalleAction(nota.id, ejercicioId, sociedadId, orden),
      (detalle) => aplicarEstructural((n) => ({ ...n, detalles: [...n.detalles, detalle] })),
    )
  }

  // ── Eliminar fila — estructural, se persiste de inmediato
  function eliminarFila(id: string) {
    ejecutar(
      () => eliminarDetalleAction(id, ejercicioId, sociedadId),
      () => aplicarEstructural((n) => ({ ...n, detalles: n.detalles.filter((d) => d.id !== id) })),
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
        {/* Encabezado de columnas — como en el PDF: ejercicio + fecha de cierre */}
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-5 py-1.5" />
            <EncabezadoEjercicio titulo="Ejercicio actual" fecha={fechaCierre} />
            {mostrarAnterior && (
              <EncabezadoEjercicio
                titulo="Ejercicio anterior"
                fecha={fechaCierreAnterior}
                atenuado
              />
            )}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {filasData.map((det) => (
            <tr key={det.id} className="group border-b border-slate-50 hover:bg-acento-suave">
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
