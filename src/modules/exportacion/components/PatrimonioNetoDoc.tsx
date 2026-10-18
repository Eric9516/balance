import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { COLUMNAS_PN, GRUPOS_PN, valorColumnaPN } from '@/modules/patrimonio-neto/domain/columnas'
import {
  TIPOS_INICIO_MODIFICADO,
  saldoCierrePN,
  saldoInicioModificadoPN,
} from '@/modules/patrimonio-neto/domain/evolucion'
import {
  PN_MOVIMIENTOS,
  totalMovimientoPN,
  type EvolucionPNData,
  type EvolucionPNMovimientoDTO,
} from '@/modules/patrimonio-neto/domain/types'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { ColumnasDocumento } from '../domain/types'
import { Importe, ThEjercicio, TituloSeccion } from './piezas'

/** Estado de Evolución del Patrimonio Neto (hoja apaisada). */
export function PatrimonioNetoDoc({
  titulo,
  subtitulo,
  pn,
  columnas,
}: {
  titulo: string
  subtitulo: string
  pn: EvolucionPNData
  columnas: ColumnasDocumento
}) {
  const { movimientos } = pn
  const byTipo = new Map(movimientos.map((m) => [m.tipo, m]))
  const columnasPN = GRUPOS_PN.flatMap((g) => COLUMNAS_PN[g].columnas)
  const totalColumnas = 1 + columnasPN.length + (columnas.mostrarAnterior ? 2 : 1)
  const esInicio = (tipo: EvolucionPNMovimientoDTO['tipo']) =>
    TIPOS_INICIO_MODIFICADO.includes(tipo)

  function celdas(mov: EvolucionPNMovimientoDTO) {
    return (
      <>
        {columnasPN.map((col, i) => (
          <Importe
            key={i}
            valor={valorColumnaPN(col, mov)}
            className={cn(col.tipo === 'subtotal' && 'font-semibold')}
          />
        ))}
        <Importe valor={totalMovimientoPN(mov)} className="font-semibold" />
        {columnas.mostrarAnterior && <Importe valor={mov.totalAnterior} />}
      </>
    )
  }

  function filaMovimiento(tipo: EvolucionPNMovimientoDTO['tipo'], label: string) {
    const mov = byTipo.get(tipo)
    if (!mov) return null
    return (
      <tr key={tipo}>
        <td className="sangria">{label}</td>
        {celdas(mov)}
      </tr>
    )
  }

  function filaDerivada(label: string, mov: EvolucionPNMovimientoDTO, clase: string) {
    return (
      <tr className={clase}>
        <td>{label}</td>
        {celdas(mov)}
      </tr>
    )
  }

  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <table className="doc-tabla text-[8pt]">
        <thead>
          <tr>
            <th rowSpan={2} className="izq align-bottom">
              {T.eepn.rubros}
            </th>
            {GRUPOS_PN.map((g) => (
              <th key={g} colSpan={COLUMNAS_PN[g].columnas.length} className="text-center">
                {COLUMNAS_PN[g].titulo}
              </th>
            ))}
            <th colSpan={columnas.mostrarAnterior ? 2 : 1} className="text-center">
              {T.eepn.patrimonioNeto}
            </th>
          </tr>
          <tr>
            {columnasPN.map((col, i) => (
              <th key={i}>{col.label}</th>
            ))}
            <ThEjercicio columnas={columnas} cual="actual" />
            {columnas.mostrarAnterior && <ThEjercicio columnas={columnas} cual="anterior" />}
          </tr>
        </thead>
        <tbody>
          {PN_MOVIMIENTOS.filter((m) => esInicio(m.tipo)).map((m) => (
            <Fragment key={m.tipo}>{filaMovimiento(m.tipo, m.label)}</Fragment>
          ))}
          {filaDerivada(
            T.eepn.inicioModificado,
            saldoInicioModificadoPN(movimientos),
            'fila-subtotal',
          )}
          <tr className="fila-seccion">
            <td colSpan={totalColumnas}>{T.eepn.distribucion}</td>
          </tr>
          {PN_MOVIMIENTOS.filter((m) => !esInicio(m.tipo)).map((m) => (
            <Fragment key={m.tipo}>{filaMovimiento(m.tipo, m.label)}</Fragment>
          ))}
        </tbody>
        <tfoot>{filaDerivada(T.eepn.cierre, saldoCierrePN(movimientos), 'fila-final')}</tfoot>
      </table>
    </>
  )
}
