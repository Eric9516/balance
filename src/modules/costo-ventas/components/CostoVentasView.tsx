'use client'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { guardarTodoCostoVentasAction } from '../actions/costo-ventas.actions'
import { calcularCostoTotal, type CostoVentasDTO } from '../domain/types'
import {
  ToggleEditarAnterior,
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
  type ComparativoEntry,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'

// ─── Fila de datos ────────────────────────────────────────────────────────────

function FilaDato({
  label,
  valor,
  valorAnterior,
  esDeduccion = false,
  editando,
  onSave,
  // Edición de la columna anterior (cuando no hay balance anterior importado)
  editandoAnterior = false,
  onSaveAnterior,
}: {
  label: string
  valor: number
  valorAnterior: number | null
  esDeduccion?: boolean
  editando: boolean
  onSave: (v: number) => void
  editandoAnterior?: boolean
  onSaveAnterior?: (v: number) => void
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/40">
      <td className="px-4 py-2.5 text-sm text-slate-700">{label}</td>
      <td className="w-44 px-4 py-2.5">
        <CeldaNumero value={valor} editando={editando} onSave={onSave} negativo={esDeduccion} />
      </td>
      {editandoAnterior && onSaveAnterior ? (
        <td className="w-44 px-2 py-2">
          <CeldaNumero
            value={valorAnterior ?? 0}
            editando
            onSave={onSaveAnterior}
            negativo={esDeduccion}
          />
        </td>
      ) : (
        <td className="w-44 px-4 py-2.5 text-right font-mono text-sm text-slate-500 tabular-nums">
          {valorAnterior !== null
            ? esDeduccion
              ? `(${formatCurrency(valorAnterior, { decimales: 2 })})`
              : formatCurrency(valorAnterior, { decimales: 2 })
            : '—'}
        </td>
      )}
    </tr>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  datos: CostoVentasDTO | null
  datosAnteriores: CostoVentasDTO | null
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  // Edición manual de la columna anterior (sin balance anterior importado)
  editarAnterior?: boolean
  conceptosExtra?: ComparativoManualDTO[]
}

const VACIO: Omit<CostoVentasDTO, 'id' | 'ejercicioId'> = {
  existenciaInicial: 0,
  compras: 0,
  gastosFabricacion: 0,
  existenciaFinal: 0,
}

const CLAVES_FIJAS: { clave: keyof typeof VACIO; label: string }[] = [
  { clave: 'existenciaInicial', label: 'Existencia al comienzo del ejercicio' },
  { clave: 'compras', label: 'Compras del ejercicio' },
  { clave: 'gastosFabricacion', label: 'Gastos del ejercicio' },
  { clave: 'existenciaFinal', label: 'Existencia al final del ejercicio' },
]

export function CostoVentasView({
  datos: initialDatos,
  datosAnteriores,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  editarAnterior = false,
  conceptosExtra = [],
}: Props) {
  const datosIniciales = initialDatos ?? { id: '', ejercicioId, ...VACIO }
  const {
    valor: datos,
    editando,
    isPending,
    iniciarEdicion,
    cancelar,
    confirmar,
    actualizar,
  } = useEdicionLote(datosIniciales, (borrador) =>
    guardarTodoCostoVentasAction(ejercicioId, sociedadId, {
      existenciaInicial: borrador.existenciaInicial,
      compras: borrador.compras,
      gastosFabricacion: borrador.gastosFabricacion,
      existenciaFinal: borrador.existenciaFinal,
    }),
  )

  function guardarCampo(campo: keyof typeof VACIO, valor: number) {
    actualizar((prev) => ({ ...prev, [campo]: valor }))
  }

  // Columna "Ejercicio Anterior" — borrador independiente, propio Guardar/Cancelar.
  const entradasAnterior: ComparativoEntry[] = [
    ...CLAVES_FIJAS.map(({ clave, label }, i) => ({
      modulo: 'COSTO_VENTAS' as const,
      clave,
      label,
      valor: datosAnteriores?.[clave] ?? 0,
      orden: i,
    })),
    ...conceptosExtra.map((c) => ({
      modulo: 'COSTO_VENTAS' as const,
      clave: c.clave,
      label: c.label,
      valor: c.valor,
      esHuerfano: true,
      orden: c.orden,
    })),
  ]
  const comparativo = useComparativoLote(entradasAnterior, ejercicioId, sociedadId)
  const conceptosExtraActuales = Array.from(comparativo.entradas.values()).filter(
    (e) => e.esHuerfano,
  )

  const costoActual = calcularCostoTotal(datos)
  const sumaExtra = conceptosExtraActuales.reduce((acc, c) => acc + c.valor, 0)
  const costoAnteriorBase = datosAnteriores ? calcularCostoTotal(datosAnteriores) : null
  const costoAnterior =
    costoAnteriorBase !== null ? costoAnteriorBase + sumaExtra : sumaExtra !== 0 ? sumaExtra : null

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-xs text-slate-400">
          Los datos del ejercicio actual los sacás del balance de sumas y saldos del sistema
          contable. Los del ejercicio anterior, del balance anterior.
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          {editarAnterior && (
            <ToggleEditarAnterior
              editando={comparativo.editando}
              isPending={comparativo.isPending}
              onEditar={comparativo.iniciarEdicion}
              onGuardar={comparativo.confirmar}
              onCancelar={comparativo.cancelar}
            />
          )}
          <BotonEditar
            editando={editando}
            onEditar={iniciarEdicion}
            onGuardar={confirmar}
            onCancelar={cancelar}
            isPending={isPending}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800">
              <td
                colSpan={3}
                className="px-4 py-2.5 text-center text-xs font-bold tracking-widest text-slate-200 uppercase"
              >
                Anexo II — Costo de Ventas
              </td>
            </tr>
            {/* Columnas de fecha */}
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Concepto
              </th>
              <th className="w-44 px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {formatFecha(fechaCierre)}
              </th>
              <th className="w-44 px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {fechaCierreAnterior ? formatFecha(fechaCierreAnterior) : 'Ej. Anterior'}
              </th>
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td />
              <td className="px-4 py-1 text-right font-mono text-xs text-slate-400">$</td>
              <td className="px-4 py-1 text-right font-mono text-xs text-slate-400">$</td>
            </tr>
          </thead>
          <tbody className={cn(isPending && 'opacity-60')}>
            {CLAVES_FIJAS.map(({ clave, label }) => (
              <FilaDato
                key={clave}
                label={label}
                valor={datos[clave]}
                valorAnterior={
                  comparativo.entradas.get(clave)?.valor ?? datosAnteriores?.[clave] ?? null
                }
                esDeduccion={clave === 'existenciaFinal'}
                editando={editando}
                onSave={(v) => guardarCampo(clave, v)}
                editandoAnterior={editarAnterior && comparativo.editando}
                onSaveAnterior={(v) => comparativo.setValor(clave, v)}
              />
            ))}

            {/* Conceptos extra del período anterior (solo en modo edición manual) */}
            {conceptosExtraActuales.map((c) => (
              <tr key={c.clave} className="group border-b border-slate-100 hover:bg-slate-50/40">
                <td className="px-4 py-2.5 text-sm text-slate-700">
                  <span className="mr-2 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-600 uppercase">
                    solo anterior
                  </span>
                  {c.label}
                </td>
                <td className="w-44 px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums">
                  —
                </td>
                {comparativo.editando ? (
                  <td className="w-44 px-2 py-2">
                    <div className="flex items-center gap-1">
                      <CeldaNumero
                        value={c.valor}
                        editando
                        onSave={(v) => comparativo.setValor(c.clave, v)}
                      />
                      <EliminarFilaAnterior
                        ejercicioId={ejercicioId}
                        sociedadId={sociedadId}
                        modulo="COSTO_VENTAS"
                        clave={c.clave}
                        onDeleted={() => comparativo.quitar(c.clave)}
                      />
                    </div>
                  </td>
                ) : (
                  <td className="w-44 px-4 py-2.5 text-right font-mono text-sm text-slate-500 tabular-nums">
                    {formatCurrency(c.valor, { decimales: 2 })}
                  </td>
                )}
              </tr>
            ))}

            {/* Agregar concepto extra — solo en modo edición de la columna anterior */}
            {editarAnterior && comparativo.editando && (
              <tr>
                <td colSpan={3} className="px-4 py-2">
                  <AgregarFilaAnterior
                    ejercicioId={ejercicioId}
                    sociedadId={sociedadId}
                    modulo="COSTO_VENTAS"
                    ordenBase={conceptosExtraActuales.length}
                    texto="Agregar concepto del período anterior"
                    onAdded={(dto) =>
                      comparativo.agregar({
                        modulo: dto.modulo,
                        clave: dto.clave,
                        label: dto.label,
                        valor: dto.valor,
                        esHuerfano: true,
                        orden: dto.orden,
                      })
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-800">
              <td className="px-4 py-3 text-sm font-bold tracking-wide text-white uppercase">
                Costo de Mercaderías Vendidas
              </td>
              <td className="w-44 px-4 py-3 text-right font-mono text-sm font-bold text-white tabular-nums">
                {formatCurrency(costoActual, { decimales: 2 })}
              </td>
              <td className="w-44 px-4 py-3 text-right font-mono text-sm font-bold text-slate-300 tabular-nums">
                {costoAnterior !== null ? formatCurrency(costoAnterior, { decimales: 2 }) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Nota al pie */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">Este total se traslada automáticamente</strong> al EERR
          como “menos Costo de los bienes Vendidos y Servicios (Anexo II - Nota 10)” y a la Nota 10.
        </p>
      </div>
    </div>
  )
}
