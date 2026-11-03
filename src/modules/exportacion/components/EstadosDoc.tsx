import { Fragment } from 'react'
import type { EstadosData } from '@/modules/estados/domain/types'
import type { LineaEERR } from '@/modules/estados/domain/lineasEERR'
import {
  SECCIONES_PASIVO,
  SSP_STRUCTURE,
  patrimonioNetoSSP,
  rubrosDeSeccion,
  sumarSeccion,
  sumarSecciones,
} from '@/modules/estados/domain/estructuraSSP'
import { esRubroHuerfano } from '@/modules/estados/lib/rubroHuerfano'
import { SECCION_SSP_LABELS, esSeccionSSP } from '@/modules/rubros-base/domain/secciones'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { ColumnasDocumento } from '../domain/types'
import { EncabezadoColumnas, Importe, TituloSeccion } from './piezas'
import { sumar } from '@/lib/importe'

// ─── Estado de Situación Patrimonial ─────────────────────────────────────────

function FilaImportes({
  label,
  actual,
  anterior,
  columnas,
  clase,
  sangria = false,
  nota = null,
}: {
  label: string
  actual: number | null
  anterior: number | null
  columnas: ColumnasDocumento
  clase?: string
  sangria?: boolean
  nota?: number | null
}) {
  return (
    <tr className={clase}>
      <td className={sangria ? 'sangria' : undefined}>
        {label}
        {nota != null && <span className="nota-ref"> (Nota {nota})</span>}
      </td>
      <Importe valor={actual} />
      {columnas.mostrarAnterior && <Importe valor={anterior} />}
    </tr>
  )
}

export function SSPDoc({
  titulo,
  subtitulo,
  estados,
  columnas,
}: {
  titulo: string
  subtitulo: string
  estados: EstadosData
  columnas: ColumnasDocumento
}) {
  const { sspRubros, patrimonioNetoFinal, patrimonioNetoFinalAnt } = estados
  const colSpan = columnas.mostrarAnterior ? 3 : 2
  const pn = patrimonioNetoSSP(sspRubros, patrimonioNetoFinal, 'actual')
  const pnAnt = patrimonioNetoSSP(sspRubros, patrimonioNetoFinalAnt, 'anterior')
  const huerfanos = sspRubros.filter(
    (r) => r.seccionSSP === null && (r.displayValueAnt !== 0 || esRubroHuerfano(r.id)),
  )

  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className="doc-tabla">
        <thead>
          <EncabezadoColumnas columnas={columnas} />
        </thead>
        <tbody>
          {SSP_STRUCTURE.map(({ bloque, sections, totalLabel }) => {
            const esPN = bloque === 'PATRIMONIO NETO'
            if (!esPN && !sections.some((s) => rubrosDeSeccion(sspRubros, s).length > 0)) {
              return null
            }
            return (
              <Fragment key={bloque}>
                <tr className="fila-bloque">
                  <td colSpan={colSpan}>{bloque}</td>
                </tr>
                {/* El PN no abre rubros: el detalle está en el E.E.P.N. */}
                {!esPN &&
                  sections.map((seccion) => {
                    const rubros = rubrosDeSeccion(sspRubros, seccion)
                    if (rubros.length === 0) return null
                    const label = esSeccionSSP(seccion) ? SECCION_SSP_LABELS[seccion] : seccion
                    const conSubtitulo = sections.length > 1
                    return (
                      <Fragment key={seccion}>
                        {conSubtitulo && (
                          <tr className="fila-seccion">
                            <td colSpan={colSpan}>{label}</td>
                          </tr>
                        )}
                        {rubros.map((r) => (
                          <FilaImportes
                            key={r.id}
                            label={r.nombre}
                            actual={esRubroHuerfano(r.id) || r.notaFila ? null : r.displayValue}
                            anterior={r.displayValueAnt}
                            columnas={columnas}
                            nota={r.notaNumero}
                            sangria
                          />
                        ))}
                        {conSubtitulo && (
                          <FilaImportes
                            label={T.ssp.subtotal(label)}
                            actual={sumarSeccion(sspRubros, seccion, 'actual')}
                            anterior={sumarSeccion(sspRubros, seccion, 'anterior')}
                            columnas={columnas}
                            clase="fila-subtotal"
                          />
                        )}
                      </Fragment>
                    )
                  })}
                {esPN && (
                  <FilaImportes
                    label={`${T.ssp.patrimonioNeto} ${T.ssp.verEEPN}`}
                    actual={pn}
                    anterior={pnAnt}
                    columnas={columnas}
                    sangria
                  />
                )}
                <FilaImportes
                  label={totalLabel}
                  actual={esPN ? pn : sumarSecciones(sspRubros, sections, 'actual')}
                  anterior={esPN ? pnAnt : sumarSecciones(sspRubros, sections, 'anterior')}
                  columnas={columnas}
                  clase="fila-total"
                />
              </Fragment>
            )
          })}
          {huerfanos.length > 0 && (
            <>
              <tr className="fila-seccion">
                <td colSpan={colSpan}>{T.ssp.delPeriodoAnterior}</td>
              </tr>
              {huerfanos.map((r) => (
                <FilaImportes
                  key={r.id}
                  label={r.nombre}
                  actual={null}
                  anterior={r.displayValueAnt}
                  columnas={columnas}
                  sangria
                />
              ))}
            </>
          )}
        </tbody>
        <tfoot>
          <FilaImportes
            label={T.ssp.totalPasivoPN}
            actual={sumar(sumarSecciones(sspRubros, SECCIONES_PASIVO, 'actual'), pn)}
            anterior={sumar(sumarSecciones(sspRubros, SECCIONES_PASIVO, 'anterior'), pnAnt)}
            columnas={columnas}
            clase="fila-final"
          />
        </tfoot>
      </table>
    </>
  )
}

// ─── Estado de Resultados ────────────────────────────────────────────────────

const CLASE_LINEA: Record<LineaEERR['tipo'], string | undefined> = {
  linea: undefined,
  subtotal: 'fila-subtotal',
  final: 'fila-final',
}

export function EERRDoc({
  titulo,
  subtitulo,
  lineas,
  columnas,
}: {
  titulo: string
  subtitulo: string
  lineas: LineaEERR[]
  columnas: ColumnasDocumento
}) {
  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className="doc-tabla">
        <thead>
          <EncabezadoColumnas columnas={columnas} />
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.clave} className={CLASE_LINEA[l.tipo]}>
              <td className={l.tipo === 'linea' ? 'sangria' : undefined}>
                {l.etiqueta}
                {l.notaNumero != null && <span className="nota-ref"> (Nota {l.notaNumero})</span>}
              </td>
              <Importe valor={esRubroHuerfano(l.clave) ? null : l.valor} negativo={l.deduccion} />
              {columnas.mostrarAnterior && <Importe valor={l.valorAnt} negativo={l.deduccion} />}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
