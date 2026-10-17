'use client'

import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { toastError } from '@/modules/errores/components/Toast'
import { toggleGastoSeccionAction, reordenarGastoSeccionAction, toggleAparecEnEERRAction } from '../actions/gastos-config.actions'
import type { GastosSecciones } from '../repository/gastos-dinamico.repository'
import { esSeccionHuerfana } from '../lib/seccionHuerfana'
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

export function GastosView({ data, ejercicioId, sociedadId, editarAnterior = false }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Secciones "huérfanas": existieron solo en el período anterior (carga manual).
  const seccionesHuerfanas = data.secciones.filter(s => esSeccionHuerfana(s.key))
  const seccionesRegulares = data.secciones.filter(s => !esSeccionHuerfana(s.key))

  // Selección: inicialmente las que tienen esGastoDefault=true
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(
    () => new Set(data.todasSecciones.filter(s => s.esGastoDefault).map(s => s.key))
  )

  useEffect(() => { setMounted(true) }, [])

  // Secciones filtradas según selección (sin las huérfanas, que van como columnas extra)
  const seccionesVisibles = seccionesRegulares.filter(s => seleccionadas.has(s.key))
  // Las huérfanas (solo del anterior) se muestran como columnas extra cuando falta
  // el balance anterior, para que el dato cargado quede siempre reflejado.
  const huerfanasVisibles = editarAnterior ? seccionesHuerfanas : []

  // Columna "Ejercicio Anterior" — borrador independiente, propio Guardar/Cancelar.
  const entradasAnterior: ComparativoEntry[] = [...seccionesVisibles, ...huerfanasVisibles].map((s) => ({
    modulo: 'GASTOS' as const,
    clave: s.key,
    label: s.grupoNombre,
    valor: s.totalAnterior,
    esHuerfano: esSeccionHuerfana(s.key),
  }))
  const comparativo = useComparativoLote(entradasAnterior, ejercicioId, sociedadId)

  function handleToggle(key: string, value: boolean) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })

    // Persistir esGasto en DB para grupos personalizados
    if (key.startsWith('grupo:')) {
      const grupoId = key.replace('grupo:', '')
      toggleGastoSeccionAction(grupoId, value, sociedadId, ejercicioId).then(result => {
        if (!result.ok) toastError(result.error)
      })
    }
  }

  const haySecciones = seccionesVisibles.length > 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          Columnas y filas se calculan automáticamente desde las cuentas clasificadas.
        </p>
        <div className="flex items-center gap-2">
          {editarAnterior && (
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
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configurar secciones
            {seleccionadas.size > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
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
            toggleAparecEnEERRAction(key, value, sociedadId, ejercicioId).then(result => {
              if (!result.ok) toastError(result.error)
            })
          }}
          onMover={(keyA, keyB) => {
            reordenarGastoSeccionAction(keyA, keyB, sociedadId, ejercicioId).then(result => {
              if (!result.ok) toastError(result.error)
            })
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Tabla o empty state */}
      {!haySecciones ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200 bg-white">
          <p className="text-sm text-slate-500">No hay secciones seleccionadas con datos.</p>
          <p className="mt-1 text-xs text-slate-400">
            Usá "Configurar secciones" para elegir qué aparece en el Anexo III.
          </p>
        </div>
      ) : (
        <>
          <TablaGastos
            secciones={seccionesVisibles}
            huerfanas={huerfanasVisibles}
            editarAnterior={editarAnterior}
            comparativo={comparativo}
            ejercicioId={ejercicioId}
            sociedadId={sociedadId}
          />

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">Estos totales se trasladan automáticamente</strong> al
              Estado de Resultados (EERR) en las líneas de gasto correspondientes.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
