'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  FileText,
  FileSpreadsheet,
  Check,
  X,
  Ban,
  RotateCcw,
  Plus,
  AlertTriangle,
  Trash2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import type { ActionResult } from '@/modules/errores/types'
import type { DocumentoEvaluado } from '../domain/types'
import type { TipoDoc } from '../domain/reglas'
import {
  aceptarDocumentoAction,
  descartarDocumentoAction,
  marcarNoAplicaAction,
  reactivarDocumentoAction,
  agregarDocumentoManualAction,
  eliminarDocumentoManualAction,
} from '../actions/documento.actions'

function TipoBadge({ tipo }: { tipo: TipoDoc }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        tipo === 'ANEXO'
          ? 'border border-violet-200 bg-violet-50 text-violet-700'
          : 'border border-sky-200 bg-sky-50 text-sky-700',
      )}
    >
      {tipo === 'ANEXO' ? (
        <FileSpreadsheet className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      {tipo}
    </span>
  )
}

function Motivo({ doc }: { doc: DocumentoEvaluado }) {
  if (doc.origen === 'MANUAL') {
    return <p className="text-xs text-slate-400">Agregado manualmente</p>
  }
  if (doc.motivo.length === 0) {
    return <p className="text-xs text-slate-400">Sin saldo relacionado</p>
  }
  return (
    <p className="text-xs text-slate-500">
      Disparado por:{' '}
      {doc.motivo.map((m, i) => (
        <span key={m.codigo}>
          {i > 0 && ', '}
          <span className="text-slate-600">{m.nombre}</span>{' '}
          <span className="font-mono text-slate-400">
            ({formatCurrency(m.saldo, { decimales: 2 })})
          </span>
        </span>
      ))}
    </p>
  )
}

