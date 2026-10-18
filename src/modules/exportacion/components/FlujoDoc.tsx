import { Fragment } from 'react'
import type { FlujoData } from '@/modules/flujo-efectivo/domain/calculo'
import {
  SECCION_FLUJO_LABELS,
  SECCION_FLUJO_SUBTOTAL,
  SECCIONES_FLUJO,
  TEXTOS_FLUJO,
} from '@/modules/flujo-efectivo/domain/types'
import type { ColumnasDocumento } from '../domain/types'
import { EncabezadoColumnas, FilaTitulo, Importe, TituloSeccion } from './piezas'

/** Estado de Flujo de Efectivo (método directo): mismas filas que la pantalla. */
export function FlujoDoc({
  titulo,
  subtitulo,
  flujo,
  columnas,
}: {
  titulo: string
  subtitulo: string
  flujo: FlujoData
  columnas: ColumnasDocumento
}) {
  const { guardado, actual, anterior } = flujo
  const colSpan = columnas.mostrarAnterior ? 3 : 2

  function fila(label: string, valor: number, valorAnt: number | undefined, clase?: string) {
    return (
      <tr className={clase}>
        <td className={clase ? undefined : 'sangria'}>{label}</td>
        <Importe valor={valor} />
        {columnas.mostrarAnterior && <Importe valor={valorAnt ?? null} />}
      </tr>
    )
  }

  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className="doc-tabla">
        <thead>
          <EncabezadoColumnas columnas={columnas} />
        </thead>
        <tbody>
          <FilaTitulo colSpan={colSpan}>{TEXTOS_FLUJO.variaciones}</FilaTitulo>
          {fila(TEXTOS_FLUJO.efectivoInicio, guardado.saldoInicial, guardado.saldoInicialAnterior)}
          {fila(
            TEXTOS_FLUJO.modificaciones,
            guardado.modificacionesEjAnt,
            guardado.modificacionesEjAntAnt,
          )}
          {fila(
            TEXTOS_FLUJO.efectivoInicioModificado,
            actual.efectivoInicioModificado,
            anterior?.efectivoInicioModificado,
            'fila-subtotal',
          )}
          {fila(TEXTOS_FLUJO.efectivoCierre, guardado.saldoFinal, guardado.saldoFinalAnterior)}
          {fila(
            TEXTOS_FLUJO.variacionNeta,
            actual.variacionNeta,
            anterior?.variacionNeta,
            'fila-total',
          )}

          <FilaTitulo colSpan={colSpan}>{TEXTOS_FLUJO.causas}</FilaTitulo>
          {SECCIONES_FLUJO.map((seccion) => (
            <Fragment key={seccion}>
              <tr>
                <td colSpan={colSpan} className="pt-2 font-semibold">
                  {SECCION_FLUJO_LABELS[seccion]}
                </td>
              </tr>
              {guardado.items
                .filter((i) => i.seccion === seccion)
                .map((i) => (
                  <tr key={i.id}>
                    <td className="sangria">{i.concepto}</td>
                    <Importe valor={i.importe} />
                    {columnas.mostrarAnterior && <Importe valor={i.importeAnterior} />}
                  </tr>
                ))}
              {fila(
                SECCION_FLUJO_SUBTOTAL[seccion],
                actual.porSeccion[seccion],
                anterior?.porSeccion[seccion],
                'fila-subtotal',
              )}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          {fila(
            TEXTOS_FLUJO.variacionNeta,
            actual.sumaActividades,
            anterior?.sumaActividades,
            'fila-final',
          )}
        </tfoot>
      </table>
    </>
  )
}
