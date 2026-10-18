import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'

const TD_CLS = 'w-36 px-2 py-1'
const TD_LECTURA_CLS = 'w-36 bg-slate-50 px-2 py-1'

// ─── Celda numérica de la matriz (densa) ──────────────────────────────────────
// `calc` = calculada (solo lectura). `bloqueada` = arrastrada del ejercicio anterior
// vinculado: candado y nunca editable, aunque la tabla esté en edición.

function CeldaBDU({
  value,
  editando = false,
  onSave,
  calc = false,
  bloqueada = false,
  negativo = false,
}: {
  value: number
  editando?: boolean
  onSave?: (v: number) => void
  calc?: boolean
  bloqueada?: boolean
  negativo?: boolean
}) {
  if (bloqueada) {
    return (
      <td className={TD_LECTURA_CLS}>
        <CeldaBloqueada value={value} negativo={negativo} dense />
      </td>
    )
  }
  return (
    <td className={cn(TD_CLS, calc && 'bg-slate-50')}>
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

// ─── Celda "Neto residual ejercicio anterior" ─────────────────────────────────
// - editarAnterior (modo MANUAL): se carga a mano en el borrador.
// - bloqueada (modo VINCULADO con fuente): arrastrada, con candado.
// - sin fuente en el anterior: '—' con explicación.

function CeldaNetoAnterior({
  bien,
  netoAnterior,
  bloqueada,
  editarAnterior,
  editando,
  onGuardar,
}: {
  bien: BienDeUsoDTO
  netoAnterior: number | null
  bloqueada: boolean
  editarAnterior: boolean
  editando: boolean
  onGuardar: (v: number) => void
}) {
  if (editarAnterior) {
    return (
      <td className={TD_CLS}>
        <CeldaNumero
          value={bien.netoResidualAnteriorManual ?? 0}
          editando={editando}
          onSave={onGuardar}
          dense
        />
      </td>
    )
  }
  if (bloqueada) {
    return (
      <td className={TD_LECTURA_CLS}>
        <CeldaBloqueada value={netoAnterior ?? 0} dense />
      </td>
    )
  }
  return (
    <td
      className={cn(TD_LECTURA_CLS, 'text-right font-mono text-xs text-slate-300 tabular-nums')}
      title="Sin dato en el ejercicio anterior"
    >
      —
    </td>
  )
}

// ─── Fila de categoría ────────────────────────────────────────────────────────

export function FilaCategoria({
  bien,
  netoAnterior,
  bloqueada,
  mostrarAnterior,
  editarAnterior,
  editando,
  onGuardarCampo,
  onGuardarCategoria,
  onGuardarNetoAnterior,
  onDelete,
}: {
  bien: BienDeUsoDTO
  /** Neto residual al cierre del ejercicio anterior (derivado), o null si no hay dato. */
  netoAnterior: number | null
  /** Las columnas de inicio vienen del ejercicio anterior vinculado (candado). */
  bloqueada: boolean
  /** Si se muestra la columna "Neto residual ejercicio anterior". */
  mostrarAnterior: boolean
  /** Modo MANUAL: el neto residual anterior se carga a mano en el borrador. */
  editarAnterior: boolean
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
        bloqueada={bloqueada}
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
        bloqueada={bloqueada}
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

      {/* NETO RESIDUAL — Ejercicio actual | Ejercicio anterior */}
      <CeldaBDU value={netoResidual} calc />
      {mostrarAnterior && (
        <CeldaNetoAnterior
          bien={bien}
          netoAnterior={netoAnterior}
          bloqueada={bloqueada}
          editarAnterior={editarAnterior}
          editando={editando}
          onGuardar={onGuardarNetoAnterior}
        />
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
  mostrarAnterior,
  editarAnterior,
}: {
  bienes: BienDeUsoDTO[]
  netoAnteriorMap: Map<string, number>
  mostrarAnterior: boolean
  editarAnterior: boolean
}) {
  const sum = (campo: keyof BienDeUsoDTO) =>
    bienes.reduce((acc, b) => acc + (b[campo] as number), 0)

  const totCostoFin = bienes.reduce((acc, b) => acc + calcularCierre(b).costoFinReexpresado, 0)
  const totDepFin = bienes.reduce((acc, b) => acc + calcularCierre(b).depAcumFin, 0)
  const totNetoActual = totCostoFin - totDepFin

  // Modo MANUAL: suma lo cargado en el borrador. Modo VINCULADO: suma lo derivado del anterior.
  const hayNetoAnterior = editarAnterior
    ? bienes.some((b) => b.netoResidualAnteriorManual != null)
    : netoAnteriorMap.size > 0
  const totNetoAnterior = editarAnterior
    ? bienes.reduce((acc, b) => acc + (b.netoResidualAnteriorManual ?? 0), 0)
    : Array.from(netoAnteriorMap.values()).reduce((acc, v) => acc + v, 0)

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
      {mostrarAnterior && (
        <td className="w-36 px-2 py-2 text-right font-mono text-xs font-bold text-slate-700 tabular-nums">
          {hayNetoAnterior ? formatCurrency(totNetoAnterior, { decimales: 2 }) : '—'}
        </td>
      )}
      <td className="w-20" />
    </tr>
  )
}
