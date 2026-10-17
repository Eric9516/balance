'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFecha } from '@/lib/utils/dates'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { guardarEvolucionPNAction, confirmarPNAction } from '../actions/patrimonio-neto.actions'
import { totalMovimientoPN, type EvolucionPNData, type EvolucionPNMovimientoDTO } from '../domain/types'

const APORTE_CAMPOS = [
  ['capitalSuscripto', 'Capital Suscripto'],
  ['ajusteCapital', 'Ajuste del Capital'],
  ['aportesIrrevocables', 'Aportes Irrevocables'],
] as const

const RESERVA_CAMPOS = [
  ['reservaLegal', 'Reserva Legal'],
  ['otrasReservas', 'Otras Reservas'],
] as const

type CampoPN =
  | 'capitalSuscripto'
  | 'ajusteCapital'
  | 'aportesIrrevocables'
  | 'reservaLegal'
  | 'otrasReservas'
  | 'rdosNoAsignados'
type TipoPN = EvolucionPNMovimientoDTO['tipo']

interface Props {
  data: EvolucionPNData
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  pnConfirmado?: boolean
}

export function PatrimonioNetoView({
  data: initialData,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  pnConfirmado: initialConfirmado = false,
}: Props) {
  const { valor: data, editando, isPending, iniciarEdicion, cancelar, confirmar, actualizar } = useEdicionLote(
    initialData,
    (borrador) =>
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

  function setField(index: number, campo: CampoPN | 'totalAnterior', value: number) {
    actualizar((prev) => ({
      ...prev,
      movimientos: prev.movimientos.map((mov, i) => (i === index ? { ...mov, [campo]: value } : mov)),
    }))
  }

  const movimientos = data.movimientos
  const byTipo = new Map(movimientos.map((mov) => [mov.tipo, mov]))

  function getMov(tipo: TipoPN): EvolucionPNMovimientoDTO {
    const mov = byTipo.get(tipo)
    if (!mov) throw new Error(`Movimiento PN faltante: ${tipo}`)
    return mov
  }

  function sumAportes(mov: EvolucionPNMovimientoDTO) {
    return mov.capitalSuscripto + mov.ajusteCapital + mov.aportesIrrevocables
  }

  function sumReservas(mov: EvolucionPNMovimientoDTO) {
    return mov.reservaLegal + mov.otrasReservas
  }

  function sumMovimientos(tipos: TipoPN[]): EvolucionPNMovimientoDTO {
    return tipos.reduce<EvolucionPNMovimientoDTO>(
      (acc, tipo) => {
        const mov = getMov(tipo)
        return {
          ...acc,
          capitalSuscripto: acc.capitalSuscripto + mov.capitalSuscripto,
          ajusteCapital: acc.ajusteCapital + mov.ajusteCapital,
          aportesIrrevocables: acc.aportesIrrevocables + mov.aportesIrrevocables,
          reservaLegal: acc.reservaLegal + mov.reservaLegal,
          otrasReservas: acc.otrasReservas + mov.otrasReservas,
          rdosNoAsignados: acc.rdosNoAsignados + mov.rdosNoAsignados,
          totalAnterior: acc.totalAnterior + mov.totalAnterior,
        }
      },
      {
        id: '',
        ejercicioId,
        tipo: tipos[0],
        orden: 0,
        capitalSuscripto: 0,
        ajusteCapital: 0,
        aportesIrrevocables: 0,
        reservaLegal: 0,
        otrasReservas: 0,
        rdosNoAsignados: 0,
        totalAnterior: 0,
      },
    )
  }

  const inicioModificado = sumMovimientos(['SALDO_INICIO', 'AJUSTE_INFLACION', 'MODIFICACION_INICIO'])
  const saldoCierre = sumMovimientos(movimientos.map((mov) => mov.tipo))

  function renderEditableCell(index: number, campo: CampoPN, mov: EvolucionPNMovimientoDTO, disabled = false) {
    return (
      <td key={campo} className="border border-slate-300 px-1.5 py-1 text-right">
        <CeldaNumero
          value={mov[campo]}
          editando={editando}
          soloLectura={disabled}
          onSave={(v) => setField(index, campo, v)}
          dense
        />
      </td>
    )
  }

  function renderMovimientoRow(tipo: TipoPN, label: string, options: { resultado?: boolean } = {}) {
    const index = movimientos.findIndex((mov) => mov.tipo === tipo)
    const mov = movimientos[index]
    if (!mov) return null
    const disabled = options.resultado

    return (
      <tr className="hover:bg-slate-50/60">
        <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1 text-left text-[11px] text-slate-800">
          {label}
        </td>
        {APORTE_CAMPOS.map(([campo]) => renderEditableCell(index, campo, mov, disabled))}
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={sumAportes(mov)} editando={false} soloLectura onSave={() => {}} dense />
        </td>
        {RESERVA_CAMPOS.map(([campo]) => renderEditableCell(index, campo, mov, disabled))}
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={sumReservas(mov)} editando={false} soloLectura onSave={() => {}} dense />
        </td>
        {renderEditableCell(index, 'rdosNoAsignados', mov, disabled)}
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={totalMovimientoPN(mov)} editando={false} soloLectura onSave={() => {}} dense className="font-semibold text-slate-950" />
        </td>
        <td className="border border-slate-300 px-1.5 py-1 text-right">
          <CeldaNumero value={mov.totalAnterior} editando={editando} onSave={(v) => setField(index, 'totalAnterior', v)} dense />
        </td>
      </tr>
    )
  }

  function renderDerivedRow(label: string, mov: EvolucionPNMovimientoDTO, strong = false) {
    return (
      <tr className={cn('font-semibold', strong ? 'border-y-2 border-slate-900' : 'border-y border-slate-500')}>
        <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1 text-left text-[11px] text-slate-900">
          {label}
        </td>
        {APORTE_CAMPOS.map(([campo]) => (
          <td key={campo} className="border border-slate-300 px-1.5 py-1 text-right">
            <CeldaNumero value={mov[campo]} editando={false} soloLectura onSave={() => {}} dense className={strong ? 'font-semibold text-slate-950' : undefined} />
          </td>
        ))}
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={sumAportes(mov)} editando={false} soloLectura onSave={() => {}} dense className="font-semibold text-slate-950" />
        </td>
        {RESERVA_CAMPOS.map(([campo]) => (
          <td key={campo} className="border border-slate-300 px-1.5 py-1 text-right">
            <CeldaNumero value={mov[campo]} editando={false} soloLectura onSave={() => {}} dense className={strong ? 'font-semibold text-slate-950' : undefined} />
          </td>
        ))}
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={sumReservas(mov)} editando={false} soloLectura onSave={() => {}} dense className="font-semibold text-slate-950" />
        </td>
        <td className="border border-slate-300 px-1.5 py-1 text-right">
          <CeldaNumero value={mov.rdosNoAsignados} editando={false} soloLectura onSave={() => {}} dense className={strong ? 'font-semibold text-slate-950' : undefined} />
        </td>
        <td className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-right">
          <CeldaNumero value={totalMovimientoPN(mov)} editando={false} soloLectura onSave={() => {}} dense className="font-semibold text-slate-950" />
        </td>
        <td className="border border-slate-300 px-1.5 py-1 text-right">
          <CeldaNumero value={mov.totalAnterior} editando={false} soloLectura onSave={() => {}} dense className={strong ? 'font-semibold text-slate-950' : undefined} />
        </td>
      </tr>
    )
  }

  return (
    <div className="max-w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          El resultado del ejercicio se toma automáticamente del Estado de Resultados.
          {data.autocompletadoDesdeAnterior && (
            <span className="ml-1 font-medium">
              Se autocompletaron saldos iniciales y comparativos desde el ejercicio anterior.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <BotonEditar
            editando={editando}
            onEditar={iniciarEdicion}
            onGuardar={confirmar}
            onCancelar={cancelar}
            isPending={isPending}
          />

          {/* Confirmar / Desconfirmar */}
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
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {confirmado ? 'Confirmado' : 'Confirmar E.E.P.N.'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="min-w-[1280px] w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th colSpan={11} className="border border-slate-900 bg-white px-3 py-2 text-center">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-950">
                    Estado de Evolución del Patrimonio Neto
                  </p>
                  <p className="text-[10px] font-medium text-slate-700">
                    (Capital, reservas y otros resultados acumulados)
                  </p>
                  <p className="text-[10px] font-normal italic text-slate-600">
                    Correspondiente al ejercicio finalizado el {formatFecha(fechaCierre)}, comparativo con {formatFecha(fechaCierreAnterior, 'ejercicio anterior')}
                  </p>
                </div>
              </th>
            </tr>
            <tr className="bg-slate-50 text-[10px] uppercase text-slate-700">
              <th rowSpan={2} className="sticky left-0 z-20 w-64 border border-slate-900 bg-slate-50 px-2 py-2 text-center font-semibold">
                Rubros
              </th>
              <th colSpan={4} className="border border-slate-900 px-2 py-1 text-center font-semibold">
                Aporte de los propietarios
              </th>
              <th colSpan={4} className="border border-slate-900 px-2 py-1 text-center font-semibold">
                Resultados acumulados
              </th>
              <th colSpan={2} className="border border-slate-900 px-2 py-1 text-center font-semibold">
                Patrimonio Neto
              </th>
            </tr>
            <tr className="bg-slate-50 text-[10px] text-slate-700">
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Capital Suscripto</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Ajuste del Capital</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Aportes Irrevocables</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Total</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Reserva Legal</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Otras Reservas</th>
              <th className="w-24 border border-slate-900 px-1 py-1 text-center font-medium">Total</th>
              <th className="w-28 border border-slate-900 px-1 py-1 text-center font-medium">Resultados no Asignados</th>
              <th className="w-28 border border-slate-900 px-1 py-1 text-center font-medium">Ejercicio Actual</th>
              <th className="w-28 border border-slate-900 px-1 py-1 text-center font-medium">Ejercicio Anterior</th>
            </tr>
          </thead>
          <tbody className={cn(isPending && 'opacity-60')}>
            {renderMovimientoRow('SALDO_INICIO', 'Saldos al inicio del ejercicio')}
            {renderMovimientoRow('AJUSTE_INFLACION', 'Aj. por inflación del ejercicio')}
            {renderMovimientoRow('MODIFICACION_INICIO', 'Modificación de saldos al inicio del ejercicio (Nota 1.6)')}
            {renderDerivedRow('Saldos al inicio del ejercicio modificados', inicioModificado)}
            <tr>
              <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-2 text-left text-[11px] font-semibold text-slate-800">
                Distribución de resultados
              </td>
              {Array.from({ length: 10 }).map((_, index) => (
                <td key={index} className="border border-slate-300 px-1.5 py-2" />
              ))}
            </tr>
            {renderMovimientoRow('DISTRIB_HONORARIOS', 'Honorarios')}
            {renderMovimientoRow('DISTRIB_DIVIDENDOS', 'Dividendos')}
            {renderMovimientoRow('DISTRIB_RESERVA_LEGAL', 'Reserva Legal')}
            {renderMovimientoRow('DISTRIB_OTRAS_RESERVAS', 'Otras Reservas')}
            {renderMovimientoRow('DISTRIB_APORTES_IRREVOCABLES', 'Aportes Irrevocables')}
            {renderMovimientoRow('RESULTADO_EJERCICIO', 'Resultado del Ejercicio', { resultado: true })}
            {renderDerivedRow('Saldos al cierre del Ejercicio', saldoCierre, true)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
