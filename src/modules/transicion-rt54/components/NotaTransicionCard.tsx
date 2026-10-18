'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileText, PlusCircle, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { AvisosArrastre } from '@/components/shared/AvisosArrastre'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import {
  crearAjusteTransicionAction,
  eliminarAjusteTransicionAction,
  generarNotaTransicionAction,
  guardarLoteAjustesTransicionAction,
} from '../actions/ajustes.actions'
import {
  COMPONENTE_PN_LABELS,
  PLANTILLAS_AJUSTE_TRANSICION,
  TIPO_AJUSTE_LABELS,
  type AjusteTransicionDTO,
  type AjusteTransicionInput,
  type ComponentePN,
  type TipoAjusteTransicion,
} from '../domain/types'
import type { FilaConciliacion, NotaTransicionGenerada } from '../lib/generarNota'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PARTIDA_EN_BLANCO: Omit<AjusteTransicionInput, 'orden'> = {
  tipo: 'AJUSTE_MEDICION',
  concepto: '',
  descripcion: null,
  componentePN: 'RDOS_NO_ASIGNADOS',
  importePN: 0,
  importeResultadoAnterior: 0,
  rubroOrigen: null,
  rubroDestino: null,
  importeReclasificado: 0,
}

const TIPOS = Object.keys(TIPO_AJUSTE_LABELS) as TipoAjusteTransicion[]
const COMPONENTES = Object.keys(COMPONENTE_PN_LABELS) as ComponentePN[]

const inputCls =
  'w-full rounded border border-blue-200 bg-white px-2 py-1 text-sm text-slate-900 transition-colors hover:border-blue-300 focus:border-blue-500 focus:outline-none placeholder:text-slate-300'
const selectCls = cn(inputCls, 'pr-6')
const thCls =
  'px-3 py-2 text-left text-[10px] font-semibold tracking-wide text-slate-500 uppercase whitespace-nowrap'

/** Al cambiar el tipo se limpian los campos del otro tipo para que la partida quede coherente. */
function cambiarTipo(a: AjusteTransicionDTO, tipo: TipoAjusteTransicion): AjusteTransicionDTO {
  if (tipo === a.tipo) return a
  return tipo === 'AJUSTE_MEDICION'
    ? {
        ...a,
        tipo,
        componentePN: a.componentePN ?? 'RDOS_NO_ASIGNADOS',
        rubroOrigen: null,
        rubroDestino: null,
        importeReclasificado: 0,
      }
    : { ...a, tipo, componentePN: null, importePN: 0, importeResultadoAnterior: 0 }
}

// ─── Celda de texto (borrador on-blur) ────────────────────────────────────────

function CeldaTexto({
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
      className={inputCls}
    />
  )
}

// ─── Vista previa: tabla de conciliación ──────────────────────────────────────

