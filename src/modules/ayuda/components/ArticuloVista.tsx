import type React from 'react'
import { AlertTriangle, ArrowLeft, Calculator, Database, Lightbulb, Target } from 'lucide-react'
import { ARTICULO_POR_ID, resumenDePaso } from '../contenido'
import { CATEGORIAS_AYUDA, type ArticuloAyuda, type BloqueAyuda } from '../domain/tipos'

function Bloque({ bloque }: { bloque: BloqueAyuda }) {
  switch (bloque.tipo) {
    case 'parrafo':
      return <p className="text-sm leading-relaxed text-slate-700">{bloque.texto}</p>
    case 'pasos':
      return (
        <ol className="space-y-2">
          {bloque.items.map((item, i) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'lista':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
          {bloque.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case 'aviso':
      return (
        <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <span>{bloque.texto}</span>
        </div>
      )
    case 'definiciones':
      return (
        <dl className="divide-y divide-slate-100 rounded-lg border border-linea">
          {bloque.items.map((d) => (
            <div
              key={d.termino}
              className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:gap-4"
            >
              <dt className="text-sm font-semibold text-slate-900">{d.termino}</dt>
              <dd className="text-sm leading-relaxed text-slate-700">{d.texto}</dd>
            </div>
          ))}
        </dl>
      )
  }
}

function ResumenPaso({ articulo }: { articulo: ArticuloAyuda }) {
  const r = resumenDePaso(articulo)
  if (!r) return null
  const seccion = (icono: React.ReactNode, titulo: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {icono}
          {titulo}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="space-y-4 rounded-lg border border-linea bg-slate-50/60 px-5 py-4">
      <p className="flex gap-2 text-sm leading-relaxed text-slate-800">
        <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <span>{r.purpose}</span>
      </p>
      {seccion(<Database className="h-3.5 w-3.5" />, 'De dónde salen los datos', r.sources)}
      {seccion(<Calculator className="h-3.5 w-3.5" />, 'Cálculos y controles', r.formulas)}
      {seccion(<Lightbulb className="h-3.5 w-3.5" />, 'Tener en cuenta', r.notes ?? [])}
    </div>
  )
}

export function ArticuloVista({
  articulo,
  onVolver,
}: {
  articulo: ArticuloAyuda
  onVolver: () => void
}) {
  const relacionados = (articulo.relacionados ?? [])
    .map((id) => ARTICULO_POR_ID.get(id))
    .filter((a): a is ArticuloAyuda => !!a)
  return (
    <article className="max-w-3xl space-y-5" aria-labelledby={`titulo-${articulo.id}`}>
      <button
        type="button"
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Ayuda · {CATEGORIAS_AYUDA[articulo.categoria]}
      </button>
      <header>
        <h2
          id={`titulo-${articulo.id}`}
          className="font-serif text-2xl font-semibold tracking-tight text-tinta"
        >
          {articulo.titulo}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{articulo.resumen}</p>
      </header>
      <ResumenPaso articulo={articulo} />
      {articulo.bloques.map((b, i) => (
        <Bloque key={i} bloque={b} />
      ))}
      {relacionados.length > 0 && (
        <nav className="border-t border-linea pt-4" aria-label="Para seguir leyendo">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Para seguir leyendo
          </p>
          <ul className="flex flex-wrap gap-2">
            {relacionados.map((r) => (
              <li key={r.id}>
                <a
                  href={`#${r.id}`}
                  className="inline-block rounded-full border border-linea px-3 py-1 text-sm text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  {r.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  )
}
