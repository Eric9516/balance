'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, PlusCircle, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatFecha } from '@/lib/utils/dates'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { crearBienDeUsoAction, eliminarBienDeUsoAction } from '../actions/bienes-de-uso.actions'
import { guardarLoteBienes } from '../lib/guardarLoteBienes'
import { calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { AvisosArrastre } from '@/components/shared/AvisosArrastre'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { useGruposColumnas } from '@/components/shared/useGruposColumnas'
import { ToggleDensidad, TogglePlegarTodos } from '@/components/shared/ControlesTabla'
import { COLUMNAS_BDU, FilaCategoria, FilaTotal, GRUPOS_BDU, type GrupoBDU } from './FilaCategoria'

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
  /** Neto residual al cierre del ejercicio anterior, por nombre de categoría. */
  netoAnteriorMap: Map<string, number>
  /** ids de filas cuyas columnas de inicio vienen del ejercicio anterior vinculado. */
  bloqueadas: string[]
  /** Fuentes faltantes en el anterior (filas que quedan editables). */
  advertencias: string[]
  /** Si se muestra la columna "Neto residual ejercicio anterior" (VINCULADO y MANUAL). */
  mostrarAnterior: boolean
  /** Solo en modo MANUAL: el neto residual anterior se carga a mano. */
  editarAnterior: boolean
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
}

