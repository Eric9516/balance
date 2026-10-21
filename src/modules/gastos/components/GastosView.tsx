'use client'

import { useState } from 'react'
import { useMontado } from '@/components/shared/useMontado'
import { Settings2 } from 'lucide-react'
import { toastError } from '@/modules/errores/components/Toast'
import {
  toggleGastoSeccionAction,
  reordenarGastoSeccionAction,
  toggleAparecEnEERRAction,
} from '../actions/gastos-config.actions'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'
import { esSeccionHuerfana } from '../lib/seccionHuerfana'
import { claveFilaAnteriorEnSeccion, filasAnexoGastos } from '../domain/filasAnexo'
import {
  ToggleEditarAnterior,
  useComparativoLote,
  type ComparativoEntry,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import { ConfigModal } from './ConfigModal'
import { TablaGastos } from './TablaGastos'

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  data: GastosSecciones
  ejercicioId: string
  sociedadId: string
  conComparativo?: boolean
  editarAnterior?: boolean
}

export function GastosView({
  data,
  ejercicioId,
  sociedadId,
  conComparativo = false,
  editarAnterior = false,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const mounted = useMontado()
  // Sin columna comparativa (SIN_ANTERIOR / PENDIENTE) no hay nada que editar del anterior.
  const puedeEditarAnterior = conComparativo && editarAnterior

  // Secciones "huérfanas": existieron solo en el período anterior (carga manual).
  const seccionesHuerfanas = data.secciones.filter((s) => esSeccionHuerfana(s.key))
  const seccionesRegulares = data.secciones.filter((s) => !esSeccionHuerfana(s.key))

  // Selección: inicialmente las que tienen esGastoDefault=true
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(
    () => new Set(data.todasSecciones.filter((s) => s.esGastoDefault).map((s) => s.key)),
  )

  // Secciones filtradas según selección (sin las huérfanas, que van como columnas extra)
  const seccionesVisibles = seccionesRegulares.filter((s) => seleccionadas.has(s.key))
  // Las huérfanas (solo del anterior) se muestran como columnas extra cuando falta
  // el balance anterior, para que el dato cargado quede siempre reflejado.
  const huerfanasVisibles = puedeEditarAnterior ? seccionesHuerfanas : []

  // Filas del anexo (regla única, también la usa el documento). En carga manual traen el
  // importe anterior de cada fila y las filas que solo existieron en el anterior.
  // Filas del anexo (regla única, también la usan el documento y el Estado de Resultados). En carga
  // manual traen el importe anterior de cada fila y los gastos que solo existieron el año pasado.
  const filas = filasAnexoGastos(
    [...seccionesVisibles, ...huerfanasVisibles],
    data.anteriorManualPorFila,
  )

  // Columna "Ejercicio Anterior" — borrador independiente, propio Guardar/Cancelar. En carga
  // manual el anterior se carga una sola vez, fila por fila ('GASTOS_FILA'): una entrada por fila,
  // o una por sección si este año la fila está en varias. Los totales por sección se calculan.
  const entradasAnterior: ComparativoEntry[] = puedeEditarAnterior
    ? filas.flatMap((f): ComparativoEntry[] =>
        f.soloAnterior || f.secciones.length <= 1
          ? [
              {
                modulo: 'GASTOS_FILA',
                clave: f.clave,
                label: f.nombre,
                valor: f.totalAnterior,
                esHuerfano: f.soloAnterior,
              },
            ]
          : f.secciones.map((sec) => ({
              modulo: 'GASTOS_FILA' as const,
              clave: claveFilaAnteriorEnSeccion(f.nombre, sec),
              label: f.nombre,
              valor: f.anteriorPorSeccion[sec] ?? 0,
              esHuerfano: false,
            })),
      )
    : []
  const comparativo = useComparativoLote(entradasAnterior, ejercicioId, sociedadId)

  function handleToggle(key: string, value: boolean) {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })

    // Persistir esGasto en DB para grupos personalizados
    if (key.startsWith('grupo:')) {
      const grupoId = key.replace('grupo:', '')
      toggleGastoSeccionAction(grupoId, value, sociedadId, ejercicioId).then((result) => {
        if (!result.ok) toastError(result.error)
      })
    }
  }

  const haySecciones = seccionesVisibles.length > 0

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Columnas y filas se calculan automáticamente desde las cuentas clasificadas.
        </p>
        <div className="flex items-center gap-2">
          {puedeEditarAnterior && (
            <ToggleEditarAnterior
              editando={comparativo.editando}
              isPending={comparativo.isPending}
              onEditar={comparativo.iniciarEdicion}
              onGuardar={comparativo.confirmar}
              onCancelar={comparativo.cancelar}
            />
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configurar secciones
            {seleccionadas.size > 0 && (
              <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {seleccionadas.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Modal */}
      {mounted && showModal && (
        <ConfigModal
          todasSecciones={data.todasSecciones}
          seleccionadas={seleccionadas}
          onToggle={handleToggle}
          onToggleEERR={(key, value) => {
            toggleAparecEnEERRAction(key, value, sociedadId, ejercicioId).then((result) => {
              if (!result.ok) toastError(result.error)
            })
          }}
          onMover={(keyA, keyB) => {
            reordenarGastoSeccionAction(keyA, keyB, sociedadId, ejercicioId).then((result) => {
              if (!result.ok) toastError(result.error)
            })
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Tabla o empty state */}
      {!haySecciones ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-slate-500">No hay secciones seleccionadas con datos.</p>
          <p className="mt-1 text-xs text-slate-400">
            Usá “Configurar secciones” para elegir qué aparece en el Anexo III.
          </p>
        </div>
      ) : (
        <>
          <TablaGastos
            secciones={seccionesVisibles}
            huerfanas={huerfanasVisibles}
            filas={filas}
            conComparativo={conComparativo}
            editarAnterior={puedeEditarAnterior}
            comparativo={comparativo}
            ejercicioId={ejercicioId}
            sociedadId={sociedadId}
          />

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">Estos totales se trasladan automáticamente</strong>{' '}
              al Estado de Resultados (EERR) en las líneas de gasto correspondientes.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
