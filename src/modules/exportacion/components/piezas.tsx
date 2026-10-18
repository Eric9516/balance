import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type {
  ColumnasDocumento,
  DocumentoBalance,
  EncabezadoDocumento,
  FirmasDocumento,
} from '../domain/types'

// ─── Importes ─────────────────────────────────────────────────────────────────

/** Formato argentino; cero y "sin dato" como guion; deducción entre paréntesis. */
export function importeTexto(valor: number | null, negativo = false): string {
  if (valor === null || valor === 0) return '—'
  return negativo ? `(${formatCurrency(Math.abs(valor))})` : formatCurrency(valor)
}

export function Importe({
  valor,
  negativo = false,
  className,
}: {
  valor: number | null
  negativo?: boolean
  className?: string
}) {
  return <td className={cn('num', className)}>{importeTexto(valor, negativo)}</td>
}

// ─── Encabezados de tabla y de sección ───────────────────────────────────────

/** "Ejercicio actual / anterior" con su fecha de cierre. */
export function ThEjercicio({
  columnas,
  cual,
  className,
}: {
  columnas: ColumnasDocumento
  cual: 'actual' | 'anterior'
  className?: string
}) {
  const fecha = cual === 'actual' ? columnas.fechaCierre : columnas.fechaCierreAnterior
  return (
    <th className={className}>
      <div>{T.columnas[cual]}</div>
      <div className="fecha">{formatFecha(fecha)}</div>
    </th>
  )
}

/** Fila de encabezado estándar: Concepto | Ejercicio actual | Ejercicio anterior. */
export function EncabezadoColumnas({
  columnas,
  concepto = T.columnas.concepto,
}: {
  columnas: ColumnasDocumento
  concepto?: string
}) {
  return (
    <tr>
      <th className="izq">{concepto}</th>
      <ThEjercicio columnas={columnas} cual="actual" />
      {columnas.mostrarAnterior && <ThEjercicio columnas={columnas} cual="anterior" />}
    </tr>
  )
}

export function TituloSeccion({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="mb-3 text-center">
      <h2 className="font-serif text-[13pt] font-semibold tracking-wide text-tinta uppercase">
        {titulo}
      </h2>
      {subtitulo && <p className="mt-0.5 text-[9pt] text-tinta-suave">{subtitulo}</p>}
    </header>
  )
}

export function FilaTitulo({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr className="fila-seccion">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  )
}

// ─── Hoja: encabezado y pie repetidos por página ─────────────────────────────

function EncabezadoHoja({ encabezado }: { encabezado: EncabezadoDocumento }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-6 border-b border-tinta pb-1 text-[8.5pt]">
      <div>
        <div className="font-serif text-[11pt] font-semibold text-tinta uppercase">
          {encabezado.razonSocial}
        </div>
        <div className="text-tinta-suave">CUIT {encabezado.cuit}</div>
      </div>
      <div className="text-right">
        <div>{encabezado.linea}</div>
        <div className="text-tinta-suave">{encabezado.leyendaMoneda}</div>
      </div>
    </div>
  )
}

export function PieFirmas({ firmas }: { firmas: FirmasDocumento }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-16 pt-2 text-center text-[8.5pt] leading-tight">
      <div className="pt-1">
        <div className="mx-auto w-56 border-t border-tinta pt-1 font-semibold">
          {firmas.representante.rol}
        </div>
      </div>
      <div className="pt-1">
        <div className="mx-auto w-64 border-t border-tinta pt-1">
          {firmas.auditor ? (
            <>
              {firmas.auditor.lineas.map((linea, i) => (
                <div key={i} className={cn(i === 0 && 'font-semibold')}>
                  {linea}
                </div>
              ))}
              <div className="mt-1 text-[7.5pt] text-tinta-suave italic">
                {firmas.auditor.leyenda}
              </div>
            </>
          ) : (
            <div className="text-tinta-suave">Auditor</div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Una hoja del juego. El encabezado va en <thead> y las firmas en <tfoot> para que
 * el navegador los repita en cada página impresa cuando la sección es larga.
 */
export function Hoja({
  doc,
  apaisada = false,
  encabezado = true,
  firmas = true,
  children,
}: {
  doc: DocumentoBalance
  apaisada?: boolean
  encabezado?: boolean
  firmas?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn('hoja', apaisada && 'hoja-apaisada')}>
      <table className="hoja-tabla">
        {encabezado && (
          <thead>
            <tr>
              <td>
                <EncabezadoHoja encabezado={doc.encabezado} />
              </td>
            </tr>
          </thead>
        )}
        <tbody>
          <tr>
            <td>{children}</td>
          </tr>
        </tbody>
        {firmas && (
          <tfoot>
            <tr>
              <td>
                <PieFirmas firmas={doc.firmas} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  )
}

export function MarcaAgua({ texto }: { texto: string }) {
  return (
    <div className="marca-agua" aria-hidden="true">
      <span>{texto}</span>
    </div>
  )
}

export function CajaPendiente({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="pendiente">
      <div className="font-semibold text-tinta">{titulo}</div>
      <div className="mt-1 text-[9pt]">{detalle}</div>
    </div>
  )
}
