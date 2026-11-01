'use client'

import { useState } from 'react'
import {
  BotonVerCargado,
  TdCargado,
  ThCargado,
} from '@/modules/comparativo-manual/components/ColumnaCargado'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { guardarTodoCostoVentasAction } from '../actions/costo-ventas.actions'
import {
  CONCEPTOS_COSTO_VENTAS as CLAVES_FIJAS,
  COSTO_VENTAS_VACIO as VACIO,
  TOTAL_COSTO_VENTAS_LABEL,
  calcularCostoTotal,
  costoAnteriorConExtras,
  type CostoVentasDTO,
} from '../domain/types'
import {
  ToggleEditarAnterior,
  AgregarFilaAnterior,
  EliminarFilaAnterior,
  useComparativoLote,
  type ComparativoEntry,
} from '@/modules/comparativo-manual/components/CeldaAnteriorEditable'
import type { ComparativoManualDTO } from '@/modules/comparativo-manual/domain/types'
import { CeldaNumero } from '@/components/shared/CeldaNumero'
import { CeldaBloqueada } from '@/components/shared/CeldaBloqueada'
import { AvisosArrastre } from '@/components/shared/AvisosArrastre'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'

// ─── Encabezado de columna comparativa ───────────────────────────────────────
// Dos líneas: título en uppercase chico + fecha de cierre en mono (si la hay).

function EncabezadoEjercicio({
  titulo,
  fecha,
  atenuado = false,
}: {
  titulo: string
  fecha: Date | null
  atenuado?: boolean
}) {
  return (
    <th className="w-44 px-4 py-2.5 text-right align-bottom">
      <div
        className={cn(
          'text-xs font-semibold tracking-wide uppercase',
          atenuado ? 'text-slate-400' : 'text-slate-500',
        )}
      >
        {titulo}
      </div>
      {fecha && (
        <div className="font-mono text-[11px] font-normal text-slate-400 tabular-nums">
          {formatFecha(fecha)}
        </div>
      )}
    </th>
  )
}

// ─── Fila de datos ────────────────────────────────────────────────────────────

