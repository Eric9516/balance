'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Pencil, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { eliminarRubroBase } from '../actions/rubro-base.actions'
import { eliminarRubroGrupo } from '@/modules/rubros-grupo/actions/rubro-grupo.actions'
import type { RubroGrupoDTO } from '@/modules/rubros-grupo/domain/types'
import { getSeccionLabel, type RubroBaseDTO } from '../domain/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoBadge(destino: string) {
  if (destino === 'SSP') return <Badge variant="proceso">SSP</Badge>
  if (destino === 'EERR') return <Badge variant="revision">EERR</Badge>
  return <Badge variant="borrador">PN</Badge>
}

function naturalezaBadge(n: string) {
  return (
    <span
      className={`text-xs font-medium ${n === 'DEUDORA' ? 'text-blue-600' : 'text-purple-600'}`}
    >
      {n === 'DEUDORA' ? 'Deudora' : 'Acreedora'}
    </span>
  )
}

// ─── Bloque de grupo (sección personalizada) ──────────────────────────────────

function GrupoBloque({
  grupo,
  rubros,
  volver,
  onDeleteGrupo,
  onDeleteRubro,
}: {
  grupo: RubroGrupoDTO
  rubros: RubroBaseDTO[]
  volver?: string
  onDeleteGrupo: (g: RubroGrupoDTO) => void
  onDeleteRubro: (r: RubroBaseDTO) => void
}) {
  const [open, setOpen] = useState(true)
  const nuevoRubroHref = `/configuracion/rubros/nuevo?grupoId=${grupo.id}${volver ? `&volver=${encodeURIComponent(volver)}` : ''}`
  const editGrupoHref = `/configuracion/rubros/secciones/${grupo.id}/editar`

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header del grupo */}
      <div className="flex items-center border-b border-slate-100">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <span className="text-sm font-semibold text-slate-900">{grupo.nombre}</span>
          <span className="text-xs text-slate-400">
            {rubros.length} {rubros.length === 1 ? 'clasificación' : 'clasificaciones'}
          </span>
          {grupo.esGasto && estadoBadge('EERR')}
        </button>
        <div className="flex items-center gap-1 px-3">
          <Link
            href={editGrupoHref}
            className="ml-2 rounded p-1.5 text-slate-400 transition-colors hover:text-blue-600"
            title="Editar sección"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onDeleteGrupo(grupo)}
            className="rounded p-1.5 text-slate-400 transition-colors hover:text-red-500"
            title="Eliminar sección"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <>
          {rubros.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-32 px-4 py-2 text-left text-xs font-semibold text-slate-500">
                    Código
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                    Nombre
                  </th>
                  <th className="w-24 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                    Naturaleza
                  </th>
                  <th className="w-16 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                    Orden
                  </th>
                  <th className="w-16 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rubros.map((r) => (
                  <RubroRow key={r.id} rubro={r} volver={volver} onDelete={onDeleteRubro} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-4 text-sm text-slate-400 italic">
              Sin clasificaciones. Agregá la primera.
            </p>
          )}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href={nuevoRubroHref}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar clasificación
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Bloque legacy (rubros sin grupo, agrupados por seccionSSP/seccionEERR) ───

