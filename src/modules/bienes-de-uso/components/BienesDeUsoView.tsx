'use client'

import { useState } from 'react'
import { PlusCircle, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatFecha } from '@/lib/utils/dates'
import { toastSuccess } from '@/modules/errores/components/Toast'
import {
  crearBienDeUsoAction,
  eliminarBienDeUsoAction,
} from '../actions/bienes-de-uso.actions'
import { guardarLoteBienes } from '../lib/guardarLoteBienes'
import { calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { FilaCategoria, FilaTotal } from './FilaCategoria'

// ─── Componente principal ─────────────────────────────────────────────────────

const CATEGORIAS_DEFAULT = [
  'Inmuebles',
  'Muebles y útiles',
  'Maquinaria y equipo',
  'Rodados',
  'Instalaciones',
  'Equipos informáticos',
]

interface Props {
  bienes: BienDeUsoDTO[]
  netoAnteriorMap: Map<string, number>
  hayEjercicioAnterior: boolean
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
}

export function BienesDeUsoView({
  bienes: initialBienes,
  netoAnteriorMap,
  hayEjercicioAnterior,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
}: Props) {
  const {
    valor: bienes,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
  } = useEdicionLote(initialBienes, (borrador) => guardarLoteBienes(borrador, ejercicioId, sociedadId))
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [mostrarInput, setMostrarInput] = useState(false)

  function setBien(updated: BienDeUsoDTO) {
    actualizar((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }

  // Solo actualiza el borrador (recalcula cierre/neto para feedback inmediato). Se persiste al Guardar.
  function guardarBien(actualizado: BienDeUsoDTO) {
    setBien({ ...actualizado, ...calcularCierre(actualizado) })
  }

  function guardarNetoAnterior(bien: BienDeUsoDTO, valor: number) {
    setBien({ ...bien, netoResidualAnteriorManual: valor || null })
  }

  function handleDelete(id: string) {
    ejecutar(
      () => eliminarBienDeUsoAction(id, ejercicioId, sociedadId),
      () => actualizar((prev) => prev.filter((b) => b.id !== id)),
    )
  }

  function handleAgregar(cat: string) {
    if (!cat.trim()) return
    ejecutar(
      () => crearBienDeUsoAction(ejercicioId, sociedadId, cat.trim()),
      (nuevo) => {
        actualizar((prev) => [...prev, nuevo])
        setNuevaCategoria('')
        setMostrarInput(false)
        toastSuccess(`Categoría "${cat.trim()}" agregada`)
      },
    )
  }

  const isPendingTotal = isPending || isPendingAcciones

  const thCls = 'px-2 py-2 text-right text-[10px] font-semibold text-slate-300 uppercase tracking-wide whitespace-nowrap w-36'
  const thCalcCls = 'px-2 py-2 text-right text-[10px] font-semibold text-blue-300 uppercase tracking-wide whitespace-nowrap w-36 bg-slate-700'

  if (bienes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
        <PackageOpen className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-700">Sin bienes de uso cargados</p>
        <p className="mt-1 text-xs text-slate-400 max-w-xs">
          Agregá una categoría para empezar. Los datos los sacás del sistema contable del cliente.
        </p>
        <div className="mt-5 space-y-2">
          <p className="text-xs text-slate-400">Categorías habituales:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIAS_DEFAULT.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleAgregar(cat)}
                disabled={isPendingTotal}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Leyenda + control de edición */}
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-200" />
          Calculado automáticamente
        </span>
        <BotonEditar
          editando={editando}
          onEditar={iniciarEdicion}
          onGuardar={confirmar}
          onCancelar={cancelar}
          isPending={isPending}
          className="flex-shrink-0"
        />
      </div>

      {/* Tabla scrollable */}
      <div className={cn('overflow-x-auto rounded-xl border border-slate-200 bg-white', isPendingTotal && 'opacity-70')}>
        <table className="w-full text-sm" style={{ minWidth: '1760px' }}>
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide sticky left-0 bg-slate-800 z-10 min-w-[180px]">
                R U B R O S
              </th>
              <th colSpan={5} className="px-2 py-2 text-center text-[10px] font-bold text-slate-200 uppercase tracking-wider border-l border-slate-700">
                VALOR DE ORIGEN
              </th>
              <th colSpan={5} className="px-2 py-2 text-center text-[10px] font-bold text-slate-200 uppercase tracking-wider border-l border-slate-700">
                AMORTIZACIONES ACUMULADAS
              </th>
              <th colSpan={2} className="px-2 py-2 text-center text-[10px] font-bold text-slate-200 uppercase tracking-wider border-l border-slate-700">
                NETO RESIDUAL
              </th>
              <th className="w-20" />
            </tr>
            <tr className="bg-slate-800 border-b border-slate-600">
              <th className="sticky left-0 bg-slate-800 z-10" />
              <th className={cn(thCls, 'border-l border-slate-700')}>Valor al comienzo del ejercicio</th>
              <th className={thCls}>Ajuste por Inflación</th>
              <th className={thCls}>Aumentos del ejercicio</th>
              <th className={thCls}>Disminuciones</th>
              <th className={thCalcCls}>Valor al cierre del ejercicio</th>
              <th className={cn(thCls, 'border-l border-slate-700')}>Acumuladas al comienzo del ejercicio</th>
              <th className={thCls}>Ajuste por Inflación</th>
              <th className={thCls}>Baja</th>
              <th className={thCls}>del ejercicio</th>
              <th className={thCalcCls}>Acumuladas al cierre del ejercicio</th>
              <th className={cn(thCalcCls, 'border-l border-slate-700')}>{formatFecha(fechaCierre)}</th>
              <th className={thCls}>{fechaCierreAnterior ? formatFecha(fechaCierreAnterior) : 'Ej. Anterior'}</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {bienes.map((bien) => (
              <FilaCategoria
                key={bien.id}
                bien={bien}
                netoAnterior={netoAnteriorMap.get(bien.categoria) ?? null}
                editando={editando}
                onGuardarCampo={(campo, v) => guardarBien({ ...bien, [campo]: v })}
                onGuardarCategoria={(v) => guardarBien({ ...bien, categoria: v })}
                onGuardarNetoAnterior={(v) => guardarNetoAnterior(bien, v)}
                onDelete={() => handleDelete(bien.id)}
              />
            ))}
          </tbody>
          <tfoot>
            <FilaTotal bienes={bienes} netoAnteriorMap={netoAnteriorMap} hayEjercicioAnterior={hayEjercicioAnterior} />
          </tfoot>
        </table>
      </div>

      {/* Agregar categoría */}
      <div className="flex items-center gap-3">
        {mostrarInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAgregar(nuevaCategoria)
                if (e.key === 'Escape') { setMostrarInput(false); setNuevaCategoria('') }
              }}
              placeholder="Nombre de la categoría"
              className="text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 w-56"
            />
            <Button size="sm" onClick={() => handleAgregar(nuevaCategoria)} disabled={!nuevaCategoria.trim() || isPendingTotal}>
              Agregar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMostrarInput(false); setNuevaCategoria('') }}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarInput(true)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar categoría
          </button>
        )}
      </div>
    </div>
  )
}
