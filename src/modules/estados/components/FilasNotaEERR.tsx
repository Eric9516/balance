'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { TdCargado } from '@/modules/comparativo-manual/components/ColumnaCargado'
import { formatCurrency } from '@/lib/utils/currency'
import { ubicarNotaEnEERRAction } from '@/modules/notas/actions/notas.actions'
import type { LineaNotaEERR, NotaParaEERR } from '../domain/lineasDeNotas'

/** Las notas ubicadas debajo de una línea del estado y, en carga manual, el + para agregar otra. */
export function FilasNotaEERR({
  clave,
  lineas,
  notas,
  cargado,
  columnas,
  ejercicioId,
  sociedadId,
}: {
  /** La línea del estado que queda arriba. */
  clave: string
  lineas: LineaNotaEERR[]
  /** Notas que se pueden agregar. Undefined: la columna anterior no se edita (sin + ni quitar). */
  notas?: NotaParaEERR[]
  /** Anterior ya ajustado, con la columna visible: las mismas filas con lo cargado. */
  cargado?: LineaNotaEERR[]
  columnas: number
  ejercicioId: string
  sociedadId: string
}) {
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] = useState<string | null>(null)

  const ubicar = (notaId: string, debajoDe: string | null) =>
    ejecutar(
      () => ubicarNotaEnEERRAction(notaId, ejercicioId, sociedadId, debajoDe),
      () => {
        setAbierto(false)
        setElegida(null)
        router.refresh()
      },
    )

  const propias = lineas.filter((l) => l.debajoDe === clave)
  const conImporte = notas?.filter((n) => n.totalAnt !== 0) ?? []

  return (
    <>
      {propias.map((l) => (
        <tr key={l.notaId} className="border-b border-slate-100 hover:bg-acento-suave">
          <td className="px-4 py-2.5 text-sm text-slate-700">
            {l.titulo}
            {l.notaNumero != null && (
              <span className="ml-1 text-xs text-slate-400">(Nota {l.notaNumero})</span>
            )}
            {notas && (
              <button
                type="button"
                onClick={() => ubicar(l.notaId, null)}
                disabled={isPending}
                title="Sacar del estado (la nota sigue existiendo)"
                aria-label={`Sacar ${l.titulo} del estado`}
                className="ml-2 rounded p-0.5 align-middle text-slate-300 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="inline h-3.5 w-3.5" />
              </button>
            )}
          </td>
          <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums">
            —
          </td>
          <td className="px-2 py-2 text-right font-mono text-sm text-slate-500 tabular-nums">
            {formatCurrency(l.totalAnt)}
          </td>
          {cargado && (
            <TdCargado valor={cargado.find((c) => c.notaId === l.notaId)?.totalAnt ?? 0} />
          )}
        </tr>
      ))}
      {notas && (
        // Fila sin alto: el + queda sobre el borde entre dos filas y aparece al pasar por la de arriba.
        <tr className="h-0">
          <td colSpan={columnas} className="relative h-0 p-0">
            <button
              type="button"
              onClick={() => setAbierto(true)}
              aria-label="Agregar una nota como fila acá"
              title="Agregar una nota como fila acá"
              className="absolute -top-2.5 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:border-blue-500 hover:bg-blue-600 hover:text-white hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [tr:hover+tr_&]:opacity-100"
            >
              <Plus className="h-3 w-3" />
            </button>
          </td>
        </tr>
      )}
      {notas && (
        <Dialogo
          open={abierto}
          onClose={() => setAbierto(false)}
          title="Agregar una nota al Estado de Resultados"
          bloqueado={isPending}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAbierto(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => elegida && ubicar(elegida, clave)}
                disabled={isPending || !elegida}
              >
                {isPending ? 'Agregando…' : 'Agregar acá'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Para importes del ejercicio anterior cuyas cuentas no están en el balance de este año.
            La fila toma el total de la nota y entra en los subtotales de abajo.
          </p>
          {conImporte.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              No hay notas para agregar. Creá la nota en Anexos → Configuración y, en el paso Notas,
              cargale el importe del ejercicio anterior.
            </p>
          ) : (
            <div className="space-y-2">
              {conImporte.map((n) => (
                <label
                  key={n.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name={`nota-${clave}`}
                    checked={elegida === n.id}
                    onChange={() => setElegida(n.id)}
                    className="accent-blue-600"
                  />
                  <span className="min-w-0 flex-1 text-sm text-slate-800">
                    {n.titulo}
                    {n.numero != null && (
                      <span className="ml-1 text-xs text-slate-400">(Nota {n.numero})</span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm text-slate-800 tabular-nums">
                      {formatCurrency(n.totalAnt)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {n.totalAnt > 0 ? 'suma al resultado' : 'resta del resultado'}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-xs leading-relaxed text-slate-500">
                Si una pérdida figura como &quot;suma&quot;, cargala en negativo en la nota, por
                ejemplo (1.000,00).
              </p>
            </div>
          )}
        </Dialogo>
      )}
    </>
  )
}
