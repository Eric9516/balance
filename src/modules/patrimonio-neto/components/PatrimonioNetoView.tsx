'use client'

import {
  BotonVerCargado,
  TdCargado,
  ThCargado,
} from '@/modules/comparativo-manual/components/ColumnaCargado'
import { useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFecha } from '@/lib/utils/dates'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'
import { AvisosArrastre } from '@/components/shared/AvisosArrastre'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { TogglePlegarTodos } from '@/components/shared/ControlesTabla'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { useGruposColumnas } from '@/components/shared/useGruposColumnas'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { guardarEvolucionPNAction, confirmarPNAction } from '../actions/patrimonio-neto.actions'
import {
  totalMovimientoPN,
  type EvolucionPNData,
  type EvolucionPNMovimientoDTO,
} from '../domain/types'
import {
  COLUMNAS_PN as DETALLE,
  GRUPOS_PN as GRUPOS,
  type CampoPN,
  type ColumnaPN as Columna,
  type GrupoPN as Grupo,
} from '../domain/columnas'
import { saldoCierrePN, saldoInicioModificadoPN } from '../domain/evolucion'

// Modelo de columnas y filas derivadas: fuente única con el documento imprimible (domain).
type TipoPN = EvolucionPNMovimientoDTO['tipo']
type Mov = EvolucionPNMovimientoDTO

// ─── Componente ──────────────────────────────────────────────────────────────

interface Props {
  data: EvolucionPNData
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  /** Si se muestra la columna "Ejercicio anterior" (modos VINCULADO y MANUAL). */
  mostrarAnterior: boolean
  /** Denominación del ejercicio anterior vinculado (origen de los valores con candado). */
  anteriorDenominacion: string | null
  pnConfirmado?: boolean
  /** Anterior manual ya ajustado: las mismas filas con lo cargado, para mostrarlo al lado. */
  cargado?: EvolucionPNMovimientoDTO[] | null
}