function FilaDato({
  label,
  valor,
  valorAnterior,
  esDeduccion = false,
  editando,
  onSave,
  // El valor viene arrastrado del ejercicio anterior vinculado: no se edita acá.
  bloqueado = false,
  // Columna "Ejercicio anterior"
  mostrarAnterior,
  editandoAnterior = false,
  onSaveAnterior,
  cargado,
}: {
  label: string
  valor: number
  valorAnterior: number | null
  esDeduccion?: boolean
  editando: boolean
  onSave: (v: number) => void
  bloqueado?: boolean
  mostrarAnterior: boolean
  editandoAnterior?: boolean
  onSaveAnterior?: (v: number) => void
  cargado?: number
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-acento-suave">
      <td className="px-4 py-2.5 text-sm text-slate-700">{label}</td>
      <td className="w-44 px-4 py-2.5">
        {bloqueado ? (
          <CeldaBloqueada value={valor} origen="ejercicio anterior" negativo={esDeduccion} />
        ) : (
          <CeldaNumero value={valor} editando={editando} onSave={onSave} negativo={esDeduccion} />
        )}
      </td>
      {mostrarAnterior &&
        (editandoAnterior && onSaveAnterior ? (
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
        ))}
      {cargado !== undefined && <TdCargado valor={cargado} />}
    </tr>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  datos: CostoVentasDTO | null
  datosAnteriores: CostoVentasDTO | null
  /** La existencia inicial viene de la existencia final del anterior vinculado (candado). */
  existenciaInicialBloqueada: boolean
  /** Valor que debe tener la existencia inicial (null = sin fuente en el anterior). */
  existenciaInicialDerivada: number | null
  /** Fuentes faltantes en el ejercicio anterior (filas que quedan editables). */
  advertencias: string[]
  /** Carga manual: existencia final del año anterior propuesta desde la nota de bienes de cambio. */
  existenciaFinalAnteriorPropuesta: number | null
  /** Si se muestra la columna "Ejercicio anterior" (modos VINCULADO y MANUAL). */
  mostrarAnterior: boolean
  /** Si la columna "Ejercicio anterior" se carga a mano (solo MANUAL). */
  editarAnterior: boolean
  conceptosExtra: ComparativoManualDTO[]
  ejercicioId: string
  sociedadId: string
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  /** Anterior manual ya ajustado: lo que se había cargado, para mostrarlo al lado. */
  cargado?: { anterior: CostoVentasDTO | null; conceptosExtra: ComparativoManualDTO[] } | null
}

// Conceptos fijos y total: fuente única con el documento imprimible (domain/types).

export function CostoVentasView({
  datos: initialDatos,
  datosAnteriores,
  existenciaInicialBloqueada,
  existenciaInicialDerivada,
  advertencias,
  existenciaFinalAnteriorPropuesta,
  mostrarAnterior,
  editarAnterior,
  conceptosExtra,
  ejercicioId,
  sociedadId,
  fechaCierre,
  fechaCierreAnterior,
  cargado = null,
}: Props) {
  const [verCargado, setVerCargado] = useState(false)
  const conCargado = verCargado && cargado !== null
  // Estado inicial del borrador. Si hay existencia inicial derivada del anterior, el
  // borrador la toma como valor (bloqueada, o sin Anexo II cargado todavía): el servidor
  // igual la fija al guardar.
  const base: CostoVentasDTO = initialDatos ?? { id: '', ejercicioId, ...VACIO }
  const datosIniciales: CostoVentasDTO =
    existenciaInicialDerivada !== null && (existenciaInicialBloqueada || initialDatos === null)
      ? { ...base, existenciaInicial: existenciaInicialDerivada }
      : base

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

  // Columna "Ejercicio anterior" en carga manual — borrador independiente, propio
  // Guardar/Cancelar. En los demás modos el hook queda inerte (no se renderiza su toggle).
  const entradasAnterior: ComparativoEntry[] = [
    ...CLAVES_FIJAS.map(({ clave, label }, i) => ({
      modulo: 'COSTO_VENTAS' as const,
      clave,
      label,
      // La existencia final sin cargar arranca con la propuesta desde la nota de bienes de cambio.
      valor:
        clave === 'existenciaFinal'
          ? datosAnteriores?.existenciaFinal || existenciaFinalAnteriorPropuesta || 0
          : (datosAnteriores?.[clave] ?? 0),
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
  const editandoAnterior = editarAnterior && comparativo.editando
  const conceptosExtraActuales = editarAnterior
    ? Array.from(comparativo.entradas.values()).filter((e) => e.esHuerfano)
    : []

  function valorAnteriorDe(clave: keyof typeof VACIO): number | null {
    return editarAnterior
      ? (comparativo.entradas.get(clave)?.valor ?? null)
      : (datosAnteriores?.[clave] ?? null)
  }

  const costoActual = calcularCostoTotal(datos)
  const costoAnterior = costoAnteriorConExtras(datosAnteriores, conceptosExtraActuales)

  const columnas = (mostrarAnterior ? 3 : 2) + (conCargado ? 1 : 0)

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-slate-400">
            Los datos del ejercicio actual los sacás del balance de sumas y saldos del sistema
            contable.
            {mostrarAnterior &&
              (editarAnterior
                ? ' Los del ejercicio anterior, del balance anterior.'
                : cargado
                  ? ' Los del ejercicio anterior se cargaron a mano y están ajustados por inflación.'
                  : ' Los del ejercicio anterior vienen del ejercicio vinculado.')}
          </p>
          <AvisosArrastre
            bloqueado={existenciaInicialBloqueada}
            origen={cargado ? 'lo cargado a mano, ajustado por inflación' : undefined}
            advertencias={advertencias}
          />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {cargado && (
            <BotonVerCargado visible={verCargado} onToggle={() => setVerCargado((v) => !v)} />
          )}
          {mostrarAnterior && editarAnterior && (
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
                colSpan={columnas}
                className="px-4 py-2.5 text-center text-xs font-bold tracking-widest text-slate-200 uppercase"
              >
                Anexo II — Costo de Ventas
              </td>
            </tr>
            {/* Columnas con fecha de cierre */}
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left align-bottom text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Concepto
              </th>
              <EncabezadoEjercicio titulo="Ejercicio actual" fecha={fechaCierre} />
              {mostrarAnterior && (
                <EncabezadoEjercicio
                  titulo="Ejercicio anterior"
                  fecha={fechaCierreAnterior}
                  atenuado
                />
              )}
              {conCargado && <ThCargado />}
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td />
              <td className="px-4 py-1 text-right font-mono text-xs text-slate-400">$</td>
              {mostrarAnterior && (
                <td className="px-4 py-1 text-right font-mono text-xs text-slate-400">$</td>
              )}
              {conCargado && <td className="bg-slate-100" />}
            </tr>
          </thead>
          <tbody className={cn(isPending && 'opacity-60')}>
            {CLAVES_FIJAS.map(({ clave, label }) => (
              <FilaDato
                key={clave}
                label={label}
                valor={datos[clave]}
                valorAnterior={valorAnteriorDe(clave)}
                esDeduccion={clave === 'existenciaFinal'}
                editando={editando}
                onSave={(v) => guardarCampo(clave, v)}
                bloqueado={clave === 'existenciaInicial' && existenciaInicialBloqueada}
                mostrarAnterior={mostrarAnterior}
                editandoAnterior={editandoAnterior}
                onSaveAnterior={(v) => comparativo.setValor(clave, v)}
                cargado={conCargado ? (cargado.anterior?.[clave] ?? 0) : undefined}
              />
            ))}

            {/* Conceptos extra del período anterior (solo en carga manual) */}
            {mostrarAnterior &&
              conceptosExtraActuales.map((c) => (
                <tr key={c.clave} className="group border-b border-slate-100 hover:bg-acento-suave">
                  <td className="px-4 py-2.5 text-sm text-slate-700">
                    <span className="mr-2 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-600 uppercase">
                      solo anterior
                    </span>
                    {c.label}
                  </td>
                  <td className="w-44 px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums">
                    —
                  </td>
                  {editandoAnterior ? (
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
                  {conCargado && (
                    <TdCargado
                      valor={cargado.conceptosExtra.find((x) => x.clave === c.clave)?.valor ?? 0}
                    />
                  )}
                </tr>
              ))}

            {/* Agregar concepto extra — solo en edición de la columna anterior */}
            {mostrarAnterior && editandoAnterior && (
              <tr>
                <td colSpan={columnas} className="px-4 py-2">
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
                {TOTAL_COSTO_VENTAS_LABEL}
              </td>
              <td className="w-44 px-4 py-3 text-right font-mono text-sm font-bold text-white tabular-nums">
                {formatCurrency(costoActual, { decimales: 2 })}
              </td>
              {mostrarAnterior && (
                <td className="w-44 px-4 py-3 text-right font-mono text-sm font-bold text-slate-300 tabular-nums">
                  {costoAnterior !== null ? formatCurrency(costoAnterior, { decimales: 2 }) : '—'}
                </td>
              )}
              {conCargado && (
                <TdCargado
                  valor={costoAnteriorConExtras(cargado.anterior, cargado.conceptosExtra)}
                  fuerte
                  oscuro
                />
              )}
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
