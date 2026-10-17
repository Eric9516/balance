import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { CeldaNumero } from '@/components/shared/CeldaNumero'

// ─── Celda numérica de la matriz (densa). `calc` = solo lectura. ───────────────

function CeldaBDU({
  value,
  editando = false,
  onSave,
  calc = false,
  negativo = false,
  tdClassName,
}: {
  value: number
  editando?: boolean
  onSave?: (v: number) => void
  calc?: boolean
  negativo?: boolean
  tdClassName?: string
}) {
  return (
    <td className={cn('w-36 px-2 py-1', calc && 'bg-slate-50', tdClassName)}>
      <CeldaNumero
        value={value}
        editando={editando}
        soloLectura={calc}
        negativo={negativo}
        onSave={onSave ?? (() => {})}
        dense
      />
    </td>
  )
}

// ─── Fila de categoría ────────────────────────────────────────────────────────

export function FilaCategoria({
  bien,
  netoAnterior,
  editando,
  onGuardarCampo,
  onGuardarCategoria,
  onGuardarNetoAnterior,
  onDelete,
}: {
  bien: BienDeUsoDTO
  netoAnterior: number | null
  editando: boolean
  onGuardarCampo: (campo: keyof BienDeUsoDTO, valor: number) => void
  onGuardarCategoria: (valor: string) => void
  onGuardarNetoAnterior: (valor: number) => void
  onDelete: () => void
}) {
  const { costoFinReexpresado, depAcumFin, netoResidual } = calcularCierre(bien)

  return (
    <tr
      className={cn(
        'group border-b border-slate-100 transition-colors',
        editando ? 'bg-blue-50/20' : 'hover:bg-blue-50/10',
      )}
    >
      {/* Denominación */}
      <td className="sticky left-0 z-10 min-w-[180px] bg-white px-3 py-1">
        {editando ? (
          <input
            type="text"
            defaultValue={bien.categoria}
            onBlur={(e) => {
              if (e.target.value !== bien.categoria) onGuardarCategoria(e.target.value)
            }}
            className="w-full rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <span className="text-xs font-medium text-slate-800">{bien.categoria}</span>
        )}
      </td>

      {/* VALOR DE ORIGEN — Inicio | Aj. Inflación | Aumentos | Disminuciones | Cierre */}
      <CeldaBDU
        value={bien.costoInicioReexpresado}
        editando={editando}
        onSave={(v) => onGuardarCampo('costoInicioReexpresado', v)}
      />
      <CeldaBDU
        value={bien.costoAjusteInflacion}
        editando={editando}
        onSave={(v) => onGuardarCampo('costoAjusteInflacion', v)}
      />
      <CeldaBDU value={bien.altas} editando={editando} onSave={(v) => onGuardarCampo('altas', v)} />
      <CeldaBDU
        value={bien.bajas}
        editando={editando}
        onSave={(v) => onGuardarCampo('bajas', v)}
        negativo
      />
      <CeldaBDU value={costoFinReexpresado} calc />

      {/* AMORTIZACIONES — Inicio | Aj. Inflación | Baja | del ejercicio | Cierre */}
      <CeldaBDU
        value={bien.depAcumInicio}
        editando={editando}
        onSave={(v) => onGuardarCampo('depAcumInicio', v)}
      />
      <CeldaBDU
        value={bien.depAjusteInflacion}
        editando={editando}
        onSave={(v) => onGuardarCampo('depAjusteInflacion', v)}
      />
      <CeldaBDU
        value={bien.depBajas}
        editando={editando}
        onSave={(v) => onGuardarCampo('depBajas', v)}
        negativo
      />
      <CeldaBDU
        value={bien.depEjercicio}
        editando={editando}
        onSave={(v) => onGuardarCampo('depEjercicio', v)}
      />
      <CeldaBDU value={depAcumFin} calc />

      {/* NETO RESIDUAL */}
      <CeldaBDU value={netoResidual} calc />
      {netoAnterior !== null ? (
        // Viene del ejercicio anterior vinculado → solo lectura
        <td className="w-36 bg-slate-50 px-2 py-1.5 text-right font-mono text-xs text-slate-500 tabular-nums">
          {formatCurrency(netoAnterior, { decimales: 2 })}
        </td>
      ) : (
        // Carga manual del neto anterior (mismo control que el resto)
        <td className="w-36 px-2 py-1">
          <CeldaNumero
            value={bien.netoResidualAnteriorManual ?? 0}
            editando={editando}
            onSave={(v) => onGuardarNetoAnterior(v)}
            dense
          />
        </td>
      )}

      {/* Acciones */}
      <td className="w-20 px-2 py-1 text-center">
        <button
          onClick={onDelete}
          title="Eliminar categoría"
          className="p-0.5 text-slate-300 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Fila de total ────────────────────────────────────────────────────────────

export function FilaTotal({
  bienes,
  netoAnteriorMap,
  hayEjercicioAnterior,
}: {
  bienes: BienDeUsoDTO[]
  netoAnteriorMap: Map<string, number>
  hayEjercicioAnterior: boolean
}) {
  const sum = (campo: keyof BienDeUsoDTO) =>
    bienes.reduce((acc, b) => acc + (b[campo] as number), 0)

  const totCostoFin = bienes.reduce((acc, b) => acc + calcularCierre(b).costoFinReexpresado, 0)
  const totDepFin = bienes.reduce((acc, b) => acc + calcularCierre(b).depAcumFin, 0)
  const totNetoActual = totCostoFin - totDepFin
  const totNetoAnterior = hayEjercicioAnterior
    ? Array.from(netoAnteriorMap.values()).reduce((a, b) => a + b, 0)
    : bienes.reduce((a, b) => a + (b.netoResidualAnteriorManual ?? 0), 0)

  const cell = (v: number) => (
    <td className="w-36 px-2 py-2 text-right font-mono text-xs font-bold text-slate-900 tabular-nums">
      {formatCurrency(v, { decimales: 2 })}
    </td>
  )

  return (
    <tr className="border-t-2 border-slate-300 bg-slate-50">
      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900">
        TOTALES
      </td>
      {cell(sum('costoInicioReexpresado'))}
      {cell(sum('costoAjusteInflacion'))}
      {cell(sum('altas'))}
      {cell(sum('bajas'))}
      {cell(totCostoFin)}
      {cell(sum('depAcumInicio'))}
      {cell(sum('depAjusteInflacion'))}
      {cell(sum('depBajas'))}
      {cell(sum('depEjercicio'))}
      {cell(totDepFin)}
      {cell(totNetoActual)}
      <td className="w-36 px-2 py-2 text-right font-mono text-xs font-bold text-slate-700 tabular-nums">
        {netoAnteriorMap.size > 0 || bienes.some((b) => b.netoResidualAnteriorManual != null)
          ? formatCurrency(totNetoAnterior, { decimales: 2 })
          : '—'}
      </td>
      <td className="w-20" />
    </tr>
  )
}
