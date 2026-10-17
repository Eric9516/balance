import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import type { EERRData } from '../domain/types'
import { esRubroHuerfano } from '../lib/rubroHuerfano'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import {
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'

function EERRAmount({
  value,
  deduccion,
}: {
  value: number
  deduccion?: boolean
}) {
  return (
    <span>
      {deduccion ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
    </span>
  )
}

function EERRLine({
  label,
  value,
  valueAnt,
  conComparativo,
  deduccion,
  notaNumero,
  // Edición de la columna anterior
  editarAnterior = false,
  modulo,
  claveAnterior,
  comparativo,
  ejercicioId,
  sociedadId,
  esHuerfano = false,
}: {
  label: string
  value: number
  valueAnt: number
  conComparativo: boolean
  deduccion?: boolean
  notaNumero?: number | null
  editarAnterior?: boolean
  modulo?: 'EERR' | 'GASTOS'
  claveAnterior?: string
  comparativo?: ReturnType<typeof useComparativoLote>
  ejercicioId?: string
  sociedadId?: string
  esHuerfano?: boolean
}) {
  const editable = editarAnterior && !!modulo && !!claveAnterior && !!ejercicioId && !!sociedadId && !!comparativo
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
      <td className="px-4 py-2.5 text-sm text-slate-700">
        {esHuerfano && (
          <span className="mr-2 inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
            solo anterior
          </span>
        )}
        {label}
        {notaNumero != null && <span className="ml-1 text-xs text-slate-400">(Nota {notaNumero})</span>}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-slate-700">
        {esHuerfano ? <span className="text-slate-300">—</span> : <EERRAmount value={value} deduccion={deduccion} />}
      </td>
      {conComparativo && (
        <td className="px-2 py-2 text-right font-mono text-sm tabular-nums text-slate-500">
          {editable ? (
            <div className="flex items-center justify-end gap-1">
              <div className="w-36">
                <CeldaNumero
                  value={comparativo!.entradas.get(claveAnterior!)?.valor ?? valueAnt}
                  editando
                  onSave={(v) => comparativo!.setValor(claveAnterior!, v)}
                  negativo={deduccion}
                />
              </div>
              {esHuerfano && (
                <EliminarFilaAnterior
                  ejercicioId={ejercicioId!}
                  sociedadId={sociedadId!}
                  modulo={modulo!}
                  clave={claveAnterior!}
                  onDeleted={() => comparativo!.quitar(claveAnterior!)}
                />
              )}
            </div>
          ) : (
            <EERRAmount value={valueAnt} deduccion={deduccion} />
          )}
        </td>
      )}
    </tr>
  )
}

function EERRTotalLine({
  label,
  value,
  valueAnt,
  conComparativo,
  variant = 'bloque',
}: {
  label: string
  value: number
  valueAnt: number
  conComparativo: boolean
  variant?: 'bloque' | 'final'
}) {
  const final = variant === 'final'
  return (
    <tr className={cn(final ? 'border-t-2 border-slate-900 bg-slate-900 text-white' : 'border-t border-slate-300 bg-slate-100')}>
      <td className={cn('px-4 py-2 text-sm font-semibold', final ? 'text-white' : 'text-slate-800')}>
        {label}
      </td>
      <td className={cn('px-4 py-2 text-right font-mono text-sm tabular-nums font-semibold', final ? 'text-white' : value < 0 ? 'text-red-600' : 'text-slate-900')}>
        {formatCurrency(value)}
      </td>
      {conComparativo && (
        <td className={cn('px-4 py-2 text-right font-mono text-sm tabular-nums font-semibold', final ? 'text-white' : valueAnt < 0 ? 'text-red-600' : 'text-slate-700')}>
          {formatCurrency(valueAnt)}
        </td>
      )}
    </tr>
  )
}

export function EERRTab({
  eerr,
  conComparativo,
  editarAnterior,
  comparativo,
  ejercicioId,
  sociedadId,
}: {
  eerr: EERRData
  conComparativo: boolean
  editarAnterior: boolean
  comparativo: ReturnType<typeof useComparativoLote>
  ejercicioId: string
  sociedadId: string
}) {
  const resultadoPeriodo = eerr.utilidadEjercicio

  return (
    <div>
      <div
        className={cn(
          'mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm border',
          resultadoPeriodo >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200',
        )}
      >
        <Info
          className={cn(
            'h-4 w-4 flex-shrink-0',
            resultadoPeriodo >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}
        />
        <span className={resultadoPeriodo >= 0 ? 'text-emerald-700' : 'text-red-700'}>
          {resultadoPeriodo >= 0 ? 'Ganancia del período:' : 'Pérdida del período:'}{' '}
          <strong>{formatCurrency(Math.abs(resultadoPeriodo))}</strong>
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Concepto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-44">
                Importe
              </th>
              {conComparativo && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-44">
                  Comparativo
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <EERRLine
              label="Ingresos netos por ventas de bienes y servicios"
              value={eerr.ingresos} valueAnt={eerr.ingresosAnt} notaNumero={eerr.notaIngresosNum}
              conComparativo={conComparativo}
              editarAnterior={editarAnterior} modulo="EERR" claveAnterior="INGRESOS"
              comparativo={comparativo} ejercicioId={ejercicioId} sociedadId={sociedadId}
            />
            <EERRLine
              label={eerr.usaAnexoCosto ? 'Costo de los bienes vendidos y servicios (Anexo II)' : 'Costo de los bienes vendidos y servicios'}
              value={eerr.costoVentas} valueAnt={eerr.costoVentasAnt} notaNumero={eerr.notaCostoVentasNum} deduccion
              conComparativo={conComparativo}
              editarAnterior={editarAnterior} modulo="EERR" claveAnterior="COSTO_VENTAS"
              comparativo={comparativo} ejercicioId={ejercicioId} sociedadId={sociedadId}
            />
            <EERRTotalLine label="UTILIDAD BRUTA DE VENTAS" value={eerr.utilidadBruta} valueAnt={eerr.utilidadBrutaAnt} conComparativo={conComparativo} />
            {eerr.seccionesGasto.map((s) => (
              <EERRLine
                key={s.key}
                label={`${s.nombre} (Anexo III)`}
                value={s.total}
                valueAnt={s.totalAnt}
                deduccion
                conComparativo={conComparativo}
                editarAnterior={editarAnterior} modulo="GASTOS" claveAnterior={s.key}
                comparativo={comparativo} ejercicioId={ejercicioId} sociedadId={sociedadId}
                esHuerfano={esRubroHuerfano(s.key)}
              />
            ))}
            {editarAnterior && conComparativo && (
              <tr>
                <td colSpan={3} className="px-4 py-2">
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="GASTOS"
                    ordenBase={eerr.seccionesGasto.length}
                    texto="Agregar línea de gasto del período anterior"
                    onAdded={(dto) => comparativo.agregar({ modulo: dto.modulo, clave: dto.clave, label: dto.label, valor: dto.valor, esHuerfano: true, orden: dto.orden })}
                  />
                </td>
              </tr>
            )}
            <EERRLine
              label="Resultados financieros y por tenencia"
              value={eerr.resultadosFinancieros} valueAnt={eerr.resultadosFinancierosAnt}
              conComparativo={conComparativo}
              editarAnterior={editarAnterior} modulo="EERR" claveAnterior="RESULTADOS_FINANCIEROS"
              ejercicioId={ejercicioId} sociedadId={sociedadId}
            />
            <EERRTotalLine label="RESULTADO ANTES DEL IMPUESTO A LAS GANANCIAS" value={eerr.resultadoAntesIG} valueAnt={eerr.resultadoAntesIGAnt} conComparativo={conComparativo} />
            <EERRLine
              label="Impuesto a las ganancias"
              value={eerr.impuestoGanancias} valueAnt={eerr.impuestoGananciasAnt} deduccion
              conComparativo={conComparativo}
              editarAnterior={editarAnterior} modulo="EERR" claveAnterior="IMPUESTO_GANANCIAS"
              ejercicioId={ejercicioId} sociedadId={sociedadId}
            />
          </tbody>
          <tfoot>
            <EERRTotalLine
              label={resultadoPeriodo >= 0 ? 'GANANCIA DEL PERÍODO' : 'PÉRDIDA DEL PERÍODO'}
              value={Math.abs(eerr.utilidadEjercicio)}
              valueAnt={Math.abs(eerr.utilidadEjercicioAnt)}
              conComparativo={conComparativo}
              variant="final"
            />
          </tfoot>
        </table>
      </div>
    </div>
  )
}
