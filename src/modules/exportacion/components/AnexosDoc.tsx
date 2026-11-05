import { cn } from '@/lib/utils'
import type { ResultadoArrastreBDU } from '@/modules/bienes-de-uso/domain/saldosInicio'
import {
  COLUMNAS_BDU,
  GRUPOS_BDU,
  totalColumnaBDU,
  valorColumnaBDU,
} from '@/modules/bienes-de-uso/domain/columnas'
import { calcularCierre } from '@/modules/bienes-de-uso/domain/types'
import {
  CONCEPTOS_COSTO_VENTAS,
  TOTAL_COSTO_VENTAS_LABEL,
  calcularCostoTotal,
  costoAnteriorConExtras,
} from '@/modules/costo-ventas/domain/types'
import { esSeccionHuerfana } from '@/modules/gastos/lib/seccionHuerfana'
import type { GastosSecciones } from '@/modules/gastos/repository/gastos-dinamico.repository'
import { filasAnexoGastos } from '@/modules/gastos/domain/filasAnexo'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { AnexoCostoVentas, ColumnasDocumento } from '../domain/types'
import { EncabezadoColumnas, Importe, ThEjercicio, TituloSeccion } from './piezas'
import { sumar, sumarPor } from '@/lib/importe'

type Props<A> = { titulo: string; subtitulo: string; anexo: A; columnas: ColumnasDocumento }

// ─── Anexo I: Bienes de uso (apaisado) ───────────────────────────────────────
// Dos bloques, uno debajo del otro: "Valor de origen" y "Amortizaciones acumuladas"
// con el neto residual. Así ningún bloque pasa de siete columnas de importes y la
// tabla entra en la hoja aunque los importes sean largos.

