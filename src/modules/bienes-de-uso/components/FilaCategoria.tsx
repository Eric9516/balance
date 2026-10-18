import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularCierre, type BienDeUsoDTO } from '../domain/types'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'

// ─── Modelo de columnas del Anexo I ──────────────────────────────────────────

type CampoEditable =
  | 'costoInicioReexpresado'
  | 'costoAjusteInflacion'
  | 'altas'
  | 'bajas'
  | 'depAcumInicio'
  | 'depAjusteInflacion'
  | 'depBajas'
  | 'depEjercicio'

export type ColumnaBDU =
  | {
      tipo: 'campo'
      campo: CampoEditable
      label: string
      /** Arrastrada del anterior vinculado (candado) cuando la fila tiene fuente. */
      inicio?: boolean
      negativo?: boolean
    }
  | { tipo: 'calc'; label: string; calc: (b: BienDeUsoDTO) => number }

export const GRUPOS_BDU = ['origen', 'amortizaciones'] as const
export type GrupoBDU = (typeof GRUPOS_BDU)[number]

const costoFin = (b: BienDeUsoDTO) => calcularCierre(b).costoFinReexpresado
const depFin = (b: BienDeUsoDTO) => calcularCierre(b).depAcumFin

export const COLUMNAS_BDU: Record<
  GrupoBDU,
  { titulo: string; columnas: ColumnaBDU[]; plegado: ColumnaBDU }
> = {
  origen: {
    titulo: 'Valor de origen',
    columnas: [
      { tipo: 'campo', campo: 'costoInicioReexpresado', label: 'Al comienzo', inicio: true },
      { tipo: 'campo', campo: 'costoAjusteInflacion', label: 'Ajuste por inflación' },
      { tipo: 'campo', campo: 'altas', label: 'Aumentos' },
      { tipo: 'campo', campo: 'bajas', label: 'Disminuciones', negativo: true },
      { tipo: 'calc', label: 'Al cierre', calc: costoFin },
    ],
    plegado: { tipo: 'calc', label: 'Valor al cierre', calc: costoFin },
  },
  amortizaciones: {
    titulo: 'Amortizaciones acumuladas',
    columnas: [
      { tipo: 'campo', campo: 'depAcumInicio', label: 'Al comienzo', inicio: true },
      { tipo: 'campo', campo: 'depAjusteInflacion', label: 'Ajuste por inflación' },
      { tipo: 'campo', campo: 'depBajas', label: 'Bajas', negativo: true },
      { tipo: 'campo', campo: 'depEjercicio', label: 'Del ejercicio' },
      { tipo: 'calc', label: 'Al cierre', calc: depFin },
    ],
    plegado: { tipo: 'calc', label: 'Amortización al cierre', calc: depFin },
  },
}

const TD = 'celda border-b border-linea text-right'
const TD_CALC = 'bg-slate-50/70'

// ─── Fila de categoría ────────────────────────────────────────────────────────

