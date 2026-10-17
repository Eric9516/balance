'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { desactivarAuditor, reactivarAuditor } from '../actions/auditor.actions'
import type { AuditorDTO } from '../domain/types'

interface AuditorTableProps {
  auditores: AuditorDTO[]
}

export function AuditorTable({ auditores }: AuditorTableProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [toDeactivate, setToDeactivate] = useState<{ id: string; nombre: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const inactivos = auditores.filter((a) => !a.activo)
  const visibles = showInactive ? auditores : auditores.filter((a) => a.activo)

  function handleDeactivateConfirm() {
    if (!toDeactivate) return
    startTransition(async () => {
      const result = await desactivarAuditor(toDeactivate.id)
      if (!result.ok) toastError(result.error)
      else toastSuccess('Auditor desactivado')
      setToDeactivate(null)
    })
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      const result = await reactivarAuditor(id)
      if (!result.ok) toastError(result.error)
      else toastSuccess('Auditor reactivado')
    })
  }

  return (
    <>
      {/* Toggle inactivos */}
      {inactivos.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            {showInactive
              ? 'Ocultar inactivos'
              : `Mostrar inactivos (${inactivos.length})`}
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">No hay auditores registrados.</p>
          <p className="mt-1 text-xs text-slate-400">
            Creá el primero usando el botón &quot;Nuevo auditor&quot;.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Título / Consejo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Matrícula
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b border-slate-100 last:border-0 transition-colors ${
                    a.activo ? 'hover:bg-slate-50' : 'bg-slate-50/60 opacity-60'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{a.nombreCompleto}</span>
                      {a.esDefault && <Badge variant="defecto">Por defecto</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="text-sm">
                      {a.tituloProfesional ?? <span className="text-slate-400">—</span>}
                    </div>
                    {a.consejoProfesional && (
                      <p className="text-xs text-slate-400 mt-0.5">{a.consejoProfesional}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.matricula ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.activo ? 'activo' : 'inactivo'}>
                      {a.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/auditores/${a.id}/editar`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Link>
                      </Button>
                      {a.activo ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setToDeactivate({ id: a.id, nombre: a.nombreCompleto })}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleReactivate(a.id)}
                        >
                          Reactivar
                        </Button>
                      )}
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
        title="Desactivar auditor"
        description={`¿Confirmás que querés desactivar a ${toDeactivate?.nombre ?? ''}? No podrá seleccionarse para nuevos ejercicios, pero los existentes no se ven afectados.`}
        warning="Si este auditor es el predeterminado, vas a tener que asignar uno nuevo."
        confirmLabel="Desactivar"
        isPending={isPending}
        variant="destructive"
      />
    </>
  )
}