export function BienesDeUsoView({
  bienes: initialBienes,
  netoAnteriorMap,
  bloqueadas,
  advertencias,
  mostrarAnterior,
  editarAnterior,
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
  } = useEdicionLote(initialBienes, (borrador) =>
    guardarLoteBienes(borrador, ejercicioId, sociedadId),
  )
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [mostrarInput, setMostrarInput] = useState(false)
  const grupos = useGruposColumnas('anexo-bienes-de-uso', GRUPOS_BDU)
  // En edición se ven todas las columnas: no se puede cargar lo que está plegado.
  const plegado = (g: GrupoBDU) => !editando && grupos.estaPlegado(g)
  const columnasDe = (g: GrupoBDU) =>
    plegado(g) ? [COLUMNAS_BDU[g].plegado] : COLUMNAS_BDU[g].columnas
  const columnas = GRUPOS_BDU.flatMap(columnasDe)

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
  const bloqueadasSet = new Set(bloqueadas)

  const thGrupo =
    'border-b border-l border-linea px-3 py-2 text-center text-tabla-sm font-semibold tracking-wide text-slate-600 uppercase'
  const thCol =
    'celda min-w-[8.5rem] border-b border-linea text-right align-bottom text-tabla-sm font-medium text-slate-600'

  if (bienes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-linea bg-superficie py-16 text-center">
        <PackageOpen className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">Sin bienes de uso cargados</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Agregá una categoría para empezar. Los datos los sacás del sistema contable del cliente.
        </p>
        <div className="mt-5 space-y-2">
          <p className="text-xs text-slate-400">Categorías habituales:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIAS_DEFAULT.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleAgregar(cat)}
                disabled={isPendingTotal}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
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
      {/* Leyenda + avisos de arrastre + control de edición */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="inline-block h-3 w-3 rounded border border-linea bg-slate-50" />
            Calculado automáticamente
          </span>
          <AvisosArrastre bloqueado={bloqueadas.length > 0} advertencias={advertencias} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ToggleDensidad />
          <TogglePlegarTodos
            todosPlegados={grupos.todosPlegados}
            onPlegar={grupos.plegarTodos}
            onExpandir={grupos.expandirTodos}
            disabled={editando}
          />
          <BotonEditar
            editando={editando}
            onEditar={iniciarEdicion}
            onGuardar={confirmar}
            onCancelar={cancelar}
            isPending={isPending}
          />
        </div>
      </div>

      {/* Tabla */}
      <section
        className={cn(
          'overflow-hidden rounded-xl border border-linea bg-superficie',
          isPendingTotal && 'opacity-70',
        )}
      >
        <header className="border-b border-linea px-5 py-4 text-center">
          <h2 className="font-serif text-lg font-semibold text-tinta">Anexo I — Bienes de uso</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Al {formatFecha(fechaCierre)}
            {mostrarAnterior &&
              `, comparativo con ${formatFecha(fechaCierreAnterior, 'el ejercicio anterior')}`}
          </p>
        </header>
        <div className="max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full border-separate border-spacing-0 tabla-trabajo">
            <thead className="sticky top-0 z-20 bg-superficie">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 min-w-[14rem] border-b border-linea bg-superficie celda text-left align-bottom text-tabla-sm font-semibold text-slate-600 uppercase"
                >
                  Rubros
                </th>
                {GRUPOS_BDU.map((g) => {
                  const cerrado = plegado(g)
                  const Icono = cerrado ? ChevronRight : ChevronLeft
                  return (
                    <th key={g} colSpan={columnasDe(g).length} className={thGrupo}>
                      <button
                        type="button"
                        onClick={() => grupos.alternar(g)}
                        disabled={editando}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:hover:bg-transparent"
                        title={cerrado ? 'Ver detalle' : 'Mostrar solo el total'}
                      >
                        {COLUMNAS_BDU[g].titulo}
                        {!editando && <Icono className="h-3.5 w-3.5 text-slate-400" />}
                      </button>
                    </th>
                  )
                })}
                <th colSpan={mostrarAnterior ? 2 : 1} className={cn(thGrupo, 'border-l-slate-300')}>
                  Neto residual
                </th>
                <th rowSpan={2} className="w-12 border-b border-linea" />
              </tr>
              <tr>
                {GRUPOS_BDU.map((g) =>
                  columnasDe(g).map((col, i) => (
                    <th
                      key={`${g}-${i}`}
                      className={cn(thCol, i === 0 && 'border-l border-l-linea')}
                    >
                      {col.label}
                    </th>
                  )),
                )}
                <th className={cn(thCol, 'border-l border-l-slate-300')}>
                  <div className="font-semibold text-slate-800">Ejercicio actual</div>
                  <div className="font-normal text-slate-400 tabular-nums">
                    {formatFecha(fechaCierre)}
                  </div>
                </th>
                {mostrarAnterior && (
                  <th className={thCol}>
                    <div className="font-semibold text-slate-800">Ejercicio anterior</div>
                    {fechaCierreAnterior && (
                      <div className="font-normal text-slate-400 tabular-nums">
                        {formatFecha(fechaCierreAnterior)}
                      </div>
                    )}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {bienes.map((bien) => (
                <FilaCategoria
                  key={bien.id}
                  bien={bien}
                  columnas={columnas}
                  netoAnterior={netoAnteriorMap.get(bien.categoria) ?? null}
                  bloqueada={bloqueadasSet.has(bien.id)}
                  mostrarAnterior={mostrarAnterior}
                  editarAnterior={editarAnterior}
                  editando={editando}
                  onGuardarCampo={(campo, v) => guardarBien({ ...bien, [campo]: v })}
                  onGuardarCategoria={(v) => guardarBien({ ...bien, categoria: v })}
                  onGuardarNetoAnterior={(v) => guardarNetoAnterior(bien, v)}
                  onDelete={() => handleDelete(bien.id)}
                />
              ))}
            </tbody>
            <tfoot>
              <FilaTotal
                bienes={bienes}
                columnas={columnas}
                netoAnteriorMap={netoAnteriorMap}
                mostrarAnterior={mostrarAnterior}
                editarAnterior={editarAnterior}
              />
            </tfoot>
          </table>
        </div>
      </section>

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
                if (e.key === 'Escape') {
                  setMostrarInput(false)
                  setNuevaCategoria('')
                }
              }}
              placeholder="Nombre de la categoría"
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
            />
            <Button
              size="sm"
              onClick={() => handleAgregar(nuevaCategoria)}
              disabled={!nuevaCategoria.trim() || isPendingTotal}
            >
              Agregar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMostrarInput(false)
                setNuevaCategoria('')
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarInput(true)}
            className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-blue-600"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar categoría
          </button>
        )}
      </div>
    </div>
  )
}
