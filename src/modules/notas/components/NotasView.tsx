'use client'

import { useState, useTransition } from 'react'
import { useMontado } from '@/components/shared/useMontado'
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { WizardNotaI, type ConfigNotaILocal } from './WizardNotaI'
import { NotaCuantitativa } from './NotaCuantitativa'
import { NotaTexto } from './NotaTexto'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { generarNotasAutomaticasAction } from '../actions/notas.actions'
import type { NotaDTO } from '../domain/types'

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  notas: NotaDTO[]
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  editarAnterior?: boolean
  tieneCuentasClasificadas: boolean
  configNotaI: ConfigNotaILocal
}

export function NotasView({
  notas: initialNotas,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  editarAnterior = false,
  tieneCuentasClasificadas,
  configNotaI: initialConfig,
}: Props) {
  // La columna "ejercicio anterior" se muestra si hay anterior vinculado o si
  // el contador debe cargarlo a mano (sin balance anterior importado).
  const mostrarAnterior = !!fechaCierreAnterior || editarAnterior
  const [notas, setNotas] = useState<NotaDTO[]>(initialNotas)
  const [isPendingGen, startGen] = useTransition()
  const [showWizard, setShowWizard] = useState(false)
  const [config, setConfig] = useState<ConfigNotaILocal>(initialConfig)
  const mounted = useMontado()
  const [pendienteRegenerar, setPendienteRegenerar] = useState(false)

  function handleChange(updated: NotaDTO) {
    setNotas((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  function handleDelete(id: string) {
    setNotas((prev) => prev.filter((n) => n.id !== id).map((n, i) => ({ ...n, numero: i + 2 })))
  }

  function handleGenerar() {
    startGen(async () => {
      const result = await generarNotasAutomaticasAction(ejercicioId, sociedadId)
      if (!result.ok) {
        toastError(result.error)
        return
      }
      toastSuccess('Notas generadas automáticamente')
      setPendienteRegenerar(false)
      window.location.reload()
    })
  }

  const configCompleta =
    config.adopcionRT54 && config.criteriosBienesCambio && config.hechosPosterioress !== null

  return (
    <div className="space-y-4">
      {/* Wizard portal */}
      {mounted && showWizard && (
        <WizardNotaI
          initialConfig={config}
          ejercicioId={ejercicioId}
          sociedadId={sociedadId}
          onClose={() => setShowWizard(false)}
          onGuardado={(c) => {
            setConfig(c)
            setPendienteRegenerar(true)
          }}
        />
      )}

      {/* Banner configuración Nota I */}
      <div
        className={cn(
          'flex items-center justify-between rounded-lg border px-4 py-2.5',
          configCompleta ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
        )}
      >
        <div className="flex items-center gap-2.5">
          {configCompleta ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          )}
          <p className={cn('text-sm', configCompleta ? 'text-green-800' : 'text-amber-800')}>
            {configCompleta
              ? 'La configuración de la Nota I fue completada.'
              : 'La configuración de la Nota I no fue completada. Algunos datos pueden estar incompletos.'}
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className={cn(
            'ml-4 flex-shrink-0 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium transition-colors',
            configCompleta
              ? 'border-green-300 text-green-800 hover:bg-green-100'
              : 'border-amber-300 text-amber-800 hover:bg-amber-100',
          )}
        >
          {configCompleta ? 'Volver a configurar' : 'Completar configuración'}
        </button>
      </div>

      {/* Overlay "regenerar obligatorio" */}
      {pendienteRegenerar && (
        <div className="relative overflow-hidden rounded-2xl">
          {/* Contenido difuminado debajo */}
          <div className="pointer-events-none space-y-4 p-4 opacity-40 blur-sm select-none">
            {notas.slice(0, 2).map((n) => (
              <div key={n.id} className="h-24 rounded-xl bg-slate-200" />
            ))}
          </div>
          {/* Overlay encima */}
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="mb-1 text-sm font-semibold text-slate-800">
              Hay cambios pendientes de aplicar
            </p>
            <p className="mb-4 max-w-xs text-center text-xs text-slate-500">
              Regenerá las notas para que los nuevos criterios y configuraciones se reflejen
              correctamente.
            </p>
            <Button onClick={handleGenerar} disabled={isPendingGen}>
              <RefreshCw className={cn('mr-2 h-4 w-4', isPendingGen && 'animate-spin')} />
              {isPendingGen ? 'Regenerando...' : 'Regenerar desde rubros'}
            </Button>
          </div>
        </div>
      )}

      {/* Barra de acciones */}
      {!pendienteRegenerar && notas.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {notas.length} {notas.length === 1 ? 'nota' : 'notas'} —{' '}
            <span className="text-xs text-slate-400">
              {editarAnterior
                ? 'Tocá el lápiz de cada nota para cargar la columna "ejercicio anterior" y agregar filas que falten.'
                : 'Los importes del ejercicio anterior se completan manualmente o desde el balance anterior.'}
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={handleGenerar} disabled={isPendingGen}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isPendingGen && 'animate-spin')} />
            Regenerar desde rubros
          </Button>
        </div>
      )}

      {/* Lista de notas o empty state */}
      {!pendienteRegenerar &&
        (notas.length === 0 ? (
          <EmptyState
            onGenerar={handleGenerar}
            isPending={isPendingGen}
            tieneCuentasClasificadas={tieneCuentasClasificadas}
          />
        ) : (
          notas.map((nota) =>
            nota.tipo === 'CUANTITATIVA' ? (
              <NotaCuantitativa
                key={nota.id}
                nota={nota}
                fechaCierre={fechaCierre}
                fechaCierreAnterior={fechaCierreAnterior}
                mostrarAnterior={mostrarAnterior}
                ejercicioId={ejercicioId}
                sociedadId={sociedadId}
                onChange={handleChange}
                onDelete={() => handleDelete(nota.id)}
              />
            ) : (
              <NotaTexto
                key={nota.id}
                nota={nota}
                ejercicioId={ejercicioId}
                sociedadId={sociedadId}
                onChange={handleChange}
                onDelete={() => handleDelete(nota.id)}
              />
            ),
          )
        ))}
    </div>
  )
}
