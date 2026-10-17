'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { MoreHorizontal, FolderOpen, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { formatCuit } from '@/lib/utils/cuit'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { desactivarSociedad, reactivarSociedad } from '../actions/sociedad.actions'
import { TIPO_PERSONA_LABELS, type SociedadDTO } from '../domain/types'

// ─── Row menu ─────────────────────────────────────────────────────────────────

interface RowMenuProps {
  sociedadId: string
  activo: boolean
  isPending: boolean
  onDeactivate: () => void
  onReactivate: () => void
}

function RowMenu({ sociedadId, activo, isPending, onDeactivate, onReactivate }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label="Opciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop: cierra el menú al hacer click afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown: fixed para escapar del overflow-hidden de la tabla */}
          <div
            className="fixed z-50 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-md"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <Link
              href={`/sociedades/${sociedadId}/ejercicios`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
              Ejercicios
            </Link>
            <Link
              href={`/sociedades/${sociedadId}/editar`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
              Editar
            </Link>
            <div className="my-1 h-px bg-slate-100" />
            {activo ? (
              <button
                onClick={() => {
                  setOpen(false)
                  onDeactivate()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                Desactivar
              </button>
            ) : (
              <button
                onClick={() => {
                  setOpen(false)
                  onReactivate()
                }}
                disabled={isPending}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Reactivar
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─── Tabla principal ──────────────────────────────────────────────────────────

interface SociedadTableProps {
  sociedades: SociedadDTO[]
}

export function SociedadTable({ sociedades }: SociedadTableProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<{ id: string; nombre: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const inactivas = sociedades.filter((s) => !s.activo)
  const visibles = showInactive ? sociedades : sociedades.filter((s) => s.activo)

  function handleDeactivateConfirm() {
    if (!toDeactivate) return
    startTransition(async () => {
      const result = await desactivarSociedad(toDeactivate.id)
      if (!result.ok) toastError(result.error)
      else toastSuccess('Sociedad desactivada')
      setToDeactivate(null)
    })
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      const result = await reactivarSociedad(id)
      if (!result.ok) toastError(result.error)
      else toastSuccess('Sociedad reactivada')
    })
  }

  return (
    <>
      {/* Toggle inactivos */}
      {inactivas.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
          >
            {showInactive ? 'Ocultar inactivos' : `Mostrar inactivos (${inactivas.length})`}
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">No hay sociedades registradas.</p>
          <p className="mt-1 text-xs text-slate-400">
            Creá la primera usando el botón &quot;Nueva sociedad&quot;.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Sociedad
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  CUIT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Estado
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-slate-100 transition-colors last:border-0 ${
                    s.activo ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-60'
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sociedades/${s.id}/ejercicios`}
                      className="font-medium text-slate-900 transition-colors hover:text-blue-600"
                    >
                      {s.razonSocial}
                    </Link>
                    {s.localidad && <p className="mt-0.5 text-xs text-slate-400">{s.localidad}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {formatCuit(s.cuit)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {TIPO_PERSONA_LABELS[s.tipoPersona]}
                    {s.tipoPersona === 'JURIDICA' && s.tipoSocietario && (
                      <span className="text-slate-400"> · {s.tipoSocietario}</span>
                    )}
                    {s.tipoPersona === 'FISICA' && s.condicionFiscal && (
                      <span className="text-slate-400"> · {s.condicionFiscal}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.activo ? 'activo' : 'inactivo'}>
                      {s.activo ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowMenu
                        sociedadId={s.id}
                        activo={s.activo}
                        isPending={isPending}
                        onDeactivate={() => setToDeactivate({ id: s.id, nombre: s.razonSocial })}
                        onReactivate={() => handleReactivate(s.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmModal
        open={Boolean(toDeactivate)}
        onClose={() => !isPending && setToDeactivate(null)}
        onConfirm={handleDeactivateConfirm}
        title="Desactivar sociedad"
        description={`¿Confirmás que querés desactivar a ${toDeactivate?.nombre ?? ''}? Sus ejercicios y datos quedan guardados.`}
        warning="Si tiene ejercicios en proceso o revisión, van a seguir existiendo pero la sociedad no aparecerá en las listas activas."
        confirmLabel="Desactivar"
        isPending={isPending}
        variant="destructive"
      />
    </>
  )
}
