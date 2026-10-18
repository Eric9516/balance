import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { DocumentoBalance as Doc, SeccionDocumento } from '../domain/types'
import { AnexoBienesUsoDoc, AnexoCostoVentasDoc, AnexoGastosDoc, columnasGastos } from './AnexosDoc'
import { CaratulaDoc } from './CaratulaDoc'
import { EERRDoc, SSPDoc } from './EstadosDoc'
import { FlujoDoc } from './FlujoDoc'
import { NotasDoc } from './NotasDoc'
import { PanelEstado } from './PanelEstado'
import { PatrimonioNetoDoc } from './PatrimonioNetoDoc'
import { AjusteAncho } from './AjusteAncho'
import { CajaPendiente, Hoja, MarcaAgua } from './piezas'

function Seccion({ seccion, doc }: { seccion: SeccionDocumento; doc: Doc }) {
  const { columnas } = doc
  switch (seccion.tipo) {
    case 'caratula':
      return (
        <Hoja doc={doc} encabezado={false} firmas={false}>
          <CaratulaDoc caratula={seccion.caratula} />
        </Hoja>
      )
    case 'ssp':
      return (
        <Hoja doc={doc}>
          <SSPDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'eerr':
      return (
        <Hoja doc={doc}>
          <EERRDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'eepn':
      return (
        <Hoja doc={doc} apaisada>
          <PatrimonioNetoDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'flujo':
      return (
        <Hoja doc={doc}>
          <FlujoDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'anexo-bienes-uso':
      return (
        <Hoja doc={doc} apaisada>
          <AnexoBienesUsoDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'anexo-costo-ventas':
      return (
        <Hoja doc={doc}>
          <AnexoCostoVentasDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'anexo-gastos':
      return (
        <Hoja doc={doc} apaisada={columnasGastos(seccion.anexo, columnas).length > 2}>
          <AnexoGastosDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'notas':
      return (
        <Hoja doc={doc}>
          <NotasDoc {...seccion} columnas={columnas} />
        </Hoja>
      )
    case 'pendiente':
      return (
        <Hoja doc={doc} firmas={false}>
          <CajaPendiente titulo={seccion.titulo} detalle={seccion.detalle} />
        </Hoja>
      )
  }
}

/**
 * Juego completo de estados contables. Componente de solo lectura: se usa en la
 * vista para imprimir y, más adelante, para generar el PDF en el servidor.
 */
export function DocumentoBalance({ doc, volverHref }: { doc: Doc; volverHref: string }) {
  return (
    <div className="documento">
      <AjusteAncho />
      <PanelEstado doc={doc} volverHref={volverHref} />
      {doc.borrador.es && <MarcaAgua texto={T.borrador.marca} />}
      {doc.secciones.map((seccion, i) => (
        <Seccion key={`${seccion.tipo}-${i}`} seccion={seccion} doc={doc} />
      ))}
    </div>
  )
}