export function DocumentosView({
  documentos,
  ejercicioId,
  sociedadId,
}: {
  documentos: DocumentoEvaluado[]
  ejercicioId: string
  sociedadId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [nuevoTipo, setNuevoTipo] = useState<TipoDoc>('NOTA')
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [agregando, setAgregando] = useState(false)

  const sugeridos = documentos.filter((d) => d.estado === 'SUGERIDO' && !d.referenciaAnioAnterior)
  const referencias = documentos.filter((d) => d.referenciaAnioAnterior)
  const aceptados = documentos.filter((d) => d.estado === 'ACEPTADO')
  const archivados = documentos.filter((d) => d.estado === 'DESCARTADO' || d.estado === 'NO_APLICA')

  function run(fn: () => Promise<ActionResult<unknown>>, okMsg?: string) {
    startTransition(async () => {
      const r = await fn()
      if (r.ok) {
        if (okMsg) toastSuccess(okMsg)
      } else toastError(r.error)
    })
  }

  function handleAgregar() {
    if (!nuevoTitulo.trim()) return
    startTransition(async () => {
      const r = await agregarDocumentoManualAction(ejercicioId, sociedadId, nuevoTipo, nuevoTitulo)
      if (r.ok) {
        setNuevoTitulo('')
        setAgregando(false)
        toastSuccess('Documento agregado')
      } else toastError(r.error)
    })
  }

  return (
    <div className={cn('max-w-3xl space-y-6', isPending && 'opacity-70')}>
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Estas son <strong>sugerencias</strong> según los saldos del balance. La decisión final es
        tuya: aceptá, descartá o marcá “no aplica”. También podés agregar uno manual.
      </div>

      {/* ── Sugeridos ─────────────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          Sugeridos{' '}
          {sugeridos.length > 0 && <span className="text-slate-400">({sugeridos.length})</span>}
        </h3>
        {sugeridos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
            No hay sugerencias nuevas según los saldos cargados.
          </p>
        ) : (
          <div className="space-y-2">
            {sugeridos.map((doc) => (
              <div
                key={doc.clave}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TipoBadge tipo={doc.tipo} />
                    <span className="text-sm font-medium text-slate-800">{doc.titulo}</span>
                  </div>
                  <div className="mt-1">
                    <Motivo doc={doc} />
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() =>
                      run(
                        () => aceptarDocumentoAction(ejercicioId, sociedadId, doc.clave),
                        'Aceptado',
                      )
                    }
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5" /> Aceptar
                  </button>
                  <button
                    onClick={() =>
                      run(() => descartarDocumentoAction(ejercicioId, sociedadId, doc.clave))
                    }
                    disabled={isPending}
                    title="Descartar"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      run(() => marcarNoAplicaAction(ejercicioId, sociedadId, doc.clave))
                    }
                    disabled={isPending}
                    title="No aplica"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Referencia del año anterior (sin saldo este año) ──────────────────── */}
      {referencias.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Referencia del año anterior ({referencias.length})
          </h3>
          <p className="mb-2 text-xs text-slate-400">
            El año pasado se incluían estos documentos, pero este ejercicio no tiene saldo en el
            rubro. No se sugieren ni se obligan — incluilos solo si corresponde.
          </p>
          <div className="space-y-2">
            {referencias.map((doc) => (
              <div
                key={doc.clave}
                className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TipoBadge tipo={doc.tipo} />
                    <span className="text-sm font-medium text-slate-700">{doc.titulo}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase">
                      año anterior
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Sin saldo relacionado este ejercicio
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() =>
                      run(
                        () => aceptarDocumentoAction(ejercicioId, sociedadId, doc.clave),
                        'Incluido',
                      )
                    }
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Incluir igual
                  </button>
                  <button
                    onClick={() =>
                      run(() => marcarNoAplicaAction(ejercicioId, sociedadId, doc.clave))
                    }
                    disabled={isPending}
                    title="No aplica este año"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Aceptados ─────────────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Incluidos en los estados{' '}
          {aceptados.length > 0 && <span className="text-slate-400">({aceptados.length})</span>}
        </h3>
        {aceptados.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
            Todavía no aceptaste ningún anexo o nota.
          </p>
        ) : (
          <div className="space-y-2">
            {aceptados.map((doc) => (
              <div
                key={doc.clave}
                className={cn(
                  'rounded-xl border bg-white px-4 py-3',
                  doc.advertenciaSaldoCero ? 'border-amber-200' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TipoBadge tipo={doc.tipo} />
                      <span className="text-sm font-medium text-slate-800">{doc.titulo}</span>
                      {doc.origen === 'MANUAL' && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                          manual
                        </span>
                      )}
                      {doc.autoGenerada && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
                          generada automáticamente
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <Motivo doc={doc} />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {doc.autoGenerada ? (
                      <Link
                        href={`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas?paso=notas`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        Ver en Notas <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : doc.origen === 'MANUAL' ? (
                      <button
                        onClick={() =>
                          run(
                            () =>
                              eliminarDocumentoManualAction(
                                ejercicioId,
                                sociedadId,
                                doc.documentoId!,
                              ),
                            'Eliminado',
                          )
                        }
                        disabled={isPending}
                        title="Eliminar"
                        className="rounded-md p-1.5 text-slate-300 transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          run(() => reactivarDocumentoAction(ejercicioId, sociedadId, doc.clave))
                        }
                        disabled={isPending}
                        title="Quitar de los estados"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {doc.advertenciaSaldoCero && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    El saldo relacionado quedó en cero. No se eliminó automáticamente — revisá si
                    todavía corresponde.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Descartados / No aplica ───────────────────────────────────────────── */}
      {archivados.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Descartados / No aplica ({archivados.length})
          </h3>
          <div className="space-y-1.5">
            {archivados.map((doc) => (
              <div
                key={doc.clave}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-2"
              >
                <div className="flex items-center gap-2 text-slate-400">
                  <TipoBadge tipo={doc.tipo} />
                  <span className="text-sm line-through">{doc.titulo}</span>
                  <span className="text-[10px] tracking-wide uppercase">
                    {doc.estado === 'NO_APLICA' ? 'no aplica' : 'descartado'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    run(() => reactivarDocumentoAction(ejercicioId, sociedadId, doc.clave))
                  }
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Agregar manual ────────────────────────────────────────────────────── */}
      <section>
        {agregando ? (
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3">
            <select
              value={nuevoTipo}
              onChange={(e) => setNuevoTipo(e.target.value as TipoDoc)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            >
              <option value="NOTA">Nota</option>
              <option value="ANEXO">Anexo</option>
            </select>
            <input
              type="text"
              autoFocus
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAgregar()
              }}
              placeholder="Título del anexo o nota"
              className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
            />
            <button
              onClick={handleAgregar}
              disabled={isPending || !nuevoTitulo.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> Agregar
            </button>
            <button
              onClick={() => {
                setAgregando(false)
                setNuevoTitulo('')
              }}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAgregando(true)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-700"
          >
            <Plus className="h-4 w-4" /> Agregar documento manual
          </button>
        )}
      </section>
    </div>
  )
}
