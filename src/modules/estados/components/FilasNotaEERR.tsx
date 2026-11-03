'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { TdCargado } from '@/modules/comparativo-manual/components/ColumnaCargado'
import { formatCurrency } from '@/lib/utils/currency'
import type { ActionResult } from '@/modules/errores/types'
import { ubicarNotaEnEERRAction } from '@/modules/notas/actions/notas.actions'
import { conSigno, type LineaNotaEERR, type NotaParaUbicar } from '../domain/lineasDeNotas'

/** Las notas ubicadas debajo de una línea del Estado de Resultados y, en carga manual, el +. */
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
  notas?: NotaParaUbicar[]
  /** Anterior ya ajustado, con la columna visible: las mismas filas con lo cargado. */
  cargado?: LineaNotaEERR[]
  columnas: number
  ejercicioId: string
  sociedadId: string
}) {
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()
  const sacar = (notaId: string) =>
    ejecutar(
      () => ubicarNotaEnEERRAction(notaId, ejercicioId, sociedadId, null, false),
      () => router.refresh(),
    )

  return (
    <>
      {lineas
        .filter((l) => l.debajoDe === clave)
        .map((l) => (
          <FilaNota
            key={l.notaId}
            titulo={l.titulo}
            notaNumero={l.notaNumero}
            totalAnt={l.totalAnt}
            cargado={
              cargado ? (cargado.find((c) => c.notaId === l.notaId)?.totalAnt ?? 0) : undefined
            }
            onSacar={notas ? () => sacar(l.notaId) : undefined}
            sacando={isPending}
          />
        ))}
      {notas && (
        <MasNota
          notas={notas}
          columnas={columnas}
          estado="EERR"
          accion={(notaId, resta) =>
            ubicarNotaEnEERRAction(notaId, ejercicioId, sociedadId, clave, resta)
          }
        />
      )}
    </>
  )
}

/** Una nota como fila de un estado: solo tiene importe en la columna anterior. */
export function FilaNota({
  titulo,
  notaNumero,
  totalAnt,
  cargado,
  onSacar,
  sacando = false,
}: {
  titulo: string
  notaNumero: number | null
  totalAnt: number
  /** Anterior ya ajustado, con la columna visible: lo cargado. */
  cargado?: number
  /** Sin esto la fila no se saca (la columna anterior no se edita). */
  onSacar?: () => void
  sacando?: boolean
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-acento-suave">
      <td className="px-4 py-2.5 text-sm text-slate-700">
        {titulo}
        {notaNumero != null && (
          <span className="ml-1 text-xs text-slate-400">(Nota {notaNumero})</span>
        )}
        {onSacar && (
          <button
            type="button"
            onClick={onSacar}
            disabled={sacando}
            title="Sacar del estado (la nota sigue existiendo)"
            aria-label={`Sacar ${titulo} del estado`}
            className="ml-2 rounded p-0.5 align-middle text-slate-300 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="inline h-3.5 w-3.5" />
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums">—</td>
      <td className="px-2 py-2 text-right font-mono text-sm text-slate-500 tabular-nums">
        {formatCurrency(totalAnt)}
      </td>
      {cargado !== undefined && <TdCargado valor={cargado} />}
    </tr>
  )
}

const TEXTOS = {
  EERR: {
    titulo: 'Agregar una nota al Estado de Resultados',
    explica: 'La fila toma el total de la nota y entra en los subtotales de abajo.',
    pregunta: '¿Suma o resta del resultado?',
  },
  SSP: {
    titulo: 'Agregar una nota al Estado de Situación Patrimonial',
    explica: 'La fila toma el total de la nota y entra en el subtotal de su sección y en el total.',
    pregunta: '¿Suma o resta en la sección?',
  },
} as const

/**
 * El + entre dos filas (aparece al pasar por la de arriba) y el cartel para elegir la nota y si suma o
 * resta. Solo ofrece notas que no están en ningún estado: una nota se usa una sola vez.
 */
export function MasNota({
  notas,
  columnas,
  estado,
  accion,
}: {
  notas: NotaParaUbicar[]
  columnas: number
  estado: keyof typeof TEXTOS
  accion: (notaId: string, resta: boolean) => Promise<ActionResult<void>>
}) {
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] = useState<NotaParaUbicar | null>(null)
  const [resta, setResta] = useState(false)
  const textos = TEXTOS[estado]
  const conImporte = notas.filter((n) => n.totalAnt !== 0)

  const elegir = (n: NotaParaUbicar) => {
    setElegida(n)
    // Arranca con el signo de la nota: un importe cargado en negativo es una resta
    setResta(n.totalAnt < 0)
  }
  const agregar = (n: NotaParaUbicar) =>
    ejecutar(
      () => accion(n.id, resta),
      () => {
        setAbierto(false)
        setElegida(null)
        router.refresh()
      },
    )

  return (
    <>
      {/* Fila sin alto: el + queda sobre el borde entre dos filas y aparece al pasar por la de arriba. */}
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
      <Dialogo
        open={abierto}
        onClose={() => setAbierto(false)}
        title={textos.titulo}
        bloqueado={isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAbierto(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={() => elegida && agregar(elegida)} disabled={isPending || !elegida}>
              {isPending ? 'Agregando…' : 'Agregar acá'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Para importes del ejercicio anterior cuyas cuentas no están en el balance de este año.{' '}
          {textos.explica} Cada nota se usa una sola vez.
        </p>
        {conImporte.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            No hay notas para agregar. Creá la nota en Anexos → Configuración y, en el paso Notas,
            cargale el importe del ejercicio anterior. Las que ya están en un estado no aparecen
            acá.
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
                  name="nota"
                  checked={elegida?.id === n.id}
                  onChange={() => elegir(n)}
                  className="accent-blue-600"
                />
                <span className="min-w-0 flex-1 text-sm text-slate-800">
                  {n.titulo}
                  {n.numero != null && (
                    <span className="ml-1 text-xs text-slate-400">(Nota {n.numero})</span>
                  )}
                </span>
                <span className="font-mono text-sm text-slate-800 tabular-nums">
                  {formatCurrency(n.totalAnt)}
                </span>
              </label>
            ))}
            {elegida && (
              <fieldset className="pt-2">
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  {textos.pregunta}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { valor: false, texto: 'Suma' },
                    { valor: true, texto: 'Resta' },
                  ].map((o) => (
                    <label
                      key={o.texto}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 has-checked:border-blue-500 has-checked:bg-blue-50"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="signo"
                          checked={resta === o.valor}
                          onChange={() => setResta(o.valor)}
                          className="accent-blue-600"
                        />
                        {o.texto}
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatCurrency(conSigno(elegida.totalAnt, o.valor))}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}
      </Dialogo>
    </>
  )
}