export function AnexoBienesUsoDoc({
  titulo,
  subtitulo,
  anexo,
  columnas,
}: Props<ResultadoArrastreBDU>) {
  const { bienes, netoAnteriorMap } = anexo
  const totalNeto = sumarPor(bienes, (b) => calcularCierre(b).netoResidual)
  const hayNetoAnterior = netoAnteriorMap.size > 0
  const totalNetoAnterior = sumar(...netoAnteriorMap.values())

  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      {GRUPOS_BDU.map((grupo, indice) => {
        const { titulo: tituloGrupo, columnas: cols } = COLUMNAS_BDU[grupo]
        const conNeto = grupo === 'amortizaciones'
        const conNetoAnterior = conNeto && columnas.mostrarAnterior
        return (
          <table key={grupo} className={cn('doc-tabla ancha', indice > 0 && 'mt-5')}>
            <thead>
              <tr>
                <th rowSpan={2} className="izq align-bottom">
                  {T.anexos.rubros}
                </th>
                <th colSpan={cols.length} className="centro">
                  {tituloGrupo}
                </th>
                {conNeto && (
                  <th colSpan={columnas.mostrarAnterior ? 2 : 1} className="centro">
                    {T.anexos.netoResidual}
                  </th>
                )}
              </tr>
              <tr>
                {cols.map((col, i) => (
                  <th key={i}>{col.label}</th>
                ))}
                {conNeto && <ThEjercicio columnas={columnas} cual="actual" />}
                {conNetoAnterior && <ThEjercicio columnas={columnas} cual="anterior" />}
              </tr>
            </thead>
            <tbody>
              {bienes.map((bien) => (
                <tr key={bien.id}>
                  <td>{bien.categoria}</td>
                  {cols.map((col, i) => (
                    <Importe
                      key={i}
                      valor={valorColumnaBDU(col, bien)}
                      negativo={col.tipo === 'campo' && col.negativo}
                      className={cn(col.tipo === 'calc' && 'font-semibold')}
                    />
                  ))}
                  {conNeto && (
                    <Importe valor={calcularCierre(bien).netoResidual} className="font-semibold" />
                  )}
                  {conNetoAnterior && (
                    <Importe valor={netoAnteriorMap.get(bien.categoria) ?? null} />
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fila-final">
                <td>{T.anexos.totales}</td>
                {cols.map((col, i) => (
                  <Importe
                    key={i}
                    valor={totalColumnaBDU(col, bienes)}
                    negativo={col.tipo === 'campo' && col.negativo}
                  />
                ))}
                {conNeto && <Importe valor={totalNeto} />}
                {conNetoAnterior && <Importe valor={hayNetoAnterior ? totalNetoAnterior : null} />}
              </tr>
            </tfoot>
          </table>
        )
      })}
    </>
  )
}

// ─── Anexo II: Costo de ventas ───────────────────────────────────────────────

export function AnexoCostoVentasDoc({
  titulo,
  subtitulo,
  anexo,
  columnas,
}: Props<AnexoCostoVentas>) {
  const { datos, datosAnteriores, conceptosExtra } = anexo
  if (!datos) return null
  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className="doc-tabla mx-auto max-w-[150mm]">
        <thead>
          <EncabezadoColumnas columnas={columnas} />
        </thead>
        <tbody>
          {CONCEPTOS_COSTO_VENTAS.map(({ clave, label }) => (
            <tr key={clave}>
              <td className="sangria">{label}</td>
              <Importe valor={datos[clave]} negativo={clave === 'existenciaFinal'} />
              {columnas.mostrarAnterior && (
                <Importe
                  valor={datosAnteriores?.[clave] ?? null}
                  negativo={clave === 'existenciaFinal'}
                />
              )}
            </tr>
          ))}
          {columnas.mostrarAnterior &&
            conceptosExtra.map((c) => (
              <tr key={c.clave}>
                <td className="sangria">{c.label}</td>
                <Importe valor={null} />
                <Importe valor={c.valor} />
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="fila-final">
            <td>{TOTAL_COSTO_VENTAS_LABEL}</td>
            <Importe valor={calcularCostoTotal(datos)} />
            {columnas.mostrarAnterior && (
              <Importe valor={costoAnteriorConExtras(datosAnteriores, conceptosExtra)} />
            )}
          </tr>
        </tfoot>
      </table>
    </>
  )
}

// ─── Anexo III: Gastos ───────────────────────────────────────────────────────

/** Columnas del anexo: las secciones de gasto por defecto; en carga manual, también las huérfanas. */
export function columnasGastos(anexo: GastosSecciones, columnas: ColumnasDocumento) {
  const regulares = anexo.secciones.filter((s) => s.esGastoDefault && !esSeccionHuerfana(s.key))
  const huerfanas =
    columnas.mostrarAnterior && columnas.anteriorManual
      ? anexo.secciones.filter((s) => esSeccionHuerfana(s.key))
      : []
  return [...regulares, ...huerfanas]
}

export function AnexoGastosDoc({ titulo, subtitulo, anexo, columnas }: Props<GastosSecciones>) {
  const cols = columnasGastos(anexo, columnas)
  // Mismas filas que la pantalla (regla única). Como el modelo de la RT 54, el ejercicio anterior va
  // en una columna fila por fila, también cuando se cargó a mano.
  const filas = filasAnexoGastos(
    cols,
    columnas.anteriorManual ? (anexo.anteriorManualPorFila ?? []) : null,
  ).filter((f) => columnas.mostrarAnterior || !f.soloAnterior)
  const anteriorPorFila = columnas.mostrarAnterior
  const totalActual = sumarPor(cols, (s) => s.total)
  const totalAnteriorPorSeccion = sumarPor(cols, (s) => s.totalAnterior)
  const totalColumnaAnterior = columnas.anteriorManual
    ? sumarPor(filas, (f) => f.totalAnterior)
    : totalAnteriorPorSeccion
  const columnasImporte = cols.length + 1 + (anteriorPorFila ? 1 : 0)

  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className={cn('doc-tabla', columnasImporte >= 6 ? 'ancha' : 'media')}>
        <thead>
          <tr>
            <th className="izq">{T.anexos.rubros}</th>
            {cols.map((s) => (
              <th key={s.key}>
                {esSeccionHuerfana(s.key) && <div className="fecha">{T.anexos.soloAnterior}</div>}
                {s.grupoNombre}
              </th>
            ))}
            <ThEjercicio columnas={columnas} cual="actual" />
            {anteriorPorFila && <ThEjercicio columnas={columnas} cual="anterior" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave}>
              <td>
                {fila.soloAnterior && <div className="fecha">{T.anexos.soloAnterior}</div>}
                {fila.nombre}
              </td>
              {cols.map((s) => (
                <Importe key={s.key} valor={fila.importes[s.key] ?? 0} />
              ))}
              <Importe
                valor={fila.soloAnterior ? null : fila.totalActual}
                className="font-semibold"
              />
              {anteriorPorFila && <Importe valor={fila.totalAnterior} />}
            </tr>
          ))}
        </tbody>
        {/* Como el modelo tradicional: las dos filas de totales por sección, y a la derecha el total
            de cada ejercicio en una caja que ocupa las dos filas (corrección del cliente, 2026-11-04). */}
        <tfoot>
          <tr className={anteriorPorFila ? 'fila-total' : 'fila-final'}>
            <td>{T.anexos.totalActual}</td>
            {cols.map((s) => (
              <Importe key={s.key} valor={esSeccionHuerfana(s.key) ? null : s.total} />
            ))}
            <Importe
              valor={totalActual}
              className={anteriorPorFila ? 'total-ejercicio' : undefined}
              rowSpan={anteriorPorFila ? 2 : undefined}
            />
            {anteriorPorFila && (
              <Importe valor={totalColumnaAnterior} className="total-ejercicio" rowSpan={2} />
            )}
          </tr>
          {anteriorPorFila && (
            <tr className="fila-final">
              <td>{T.anexos.totalAnterior}</td>
              {cols.map((s) => (
                <Importe key={s.key} valor={s.totalAnterior} />
              ))}
            </tr>
          )}
        </tfoot>
      </table>
    </>
  )
}