function LegacyBloque({
  seccion,
  rubros,
  volver,
  onDeleteRubro,
}: {
  seccion: string
  rubros: RubroBaseDTO[]
  volver?: string
  onDeleteRubro: (r: RubroBaseDTO) => void
}) {
  const [open, setOpen] = useState(true)
  const destino = rubros[0]?.estadoDestino ?? 'SSP'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-sm font-semibold text-slate-900">{seccion}</span>
          <span className="text-xs text-slate-400">
            {rubros.length} {rubros.length === 1 ? 'clasificación' : 'clasificaciones'}
          </span>
        </div>
        {estadoBadge(destino)}
      </button>

      {open && (
        <table className="w-full border-t border-slate-100 text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="w-32 px-4 py-2 text-left text-xs font-semibold text-slate-500">
                Código
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Nombre</th>
              <th className="w-24 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                Naturaleza
              </th>
              <th className="w-16 px-4 py-2 text-center text-xs font-semibold text-slate-500">
                Orden
              </th>
              <th className="w-16 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rubros.map((r) => (
              <RubroRow key={r.id} rubro={r} volver={volver} onDelete={onDeleteRubro} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Fila de rubro ─────────────────────────────────────────────────────────────

function RubroRow({
  rubro,
  volver,
  onDelete,
}: {
  rubro: RubroBaseDTO
  volver?: string
  onDelete: (r: RubroBaseDTO) => void
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50">
      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{rubro.codigo}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">{rubro.nombre}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-center">{naturalezaBadge(rubro.naturalezaEsperada)}</td>
      <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-400">{rubro.orden}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/configuracion/rubros/${rubro.id}/editar${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`}
            className="rounded p-1 text-slate-400 transition-colors hover:text-blue-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onDelete(rubro)}
            className="rounded p-1 text-slate-400 transition-colors hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface Props {
  rubros: RubroBaseDTO[]
  grupos: RubroGrupoDTO[]
  volver?: string
}

export function RubroBaseTable({ rubros, grupos, volver }: Props) {
  const [toDeleteRubro, setToDeleteRubro] = useState<RubroBaseDTO | null>(null)
  const [toDeleteGrupo, setToDeleteGrupo] = useState<RubroGrupoDTO | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDeleteRubro() {
    if (!toDeleteRubro) return
    startTransition(async () => {
      const result = await eliminarRubroBase(toDeleteRubro.id)
      if (!result.ok) {
        toastError(result.error)
        return
      }
      toastSuccess('Clasificación eliminada')
      setToDeleteRubro(null)
    })
  }

  function handleDeleteGrupo() {
    if (!toDeleteGrupo) return
    startTransition(async () => {
      const result = await eliminarRubroGrupo(toDeleteGrupo.id)
      if (!result.ok) {
        toastError(result.error)
        return
      }
      toastSuccess('Sección eliminada')
      setToDeleteGrupo(null)
    })
  }

  // Rubros con grupo → agrupar por grupo
  const rubrosPorGrupo = new Map<string, RubroBaseDTO[]>()
  for (const r of rubros) {
    if (r.rubroGrupoId) {
      const arr = rubrosPorGrupo.get(r.rubroGrupoId) ?? []
      arr.push(r)
      rubrosPorGrupo.set(r.rubroGrupoId, arr)
    }
  }

  // Rubros sin grupo → agrupar por seccionSSP/seccionEERR (legacy)
  const rubrosLegacy = rubros.filter((r) => !r.rubroGrupoId)
  const legacyGroups = new Map<string, RubroBaseDTO[]>()
  for (const r of rubrosLegacy) {
    const key = getSeccionLabel(r)
    const arr = legacyGroups.get(key) ?? []
    arr.push(r)
    legacyGroups.set(key, arr)
  }

  const hayContenido = grupos.length > 0 || rubrosLegacy.length > 0

  if (!hayContenido) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <p className="text-sm text-slate-500">No hay secciones ni clasificaciones cargadas.</p>
        <p className="mt-1 text-xs text-slate-400">
          Creá una sección primero y luego agregá clasificaciones dentro.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {/* Secciones personalizadas */}
        {grupos.map((g) => (
          <GrupoBloque
            key={g.id}
            grupo={g}
            rubros={rubrosPorGrupo.get(g.id) ?? []}
            volver={volver}
            onDeleteGrupo={setToDeleteGrupo}
            onDeleteRubro={setToDeleteRubro}
          />
        ))}

        {/* Rubros legacy (sin grupo) */}
        {Array.from(legacyGroups.entries()).map(([seccion, items]) => (
          <LegacyBloque
            key={seccion}
            seccion={seccion}
            rubros={items}
            volver={volver}
            onDeleteRubro={setToDeleteRubro}
          />
        ))}
      </div>

      <ConfirmModal
        open={Boolean(toDeleteRubro)}
        title="Eliminar clasificación"
        description={`¿Eliminar "${toDeleteRubro?.nombre}"? Las cuentas con esta clasificación asignada quedarán sin clasificar.`}
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDeleteRubro}
        onClose={() => setToDeleteRubro(null)}
      />

      <ConfirmModal
        open={Boolean(toDeleteGrupo)}
        title="Eliminar sección"
        description={`¿Eliminar la sección "${toDeleteGrupo?.nombre}"?`}
        warning="Solo se puede eliminar si no tiene clasificaciones asignadas."
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDeleteGrupo}
        onClose={() => setToDeleteGrupo(null)}
      />
    </>
  )
}