export function PatrimonioNetoView({
  data: initialData,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  mostrarAnterior,
  anteriorDenominacion,
  pnConfirmado: initialConfirmado = false,
  cargado = null,
}: Props) {
  const [verCargado, setVerCargado] = useState(false)
  const movsCargados = verCargado ? cargado : null
  const {
    valor: data,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
  } = useEdicionLote(
    initialData,
    (borrador) =>
      // Se envían las filas tal cual: el servidor sanea lo bloqueado (saldo inicio / anterior).
      guardarEvolucionPNAction(
        ejercicioId,
        sociedadId,
        borrador.movimientos.map((mov) => ({
          tipo: mov.tipo,
          orden: mov.orden,
          capitalSuscripto: mov.capitalSuscripto,
          ajusteCapital: mov.ajusteCapital,
          aportesIrrevocables: mov.aportesIrrevocables,
          reservaLegal: mov.reservaLegal,
          otrasReservas: mov.otrasReservas,
          rdosNoAsignados: mov.rdosNoAsignados,
          totalAnterior: mov.totalAnterior,
        })),
        borrador.resultadoEjercicio,
      ),
    'Patrimonio Neto guardado',
  )
  const [confirmado, setConfirmado] = useState(initialConfirmado)
  const { isPending: isPendingConfirmar, ejecutar } = useGuardarAccion()
  const grupos = useGruposColumnas('eepn', GRUPOS)
  // En edición se ven todas las columnas: no se puede cargar lo que está plegado.
  const plegado = (g: Grupo) => !editando && grupos.estaPlegado(g)
  const columnasDe = (g: Grupo) => (plegado(g) ? [DETALLE[g].plegado] : DETALLE[g].columnas)

  const { bloqueo } = data
  const movimientos = data.movimientos
  const totalColumnas =
    1 +
    columnasDe('aportes').length +
    columnasDe('resultados').length +
    (mostrarAnterior ? 2 : 1) +
    (movsCargados ? 1 : 0)

  function setField(index: number, campo: CampoPN | 'totalAnterior', value: number) {
    actualizar((prev) => ({
      ...prev,
      movimientos: prev.movimientos.map((mov, i) =>
        i === index ? { ...mov, [campo]: value } : mov,
      ),
    }))
  }

  const inicioModificado = saldoInicioModificadoPN(movimientos)
  const saldoCierre = saldoCierrePN(movimientos)

  // ── Celdas ────────────────────────────────────────────────────────────────

  const tdNum = 'celda border-b border-linea text-right'
  const tdCalc = 'bg-slate-50/70'

  function celda(
    col: Columna,
    mov: Mov,
    index: number,
    opts: { editable: boolean; fuerte?: boolean },
  ) {
    const clave = col.tipo === 'campo' ? col.campo : col.label
    if (col.tipo === 'subtotal') {
      return (
        <td key={clave} className={cn(tdNum, tdCalc)}>
          <CeldaNumero
            value={col.calc(mov)}
            editando={false}
            soloLectura
            onSave={() => {}}
            dense
            className="font-semibold text-slate-900"
          />
        </td>
      )
    }
    const bloqueada = bloqueo.saldoInicio && mov.tipo === 'SALDO_INICIO' && opts.editable
    return (
      <td key={clave} className={tdNum}>
        {bloqueada ? (
          <CeldaBloqueada value={mov[col.campo]} origen={anteriorDenominacion} dense />
        ) : (
          <CeldaNumero
            value={mov[col.campo]}
            editando={editando && opts.editable}
            soloLectura={!opts.editable}
            onSave={(v) => setField(index, col.campo, v)}
            dense
            className={opts.fuerte ? 'font-semibold text-slate-900' : undefined}
          />
        )}
      </td>
    )
  }

  function celdasPN(
    mov: Mov,
    index: number,
    opts: { editable: boolean; fuerte?: boolean; cargado?: number },
  ) {
    return (
      <>
        <td className={cn(tdNum, tdCalc, 'border-l border-l-slate-300')}>
          <CeldaNumero
            value={totalMovimientoPN(mov)}
            editando={false}
            soloLectura
            onSave={() => {}}
            dense
            className="font-semibold text-slate-950"
          />
        </td>
        {mostrarAnterior && (
          <td className={tdNum}>
            {opts.editable && bloqueo.totalAnterior ? (
              <CeldaBloqueada value={mov.totalAnterior} origen={anteriorDenominacion} dense />
            ) : (
              <CeldaNumero
                value={mov.totalAnterior}
                editando={editando && opts.editable}
                soloLectura={!opts.editable}
                onSave={(v) => setField(index, 'totalAnterior', v)}
                dense
                className={opts.fuerte ? 'font-semibold text-slate-900' : 'text-slate-600'}
              />
            )}
          </td>
        )}
        {movsCargados && (
          <TdCargado
            valor={
              opts.cargado ?? movsCargados.find((m) => m.tipo === mov.tipo)?.totalAnterior ?? 0
            }
            fuerte={opts.fuerte}
          />
        )}
      </>
    )
  }

  const thRubro =
    'sticky left-0 z-10 min-w-[16rem] max-w-[20rem] border-b border-linea bg-superficie text-left text-tabla text-slate-800 celda'

  function filaMovimiento(tipo: TipoPN, label: string, opts: { resultado?: boolean } = {}) {
    const index = movimientos.findIndex((mov) => mov.tipo === tipo)
    const mov = movimientos[index]
    if (!mov) return null
    const editable = !opts.resultado
    return (
      <tr key={tipo}>
        <td className={thRubro}>
          {label}
          {opts.resultado && (
            <span className="ml-2 text-tabla-sm text-slate-400">(del Estado de Resultados)</span>
          )}
        </td>
        {GRUPOS.map((g) => columnasDe(g).map((col) => celda(col, mov, index, { editable })))}
        {celdasPN(mov, index, { editable })}
      </tr>
    )
  }

  function filaDerivada(label: string, mov: Mov, final = false, cargadoFila?: number) {
    return (
      <tr
        className={cn(
          '[&>td]:bg-slate-50',
          final
            ? '[&>td]:border-y-2 [&>td]:border-y-slate-800'
            : '[&>td]:border-y [&>td]:border-y-slate-300',
        )}
      >
        <td className={cn(thRubro, 'font-semibold text-slate-900')}>{label}</td>
        {GRUPOS.map((g) =>
          columnasDe(g).map((col) => celda(col, mov, -1, { editable: false, fuerte: true })),
        )}
        {celdasPN(mov, -1, { editable: false, fuerte: true, cargado: cargadoFila })}
      </tr>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const thGrupo =
    'border-b border-l border-linea px-3 py-2 text-center text-tabla-sm font-semibold tracking-wide text-slate-600 uppercase'
  const thCol =
    'border-b border-linea celda text-right align-bottom text-tabla-sm font-medium text-slate-600'

  return (
    <div className="max-w-full space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-slate-600">
            El resultado del ejercicio se toma automáticamente del Estado de Resultados.
          </p>
          <AvisosArrastre
            bloqueado={bloqueo.saldoInicio || bloqueo.totalAnterior}
            origen={anteriorDenominacion}
            advertencias={data.advertencias}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <TogglePlegarTodos
            todosPlegados={grupos.todosPlegados}
            onPlegar={grupos.plegarTodos}
            onExpandir={grupos.expandirTodos}
            disabled={editando}
          />
          {cargado && (
            <BotonVerCargado visible={verCargado} onToggle={() => setVerCargado((v) => !v)} />
          )}
          <BotonEditar
            editando={editando}
            onEditar={iniciarEdicion}
            onGuardar={confirmar}
            onCancelar={cancelar}
            isPending={isPending}
          />
          {!editando && (
            <button
              onClick={() => {
                const next = !confirmado
                ejecutar(
                  () => confirmarPNAction(ejercicioId, sociedadId, next),
                  () => {
                    setConfirmado(next)
                    if (next) toastSuccess('E.E.P.N. confirmado')
                  },
                )
              }}
              disabled={isPendingConfirmar}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
                confirmado
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-linea bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {confirmado ? 'Confirmado' : 'Confirmar E.E.P.N.'}
            </button>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-linea bg-superficie">
        <header className="border-b border-linea px-5 py-4 text-center">
          <h2 className="font-serif text-lg font-semibold text-tinta">
            Estado de Evolución del Patrimonio Neto
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Correspondiente al ejercicio finalizado el {formatFecha(fechaCierre)}
            {mostrarAnterior &&
              `, comparativo con ${formatFecha(fechaCierreAnterior, 'el ejercicio anterior')}`}
          </p>
        </header>

        <div className="max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full border-separate border-spacing-0 tabla-trabajo">
            <thead className="sticky top-0 z-20 bg-superficie">
              <tr>
                <th
                  rowSpan={2}
                  className={cn(
                    thRubro,
                    'z-30 align-bottom text-tabla-sm font-semibold text-slate-600 uppercase',
                  )}
                >
                  Rubros
                </th>
                {GRUPOS.map((g) => {
                  const cerrado = plegado(g)
                  const Icono = cerrado ? ChevronRight : ChevronLeft
                  return (
                    <th key={g} colSpan={columnasDe(g).length} className={thGrupo}>
                      <button
                        type="button"
                        onClick={() => grupos.alternar(g)}
                        disabled={editando}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:hover:bg-transparent"
                        title={cerrado ? 'Ver detalle' : 'Mostrar solo el total'}
                      >
                        {DETALLE[g].titulo}
                        {!editando && <Icono className="h-3.5 w-3.5 text-slate-400" />}
                      </button>
                    </th>
                  )
                })}
                <th
                  colSpan={(mostrarAnterior ? 2 : 1) + (movsCargados ? 1 : 0)}
                  className={cn(thGrupo, 'border-l-slate-300')}
                >
                  Patrimonio neto
                </th>
              </tr>
              <tr>
                {GRUPOS.map((g) =>
                  columnasDe(g).map((col, i) => (
                    <th
                      key={`${g}-${i}`}
                      className={cn(thCol, 'min-w-[8.5rem]', i === 0 && 'border-l border-l-linea')}
                    >
                      {col.label}
                    </th>
                  )),
                )}
                <th className={cn(thCol, 'min-w-[9rem] border-l border-l-slate-300')}>
                  <div className="font-semibold text-slate-800">Ejercicio actual</div>
                  <div className="font-normal text-slate-400 tabular-nums">
                    {formatFecha(fechaCierre)}
                  </div>
                </th>
                {mostrarAnterior && (
                  <th className={cn(thCol, 'min-w-[9rem]')}>
                    <div className="font-semibold text-slate-800">Ejercicio anterior</div>
                    {fechaCierreAnterior && (
                      <div className="font-normal text-slate-400 tabular-nums">
                        {formatFecha(fechaCierreAnterior)}
                      </div>
                    )}
                  </th>
                )}
                {movsCargados && <ThCargado />}
              </tr>
            </thead>
            <tbody className={cn(isPending && 'opacity-60')}>
              {filaMovimiento('SALDO_INICIO', 'Saldos al inicio del ejercicio')}
              {filaMovimiento('AJUSTE_INFLACION', 'Ajuste por inflación del ejercicio')}
              {filaMovimiento('MODIFICACION_INICIO', 'Modificación de saldos al inicio (Nota 1.6)')}
              {filaDerivada(
                'Saldos al inicio modificados',
                inicioModificado,
                false,
                movsCargados ? saldoInicioModificadoPN(movsCargados).totalAnterior : undefined,
              )}
              <tr>
                <td
                  colSpan={totalColumnas}
                  className="border-b border-linea bg-superficie px-3 pt-4 pb-1.5 text-tabla-sm font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Distribución de resultados
                </td>
              </tr>
              {filaMovimiento('DISTRIB_HONORARIOS', 'Honorarios')}
              {filaMovimiento('DISTRIB_DIVIDENDOS', 'Dividendos')}
              {filaMovimiento('DISTRIB_RESERVA_LEGAL', 'Reserva legal')}
              {filaMovimiento('DISTRIB_OTRAS_RESERVAS', 'Otras reservas')}
              {filaMovimiento('DISTRIB_APORTES_IRREVOCABLES', 'Aportes irrevocables')}
              {filaMovimiento('RESULTADO_EJERCICIO', 'Resultado del ejercicio', {
                resultado: true,
              })}
              {filaDerivada(
                'Saldos al cierre del ejercicio',
                saldoCierre,
                true,
                movsCargados ? saldoCierrePN(movsCargados).totalAnterior : undefined,
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
