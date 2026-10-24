'use client'

/**
 * Centro de ayuda: buscador, índice por temas y lectura de cada artículo. El artículo abierto vive
 * en la dirección (/ayuda#id), así el botón (i) de cada paso abre directamente el suyo.
 */
import type React from 'react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { ARTICULOS, ARTICULO_POR_ID, buscarEnAyuda } from '../contenido'
import type { Fragmento } from '../domain/buscador'
import { CATEGORIAS_AYUDA, type CategoriaAyuda } from '../domain/tipos'
import { ArticuloVista } from './ArticuloVista'

const EJEMPLOS = [
  '¿cómo cargo el ejercicio anterior?',
  'no me deja cerrar',
  'anexo 2',
  'AUT-012',
  'eepn',
]

function Resaltado({ fragmento }: { fragmento: Fragmento }) {
  const partes: React.ReactNode[] = []
  let desde = 0
  fragmento.marcas.forEach(([i, f], k) => {
    if (i > desde) partes.push(fragmento.texto.slice(desde, i))
    partes.push(
      <mark key={k} className="rounded bg-amber-100 px-0.5 text-slate-900">
        {fragmento.texto.slice(i, f)}
      </mark>,
    )
    desde = f
  })
  partes.push(fragmento.texto.slice(desde))
  return <>{partes}</>
}

const leerHash = () =>
  typeof window === 'undefined' ? null : decodeURIComponent(window.location.hash.slice(1)) || null

export function CentroAyuda() {
  const [consulta, setConsulta] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [elegido, setElegido] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)
  const diferida = useDeferredValue(consulta)
  const busqueda = useMemo(() => buscarEnAyuda(diferida), [diferida])
  const articulo = abierto ? ARTICULO_POR_ID.get(abierto) : undefined

  // El artículo abierto sigue a la dirección (#id): enlaces, botón (i) y Atrás del navegador.
  useEffect(() => {
    const sincronizar = () => {
      const id = leerHash()
      setAbierto(id)
      // Abrir un artículo (un enlace, el botón (i) de un paso) muestra el artículo, no la búsqueda.
      if (id) setConsulta('')
      window.scrollTo({ top: 0 })
    }
    sincronizar()
    window.addEventListener('hashchange', sincronizar)
    return () => window.removeEventListener('hashchange', sincronizar)
  }, [])

  // "/" lleva al buscador desde cualquier parte de la página.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key === '/' && t?.tagName !== 'INPUT' && t?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        entrada.current?.focus()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  const abrir = (id: string) => {
    setConsulta('')
    window.location.hash = id
  }
  const volver = () => {
    history.pushState(null, '', window.location.pathname)
    setAbierto(null)
  }

  const resultados = busqueda.resultados
  const conConsulta = consulta.trim().length > 0

  function alTeclearEnBuscador(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setElegido((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setElegido((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && resultados[elegido]) {
      abrir(resultados[elegido].articulo.id)
    } else if (e.key === 'Escape') {
      setConsulta('')
    }
  }

  return (
    <div className="space-y-6 px-8 py-6">
      <div className="max-w-3xl">
        <label htmlFor="buscador-ayuda" className="sr-only">
          Buscar en la ayuda
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="buscador-ayuda"
            ref={entrada}
            type="text"
            role="searchbox"
            enterKeyHint="search"
            autoComplete="off"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setElegido(0)
            }}
            onKeyDown={alTeclearEnBuscador}
            placeholder="Buscá lo que necesites: una pregunta, un paso, una sigla o un código de error"
            className="w-full rounded-xl border border-linea bg-white py-3 pr-20 pl-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {conConsulta ? (
            <button
              type="button"
              onClick={() => setConsulta('')}
              aria-label="Borrar la búsqueda"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-slate-200 px-1.5 text-xs text-slate-400">
              /
            </kbd>
          )}
        </div>
        {!conConsulta && !articulo && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            Por ejemplo:
            {EJEMPLOS.map((ej) => (
              <button
                key={ej}
                type="button"
                onClick={() => {
                  setConsulta(ej)
                  entrada.current?.focus()
                }}
                className="rounded-full border border-linea px-2 py-0.5 text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                {ej}
              </button>
            ))}
          </p>
        )}
      </div>

      {conConsulta ? (
        <section className="max-w-3xl" aria-live="polite">
          {busqueda.sugerencia && (
            <p className="mb-3 text-sm text-slate-600">
              ¿Quisiste decir{' '}
              <button
                type="button"
                onClick={() => setConsulta(busqueda.sugerencia!)}
                className="font-semibold text-blue-700 underline-offset-2 hover:underline"
              >
                {busqueda.sugerencia}
              </button>
              ?
            </p>
          )}
          <p className="mb-3 text-xs text-slate-500">
            {resultados.length === 0
              ? 'No encontramos nada con esas palabras. Probá con otras, con una sigla (EEPN, SSP, CMV) o con el código del mensaje.'
              : busqueda.parcial
                ? `Ningún artículo tiene todas esas palabras. Estos ${resultados.length} tienen una parte:`
                : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
          <ul className="space-y-2">
            {resultados.slice(0, 25).map((r, i) => (
              <li key={r.articulo.id}>
                <a
                  href={`#${r.articulo.id}`}
                  onClick={() => setConsulta('')}
                  onMouseEnter={() => setElegido(i)}
                  className={`block rounded-lg border px-4 py-3 transition-colors ${
                    i === elegido
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-linea bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {r.articulo.titulo}
                    </span>
                    <span className="flex-shrink-0 text-xs text-slate-400">
                      {CATEGORIAS_AYUDA[r.articulo.categoria]}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                    {r.fragmento ? <Resaltado fragmento={r.fragmento} /> : r.articulo.resumen}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : articulo ? (
        <ArticuloVista articulo={articulo} onVolver={volver} />
      ) : (
        <div className="grid max-w-5xl gap-6 md:grid-cols-2">
          {(Object.keys(CATEGORIAS_AYUDA) as CategoriaAyuda[]).map((c) => {
            const deCategoria = ARTICULOS.filter((a) => a.categoria === c)
            if (deCategoria.length === 0) return null
            return (
              <section key={c} className="rounded-xl border border-linea bg-white px-5 py-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">{CATEGORIAS_AYUDA[c]}</h2>
                <ul className="space-y-1">
                  {deCategoria.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`#${a.id}`}
                        className="text-sm text-blue-700 underline-offset-2 hover:underline"
                      >
                        {a.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