export function FilaCategoria({
  bien,
  columnas,
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
  /** Columnas visibles de los dos grupos (según qué está plegado). */
  columnas: ColumnaBDU[]
  /** Neto residual al cierre del ejercicio anterior (derivado), o null si no hay dato. */
  netoAnterior: number | null
  /** Las columnas de inicio vienen del ejercicio anterior vinculado (candado). */
  bloqueada: boolean
  mostrarAnterior: boolean
  /** Modo MANUAL: el neto residual anterior se carga a mano en el borrador. */
  editarAnterior: boolean
  editando: boolean
  onGuardarCampo: (campo: keyof BienDeUsoDTO, valor: number) => void
  onGuardarCategoria: (valor: string) => void
  onGuardarNetoAnterior: (valor: number) => void
  onDelete: () => void
}) {
  const { netoResidual } = calcularCierre(bien)

  return (
    <tr className="group">
      <td className="sticky left-0 z-10 min-w-[14rem] border-b border-linea bg-superficie celda text-left">
        {editando ? (
          <input
            type="text"
            defaultValue={bien.categoria}
            onBlur={(e) => {
              if (e.target.value !== bien.categoria) onGuardarCategoria(e.target.value)
            }}
            className="w-full rounded border border-blue-200 bg-white px-2 py-0.5 text-tabla font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        ) : (
          <span className="text-tabla font-medium text-slate-800">{bien.categoria}</span>
        )}
      </td>

      {columnas.map((col, i) =>
        col.tipo === 'calc' ? (
          <td key={`calc-${i}`} className={cn(TD, TD_CALC)}>
            <CeldaNumero
              value={col.calc(bien)}
              editando={false}
              soloLectura
              onSave={() => {}}
              dense
              className="font-semibold text-slate-900"
            />
          </td>
        ) : bloqueada && col.inicio ? (
          <td key={`${col.campo}-${i}`} className={cn(TD, TD_CALC)}>
            <CeldaBloqueada value={bien[col.campo]} negativo={col.negativo} dense />
          </td>
        ) : (
          <td key={`${col.campo}-${i}`} className={TD}>
            <CeldaNumero
              value={bien[col.campo]}
              editando={editando}
              negativo={col.negativo}
              onSave={(v) => onGuardarCampo(col.campo, v)}
              dense
            />
          </td>
        ),
      )}

      {/* Neto residual: ejercicio actual | ejercicio anterior */}
      <td className={cn(TD, TD_CALC, 'border-l border-l-slate-300')}>
        <CeldaNumero
          value={netoResidual}
          editando={false}
          soloLectura
          onSave={() => {}}
          dense
          className="font-semibold text-slate-950"
        />
      </td>
      {mostrarAnterior &&
        (editarAnterior ? (
          <td className={TD}>
            <CeldaNumero
              value={bien.netoResidualAnteriorManual ?? 0}
              editando={editando}
              onSave={onGuardarNetoAnterior}
              dense
            />
          </td>
        ) : bloqueada ? (
          <td className={cn(TD, TD_CALC)}>
            <CeldaBloqueada value={netoAnterior ?? 0} dense />
          </td>
        ) : (
          <td
            className={cn(TD, TD_CALC, 'text-tabla text-slate-300')}
            title="Sin dato en el ejercicio anterior"
          >
            —
          </td>
        ))}

      <td className="w-12 border-b border-linea px-2 text-center">
        <button
          onClick={onDelete}
          title="Eliminar categoría"
          className="p-0.5 text-slate-300 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500 focus:opacity-100"
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
  columnas,
  netoAnteriorMap,
  mostrarAnterior,
  editarAnterior,
}: {
  bienes: BienDeUsoDTO[]
  columnas: ColumnaBDU[]
  netoAnteriorMap: Map<string, number>
  mostrarAnterior: boolean
  editarAnterior: boolean
}) {
  const totalCol = (col: ColumnaBDU) =>
    bienes.reduce((acc, b) => acc + (col.tipo === 'calc' ? col.calc(b) : b[col.campo]), 0)
  const totNetoActual = bienes.reduce((acc, b) => acc + calcularCierre(b).netoResidual, 0)

  // MANUAL: suma lo cargado en el borrador. VINCULADO: suma lo derivado del anterior.
  const hayNetoAnterior = editarAnterior
    ? bienes.some((b) => b.netoResidualAnteriorManual != null)
    : netoAnteriorMap.size > 0
  const totNetoAnterior = editarAnterior
    ? bienes.reduce((acc, b) => acc + (b.netoResidualAnteriorManual ?? 0), 0)
    : Array.from(netoAnteriorMap.values()).reduce((acc, v) => acc + v, 0)

  const td = 'celda border-t-2 border-t-slate-800 bg-slate-50 text-right'
  const num = (v: number, negativo = false) => (
    <CeldaNumero
      value={v}
      editando={false}
      soloLectura
      onSave={() => {}}
      dense
      negativo={negativo}
      className="font-bold text-slate-950"
    />
  )

  return (
    <tr>
      <td className="sticky left-0 z-10 border-t-2 border-t-slate-800 bg-slate-50 celda text-left text-tabla font-bold text-slate-950">
        Totales
      </td>
      {columnas.map((col, i) => (
        <td key={i} className={td}>
          {num(totalCol(col), col.tipo === 'campo' && col.negativo)}
        </td>
      ))}
      <td className={cn(td, 'border-l border-l-slate-300')}>{num(totNetoActual)}</td>
      {mostrarAnterior && (
        <td className={td}>
          {hayNetoAnterior ? num(totNetoAnterior) : <span className="text-slate-300">—</span>}
        </td>
      )}
      <td className="border-t-2 border-t-slate-800 bg-slate-50" />
    </tr>
  )
}
