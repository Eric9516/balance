import { totalesNota, type NotaDTO } from '@/modules/notas/domain/types'
import type {
  FilaConciliacion,
  NotaTransicionGenerada,
} from '@/modules/transicion-rt54/lib/generarNota'
import { TEXTOS_DOCUMENTO as T } from '../domain/textos'
import type { ColumnasDocumento } from '../domain/types'
import { bloquesTextoNota } from '@/modules/notas/domain/textoNota'
import { EncabezadoColumnas, Importe, TituloSeccion } from './piezas'

function TablaConciliacion({ titulo, filas }: { titulo: string; filas: FilaConciliacion[] }) {
  if (filas.length === 0) return null
  return (
    <table className="doc-tabla mt-3">
      <thead>
        <tr>
          <th className="izq">{titulo}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className={f.esTotal ? 'fila-total' : undefined}>
            <td className={f.esBase || f.esTotal ? undefined : 'sangria'}>{f.concepto}</td>
            <Importe valor={f.importe} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Nota 1: texto por párrafos (los "1.2. Título" en negrita) y, si va, la transición. */
function NotaUnoDoc({
  notaUno,
}: {
  notaUno: {
    titulo: string
    texto: string
    transicion: { apartado: string; nota: NotaTransicionGenerada } | null
  }
}) {
  const t = notaUno.transicion?.nota
  return (
    <article className="mb-6">
      <h3 className="text-[10pt] font-bold">
        {T.notas.numero(1)}: <span className="uppercase">{notaUno.titulo}</span>
      </h3>
      {bloquesTextoNota(notaUno.texto).map((b, i) =>
        b.titulo ? (
          <p key={i} className="mt-3 text-[9.5pt] font-bold">
            {b.texto}
          </p>
        ) : (
          <p key={i} className="mt-2 text-justify text-[9.5pt] whitespace-pre-line">
            {b.texto}
          </p>
        ),
      )}
      {t && (
        <div className="break-inside-avoid">
          <TablaConciliacion titulo={T.notas.conciliacionPN} filas={t.conciliacionPN} />
          <TablaConciliacion
            titulo={T.notas.conciliacionResultado}
            filas={t.conciliacionResultado}
          />
          {t.reclasificaciones.length > 0 && (
            <table className="doc-tabla mt-3">
              <thead>
                <tr>
                  <th className="izq">{T.notas.reclasificaciones}</th>
                  <th className="izq">Rubros</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {t.reclasificaciones.map((r, i) => (
                  <tr key={i}>
                    <td>{r.concepto}</td>
                    <td>{r.origen && r.destino ? `${r.origen} → ${r.destino}` : ''}</td>
                    <Importe valor={r.importe} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
  )
}

function NotaDoc({ nota, columnas }: { nota: NotaDTO; columnas: ColumnasDocumento }) {
  const filas = nota.detalles.filter((d) => !d.esTotal)
  const totales = totalesNota(nota)
  return (
    <article className="mb-5 break-inside-avoid">
      <h3 className="text-[10pt] font-bold">
        {T.notas.numero(nota.numero)}: <span className="uppercase">{nota.titulo}</span>
      </h3>
      {nota.criterioMedicion && (
        <p className="text-[9pt] text-tinta-suave">
          {T.notas.criterio} {nota.criterioMedicion}
        </p>
      )}
      {nota.textoApertura && (
        <p className="mt-1 text-justify text-[9.5pt] whitespace-pre-line">{nota.textoApertura}</p>
      )}
      {filas.length > 0 && (
        <table className="doc-tabla mt-2">
          <thead>
            <EncabezadoColumnas columnas={columnas} concepto="" />
          </thead>
          <tbody>
            {filas.map((d) => (
              <tr key={d.id}>
                <td className="sangria">{d.concepto}</td>
                <Importe valor={d.importeActual} />
                {columnas.mostrarAnterior && <Importe valor={d.importeAnterior} />}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fila-total">
              <td>{T.notas.total}</td>
              <Importe valor={totales.actual} />
              {columnas.mostrarAnterior && <Importe valor={totales.anterior} />}
            </tr>
          </tfoot>
        </table>
      )}
    </article>
  )
}

export function NotasDoc({
  titulo,
  subtitulo,
  notaUno,
  notas,
  columnas,
}: {
  titulo: string
  subtitulo: string
  notaUno: {
    titulo: string
    texto: string
    transicion: { apartado: string; nota: NotaTransicionGenerada } | null
  }
  notas: NotaDTO[]
  columnas: ColumnasDocumento
}) {
  return (
    <>
      <TituloSeccion titulo={titulo} subtitulo={subtitulo} />
      <NotaUnoDoc notaUno={notaUno} />
      {notas.map((nota) => (
        <NotaDoc key={nota.id} nota={nota} columnas={columnas} />
      ))}
    </>
  )
}