function TablaConciliacion({ titulo, filas }: { titulo: string; filas: FilaConciliacion[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
        {titulo}
      </p>
      <table className="w-full">
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={`${f.concepto}-${i}`}
              className={cn(
                'border-b border-slate-50 last:border-b-0',
                f.esBase && 'bg-slate-50 text-slate-500',
                f.esTotal && 'border-t border-t-slate-300 font-bold text-slate-900',
              )}
            >
              <td className={cn('px-3 py-1.5 text-sm', !f.esBase && !f.esTotal && 'pl-6')}>
                {f.concepto}
              </td>
              <td className="w-36 px-3 py-1.5 text-right font-mono text-sm tabular-nums">
                {formatCurrency(f.importe, { decimales: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  ejercicioId: string
  sociedadId: string
  ajustes: AjusteTransicionDTO[]
  nota: NotaTransicionGenerada
}

export function NotaTransicionCard({
  ejercicioId,
  sociedadId,
  ajustes: initialAjustes,
  nota,
}: Props) {
  const router = useRouter()
  const {
    valor: ajustes,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
    sincronizar,
  } = useEdicionLote(
    initialAjustes,
    (borrador) => guardarLoteAjustesTransicionAction(ejercicioId, sociedadId, borrador),
    'Partidas de transición guardadas',
  )
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()
  const isPendingTotal = isPending || isPendingAcciones

  // ── Borrador: cambios por fila — se persisten al Guardar
  function setAjuste(id: string, cambio: (a: AjusteTransicionDTO) => AjusteTransicionDTO) {
    actualizar((prev) => prev.map((a) => (a.id === id ? cambio(a) : a)))
  }

  // ── Alta estructural — se persiste de inmediato y se refleja en el borrador
  function agregar(input: Omit<AjusteTransicionInput, 'orden'>) {
    ejecutar(
      () => crearAjusteTransicionAction(ejercicioId, sociedadId, input),
      (nuevo) => {
        const actualizado = [...ajustes, nuevo]
        sincronizar(actualizado)
        if (editando) actualizar(actualizado)
      },
    )
  }

  // ── Baja estructural — fuera del borrador
  function eliminar(id: string) {
    ejecutar(
      () => eliminarAjusteTransicionAction(id, ejercicioId, sociedadId),
      () => {
        const actualizado = ajustes.filter((a) => a.id !== id)
        sincronizar(actualizado)
        if (editando) actualizar(actualizado)
      },
    )
  }

  function generarNota() {
    ejecutar(
      () => generarNotaTransicionAction(ejercicioId, sociedadId),
      () => {
        toastSuccess('Nota de transición actualizada')
        router.refresh()
      },
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white',
        isPendingTotal && 'opacity-70',
      )}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">Nota de primera aplicación RT 54</p>
            <p className="mt-0.5 text-xs text-slate-500">
              La fila &quot;Modificación de saldos al inicio&quot; del E.E.P.N. se valida contra
              estas partidas; no se deriva.
            </p>
          </div>
        </div>
        <BotonEditar
          editando={editando}
          onEditar={iniciarEdicion}
          onGuardar={confirmar}
          onCancelar={cancelar}
          isPending={isPending}
        />
      </div>

      {/* Tabla de partidas de transición */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={cn(thCls, 'w-44')}>Tipo</th>
              <th className={thCls}>Concepto</th>
              <th className={cn(thCls, 'w-48')}>Componente PN / Rubros</th>
              <th className={cn(thCls, 'w-36 text-right')}>
                Efecto PN al inicio
                <span className="block font-normal text-slate-400 normal-case">
                  o importe reclasificado
                </span>
              </th>
              <th className={cn(thCls, 'w-36 text-right')}>Efecto resultado anterior</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {ajustes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-xs text-slate-400">
                  Sin partidas de transición cargadas. Agregá una plantilla o una partida en blanco.
                </td>
              </tr>
            )}
            {ajustes.map((a) => {
              const esMedicion = a.tipo === 'AJUSTE_MEDICION'
              return (
                <tr
                  key={a.id}
                  className="group border-b border-slate-50 align-top hover:bg-acento-suave"
                >
                  {/* Tipo */}
                  <td className="px-3 py-1.5">
                    {editando ? (
                      <select
                        value={a.tipo}
                        onChange={(e) =>
                          setAjuste(a.id, (prev) =>
                            cambiarTipo(prev, e.target.value as TipoAjusteTransicion),
                          )
                        }
                        className={selectCls}
                      >
                        {TIPOS.map((t) => (
                          <option key={t} value={t}>
                            {TIPO_AJUSTE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={cn(
                          'inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                          esMedicion
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600',
                        )}
                      >
                        {TIPO_AJUSTE_LABELS[a.tipo]}
                      </span>
                    )}
                  </td>

                  {/* Concepto */}
                  <td className="px-3 py-1.5">
                    {editando ? (
                      <CeldaTexto
                        key={`${a.id}-concepto`}
                        value={a.concepto}
                        placeholder="Concepto"
                        onBlur={(v) => setAjuste(a.id, (prev) => ({ ...prev, concepto: v }))}
                      />
                    ) : (
                      <div>
                        <span className="text-sm text-slate-700">
                          {a.concepto || <span className="text-slate-300">Sin concepto</span>}
                        </span>
                        {a.descripcion && (
                          <p className="mt-0.5 text-xs text-slate-400">{a.descripcion}</p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Componente PN (medición) / Rubro origen → destino (reclasificación) */}
                  <td className="px-3 py-1.5">
                    {esMedicion ? (
                      editando ? (
                        <select
                          value={a.componentePN ?? 'RDOS_NO_ASIGNADOS'}
                          onChange={(e) =>
                            setAjuste(a.id, (prev) => ({
                              ...prev,
                              componentePN: e.target.value as ComponentePN,
                            }))
                          }
                          className={selectCls}
                        >
                          {COMPONENTES.map((c) => (
                            <option key={c} value={c}>
                              {COMPONENTE_PN_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-slate-700">
                          {a.componentePN ? COMPONENTE_PN_LABELS[a.componentePN] : '—'}
                        </span>
                      )
                    ) : editando ? (
                      <div className="space-y-1">
                        <CeldaTexto
                          key={`${a.id}-origen`}
                          value={a.rubroOrigen ?? ''}
                          placeholder="Rubro origen"
                          onBlur={(v) =>
                            setAjuste(a.id, (prev) => ({ ...prev, rubroOrigen: v || null }))
                          }
                        />
                        <CeldaTexto
                          key={`${a.id}-destino`}
                          value={a.rubroDestino ?? ''}
                          placeholder="Rubro destino"
                          onBlur={(v) =>
                            setAjuste(a.id, (prev) => ({ ...prev, rubroDestino: v || null }))
                          }
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-slate-700">
                        <span>{a.rubroOrigen || '—'}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span>{a.rubroDestino || '—'}</span>
                      </span>
                    )}
                  </td>

                  {/* Efecto en PN al inicio / Importe reclasificado */}
                  <td className="px-3 py-1.5">
                    {esMedicion ? (
                      <CeldaNumero
                        value={a.importePN}
                        editando={editando}
                        onSave={(v) => setAjuste(a.id, (prev) => ({ ...prev, importePN: v }))}
                      />
                    ) : (
                      <CeldaNumero
                        value={a.importeReclasificado}
                        editando={editando}
                        onSave={(v) =>
                          setAjuste(a.id, (prev) => ({ ...prev, importeReclasificado: v }))
                        }
                      />
                    )}
                  </td>

                  {/* Efecto en resultado anterior (solo medición) */}
                  <td className="px-3 py-1.5">
                    {esMedicion ? (
                      <CeldaNumero
                        value={a.importeResultadoAnterior}
                        editando={editando}
                        onSave={(v) =>
                          setAjuste(a.id, (prev) => ({ ...prev, importeResultadoAnterior: v }))
                        }
                      />
                    ) : (
                      <span className="block text-right text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Eliminar — estructural, fuera del borrador */}
                  <td className="w-8 px-3 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => eliminar(a.id)}
                      disabled={isPendingTotal}
                      title="Eliminar partida"
                      className="text-slate-200 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Alta estructural: plantillas + partida en blanco */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-2.5">
        <span className="text-xs text-slate-400">Agregar:</span>
        {PLANTILLAS_AJUSTE_TRANSICION.map((p) => (
          <button
            key={p.concepto}
            type="button"
            onClick={() => agregar(p)}
            disabled={isPendingTotal}
            title={p.descripcion ?? undefined}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
          >
            {p.concepto}
          </button>
        ))}
        <button
          type="button"
          onClick={() => agregar(PARTIDA_EN_BLANCO)}
          disabled={isPendingTotal}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Partida en blanco
        </button>
      </div>

      {/* Vista previa del borrador de la nota */}
      <div className="space-y-4 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Vista previa del borrador
          </p>
        </div>

        <p className="text-sm font-bold text-slate-900 uppercase">{nota.titulo}</p>

        <div className="space-y-2">
          {nota.parrafos.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TablaConciliacion
            titulo="Conciliación del patrimonio neto al inicio"
            filas={nota.conciliacionPN}
          />
          <TablaConciliacion
            titulo="Conciliación del resultado del ejercicio anterior"
            filas={nota.conciliacionResultado}
          />
        </div>

        {nota.reclasificaciones.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">
              Reclasificaciones de exposición
            </p>
            <ul className="space-y-1">
              {nota.reclasificaciones.map((r, i) => (
                <li
                  key={`${r.concepto}-${i}`}
                  className="flex items-center justify-between gap-3 text-sm text-slate-700"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{r.concepto}</span>
                    {r.origen && r.destino && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        ({r.origen}
                        <ArrowRight className="h-3 w-3" />
                        {r.destino})
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm text-slate-700 tabular-nums">
                    {formatCurrency(r.importe, { decimales: 2 })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AvisosArrastre advertencias={nota.advertencias} />

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={generarNota} disabled={isPendingTotal}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Generar / actualizar nota en el listado
          </Button>
        </div>
      </div>
    </div>
  )
}
