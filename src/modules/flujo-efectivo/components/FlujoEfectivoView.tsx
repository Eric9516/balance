'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, History, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'
import { AvisosArrastre } from '@/components/shared/AvisosArrastre'
import { ToggleDensidad } from '@/components/shared/ControlesTabla'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import {
  normalizarConcepto,
  totalesFlujo,
  type FlujoData,
  type TotalesColumna,
} from '../domain/calculo'
import {
  CONCEPTOS_SUGERIDOS,
  SECCION_FLUJO_LABELS,
  SECCION_FLUJO_SUBTOTAL,
  SECCIONES_FLUJO,
  TEXTOS_FLUJO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type SeccionFlujo,
} from '../domain/types'
import {
  crearItemFlujoAction,
  eliminarItemFlujoAction,
  guardarFlujoAction,
  traerConceptosAnteriorAction,
} from '../actions/flujo.actions'

const ORIGEN_BALANCE =
  'Sale de los rubros de efectivo del Estado de Situación Patrimonial. No se edita acá.'

interface Props {
  data: FlujoData
  ejercicioId: string
  sociedadId: string
  fechaInicio: Date
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  anteriorDenominacion: string | null
}

export function FlujoEfectivoView({
  data,
  ejercicioId,
  sociedadId,
  fechaInicio,
  fechaCierre,
  fechaCierreAnterior,
  anteriorDenominacion,
}: Props) {
  const { mostrarAnterior, editarAnterior, bloqueo } = data
  const edicion = useEdicionLote<FlujoGuardadoDTO>(
    data.guardado,
    (borrador) => guardarFlujoAction(ejercicioId, sociedadId, borrador),
    'Flujo de efectivo guardado',
  )
  const { valor: flujo, editando, actualizar, sincronizar } = edicion
  const { isPending: isPendingAcciones, ejecutar } = useGuardarAccion()
  const isPending = edicion.isPending || isPendingAcciones
  const { actual, anterior } = totalesFlujo(flujo, mostrarAnterior)
  const vinculado = mostrarAnterior && !editarAnterior

  function setCampo(campo: keyof Omit<FlujoGuardadoDTO, 'id' | 'items'>, v: number) {
    actualizar((prev) => ({ ...prev, [campo]: v }))
  }

  function setItem(id: string, cambios: Partial<FlujoItemDTO>) {
    actualizar((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, ...cambios } : i)),
    }))
  }

  function agregar(seccion: SeccionFlujo, concepto: string) {
    ejecutar(
      () => crearItemFlujoAction(ejercicioId, sociedadId, seccion, concepto),
      (nuevo) => sincronizar((prev) => ({ ...prev, items: [...prev.items, nuevo] })),
    )
  }

  function eliminar(id: string) {
    ejecutar(
      () => eliminarItemFlujoAction(ejercicioId, sociedadId, id),
      () => sincronizar((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) })),
    )
  }

  function traerAnteriores() {
    ejecutar(
      () => traerConceptosAnteriorAction(ejercicioId, sociedadId),
      (nuevos) => {
        sincronizar((prev) => ({ ...prev, items: [...prev.items, ...nuevos] }))
        toastSuccess(
          `${nuevos.length} ${nuevos.length === 1 ? 'concepto traído' : 'conceptos traídos'} del ejercicio anterior`,
        )
      },
    )
  }

  const columnas = 2 + (mostrarAnterior ? 1 : 0) + (editando ? 1 : 0)
  const th = 'celda border-b border-linea text-right align-bottom text-tabla-sm font-medium'

  /** Celda de la columna anterior: a mano (MANUAL), con candado (VINCULADO con fuente) o en 0. */
  function celdaAnterior(value: number, conFuente: boolean, onSave: (v: number) => void) {
    if (editarAnterior)
      return <CeldaNumero value={value} editando={editando} onSave={onSave} dense />
    if (conFuente) return <CeldaBloqueada value={value} origen={anteriorDenominacion} dense />
    return <CeldaNumero value={value} editando={false} soloLectura onSave={() => {}} dense />
  }

  const calculado = (value: number, titulo?: string, fuerte = false) => (
    <span title={titulo} className="block">
      <CeldaNumero
        value={value}
        editando={false}
        soloLectura
        onSave={() => {}}
        dense
        className={cn(fuerte && 'font-semibold text-tinta')}
      />
    </span>
  )

  return (
    <div className="space-y-3">
      {/* Avisos + controles */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <ControlCuadre actual={actual} anterior={data.controlarAnterior ? anterior : null} />
          <AvisosArrastre
            bloqueado={vinculado}
            origen={anteriorDenominacion}
            advertencias={data.advertencias}
          />
          {vinculado && data.conceptosSoloAnterior.length > 0 && (
            <button
              type="button"
              onClick={traerAnteriores}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <History className="h-3.5 w-3.5" />
              Traer {data.conceptosSoloAnterior.length}{' '}
              {data.conceptosSoloAnterior.length === 1 ? 'concepto' : 'conceptos'} del ejercicio
              anterior
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToggleDensidad />
          <BotonEditar
            editando={editando}
            onEditar={edicion.iniciarEdicion}
            onGuardar={edicion.confirmar}
            onCancelar={edicion.cancelar}
            isPending={edicion.isPending}
          />
        </div>
      </div>

      <section
        className={cn(
          'mx-auto max-w-5xl overflow-hidden rounded-xl border border-linea bg-superficie',
          isPending && 'opacity-70',
        )}
      >
        <header className="border-b border-linea px-5 py-4 text-center">
          <h2 className="font-serif text-lg font-semibold text-tinta">
            Estado de Flujo de Efectivo
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Por el ejercicio iniciado el {formatFecha(fechaInicio)} y finalizado el{' '}
            {formatFecha(fechaCierre)} — método directo
            {mostrarAnterior &&
              `, comparativo con ${formatFecha(fechaCierreAnterior, 'el ejercicio anterior')}`}
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 tabla-trabajo text-tabla">
            <thead>
              <tr>
                <th className="border-b border-linea celda text-left text-tabla-sm font-semibold text-slate-600 uppercase">
                  Concepto
                </th>
                <th className={cn(th, 'w-44')}>
                  <div className="font-semibold text-slate-800">Ejercicio actual</div>
                  <div className="font-normal text-slate-400 tabular-nums">
                    {formatFecha(fechaCierre)}
                  </div>
                </th>
                {mostrarAnterior && (
                  <th className={cn(th, 'w-44')}>
                    <div className="font-semibold text-slate-800">Ejercicio anterior</div>
                    {fechaCierreAnterior && (
                      <div className="font-normal text-slate-400 tabular-nums">
                        {formatFecha(fechaCierreAnterior)}
                      </div>
                    )}
                  </th>
                )}
                {editando && <th className="w-10 border-b border-linea" />}
              </tr>
            </thead>

            <tbody>
              <FilaTitulo colSpan={columnas}>{TEXTOS_FLUJO.variaciones}</FilaTitulo>
              <tr>
                <td className="celda pl-6">{TEXTOS_FLUJO.efectivoInicio}</td>
                <td className="celda">
                  {bloqueo.saldoInicial ? (
                    calculado(flujo.saldoInicial, ORIGEN_BALANCE)
                  ) : (
                    <CeldaNumero
                      value={flujo.saldoInicial}
                      editando={editando}
                      onSave={(v) => setCampo('saldoInicial', v)}
                      dense
                    />
                  )}
                </td>
                {mostrarAnterior && (
                  <td className="celda">
                    {celdaAnterior(flujo.saldoInicialAnterior, vinculado, (v) =>
                      setCampo('saldoInicialAnterior', v),
                    )}
                  </td>
                )}
                {editando && <td />}
              </tr>
              <tr>
                <td className="celda pl-6">{TEXTOS_FLUJO.modificaciones}</td>
                <td className="celda">
                  <CeldaNumero
                    value={flujo.modificacionesEjAnt}
                    editando={editando}
                    onSave={(v) => setCampo('modificacionesEjAnt', v)}
                    dense
                  />
                </td>
                {mostrarAnterior && (
                  <td className="celda">
                    {celdaAnterior(flujo.modificacionesEjAntAnt, vinculado, (v) =>
                      setCampo('modificacionesEjAntAnt', v),
                    )}
                  </td>
                )}
                {editando && <td />}
              </tr>
              <FilaTotal
                label={TEXTOS_FLUJO.efectivoInicioModificado}
                actual={actual.efectivoInicioModificado}
                anterior={anterior?.efectivoInicioModificado}
                editando={editando}
              />
              <tr>
                <td className="celda pl-6">{TEXTOS_FLUJO.efectivoCierre}</td>
                <td className="celda">{calculado(flujo.saldoFinal, ORIGEN_BALANCE)}</td>
                {mostrarAnterior && (
                  <td className="celda">{calculado(flujo.saldoFinalAnterior, ORIGEN_BALANCE)}</td>
                )}
                {editando && <td />}
              </tr>
              <FilaTotal
                label={TEXTOS_FLUJO.variacionNeta}
                actual={actual.variacionNeta}
                anterior={anterior?.variacionNeta}
                editando={editando}
                fuerte
              />

              <FilaTitulo colSpan={columnas}>{TEXTOS_FLUJO.causas}</FilaTitulo>
              {SECCIONES_FLUJO.map((seccion) => {
                const lineas = flujo.items.filter((i) => i.seccion === seccion)
                return (
                  <SeccionFlujoFilas
                    key={seccion}
                    seccion={seccion}
                    lineas={lineas}
                    columnas={columnas}
                    editando={editando}
                    mostrarAnterior={mostrarAnterior}
                    isPending={isPending}
                    subtotal={actual.porSeccion[seccion]}
                    subtotalAnterior={anterior?.porSeccion[seccion]}
                    celdaAnterior={(i) =>
                      celdaAnterior(i.importeAnterior, bloqueo.lineasAnterior.has(i.id), (v) =>
                        setItem(i.id, { importeAnterior: v }),
                      )
                    }
                    onConcepto={(id, concepto) => setItem(id, { concepto })}
                    onImporte={(id, importe) => setItem(id, { importe })}
                    onAgregar={(concepto) => agregar(seccion, concepto)}
                    onEliminar={eliminar}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <FilaTotal
                label={TEXTOS_FLUJO.variacionNeta}
                actual={actual.sumaActividades}
                anterior={anterior?.sumaActividades}
                editando={editando}
                fuerte
                doble
              />
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

function FilaTitulo({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border-b border-linea bg-papel celda pt-4 font-serif text-tabla font-semibold text-tinta"
      >
        {children}
      </td>
    </tr>
  )
}

function FilaTotal({
  label,
  actual,
  anterior,
  editando,
  fuerte = false,
  doble = false,
}: {
  label: string
  actual: number
  anterior?: number
  editando: boolean
  fuerte?: boolean
  doble?: boolean
}) {
  const borde = doble ? 'border-t-2 border-double border-t-slate-400' : 'border-t border-t-linea'
  const celda = (v: number) => (
    <td className={cn('celda', borde)}>
      <CeldaNumero
        value={v}
        editando={false}
        soloLectura
        onSave={() => {}}
        dense
        className={cn('font-semibold', fuerte && 'text-tinta')}
      />
    </td>
  )
  return (
    <tr className={cn(fuerte && 'bg-slate-50')}>
      <td className={cn('celda pl-6 font-medium text-slate-800', borde, fuerte && 'font-semibold')}>
        {label}
      </td>
      {celda(actual)}
      {anterior !== undefined && celda(anterior)}
      {editando && <td className={borde} />}
    </tr>
  )
}

function SeccionFlujoFilas({
  seccion,
  lineas,
  columnas,
  editando,
  mostrarAnterior,
  isPending,
  subtotal,
  subtotalAnterior,
  celdaAnterior,
  onConcepto,
  onImporte,
  onAgregar,
  onEliminar,
}: {
  seccion: SeccionFlujo
  lineas: FlujoItemDTO[]
  columnas: number
  editando: boolean
  mostrarAnterior: boolean
  isPending: boolean
  subtotal: number
  subtotalAnterior?: number
  celdaAnterior: (i: FlujoItemDTO) => React.ReactNode
  onConcepto: (id: string, concepto: string) => void
  onImporte: (id: string, importe: number) => void
  onAgregar: (concepto: string) => void
  onEliminar: (id: string) => void
}) {
  const usados = new Set(lineas.map((l) => normalizarConcepto(l.concepto)))
  const sugeridos = CONCEPTOS_SUGERIDOS[seccion].filter((c) => !usados.has(normalizarConcepto(c)))
  const mostrarAgregar = editando || lineas.length === 0

  return (
    <>
      <tr>
        <td
          colSpan={columnas}
          className="celda pt-3 text-tabla-sm font-semibold text-slate-600 uppercase"
        >
          {SECCION_FLUJO_LABELS[seccion]}
        </td>
      </tr>
      {lineas.map((l) => (
        <tr key={l.id}>
          <td className="celda pl-6">
            {editando ? (
              <input
                type="text"
                value={l.concepto}
                onChange={(e) => onConcepto(l.id, e.target.value)}
                aria-label="Concepto"
                className="w-full rounded border border-blue-200 bg-white px-1.5 py-0.5 text-tabla text-slate-900 hover:border-blue-300 focus:border-blue-500 focus:outline-none"
              />
            ) : (
              l.concepto
            )}
          </td>
          <td className="celda">
            <CeldaNumero
              value={l.importe}
              editando={editando}
              onSave={(v) => onImporte(l.id, v)}
              dense
            />
          </td>
          {mostrarAnterior && <td className="celda">{celdaAnterior(l)}</td>}
          {editando && (
            <td className="celda text-center">
              <button
                type="button"
                onClick={() => onEliminar(l.id)}
                disabled={isPending}
                title="Eliminar línea"
                aria-label={`Eliminar ${l.concepto}`}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          )}
        </tr>
      ))}
      {mostrarAgregar && (
        <tr>
          <td colSpan={columnas} className="celda pl-6">
            <AgregarLinea sugeridos={sugeridos} disabled={isPending} onAgregar={onAgregar} />
          </td>
        </tr>
      )}
      <FilaTotal
        label={SECCION_FLUJO_SUBTOTAL[seccion]}
        actual={subtotal}
        anterior={subtotalAnterior}
        editando={editando}
      />
    </>
  )
}

function AgregarLinea({
  sugeridos,
  disabled,
  onAgregar,
}: {
  sugeridos: string[]
  disabled: boolean
  onAgregar: (concepto: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)

  function confirmar() {
    if (!texto.trim()) return
    onAgregar(texto.trim())
    setTexto('')
    setAbierto(false)
  }

  const chip =
    'inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sugeridos.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onAgregar(c)}
          disabled={disabled}
          className={chip}
        >
          <Plus className="h-3 w-3" />
          {c}
        </button>
      ))}
      {abierto ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar()
              if (e.key === 'Escape') setAbierto(false)
            }}
            placeholder="Concepto"
            className="w-64 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-900 focus:border-blue-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={confirmar}
            disabled={disabled || !texto.trim()}
            className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} disabled={disabled} className={chip}>
          <Plus className="h-3 w-3" />
          Otro concepto
        </button>
      )}
    </div>
  )
}

/** Control del estado: variación neta del efectivo (balance) = suma de las actividades. */
function ControlCuadre({
  actual,
  anterior,
}: {
  actual: TotalesColumna
  anterior: TotalesColumna | null
}) {
  const filas: [string, TotalesColumna][] = [['Ejercicio actual', actual]]
  if (anterior) filas.push(['Ejercicio anterior', anterior])
  return (
    <div className="flex flex-wrap gap-2">
      {filas.map(([label, t]) => (
        <p
          key={label}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs',
            t.cuadra
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {t.cuadra ? (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span>
            <strong className="font-semibold">{label}:</strong>{' '}
            {t.cuadra
              ? 'las actividades explican toda la variación del efectivo.'
              : `diferencia de ${formatCurrency(t.diferencia)} — el efectivo varió ${formatCurrency(t.variacionNeta)} y las actividades suman ${formatCurrency(t.sumaActividades)}.`}
          </span>
        </p>
      ))}
    </div>
  )
}
