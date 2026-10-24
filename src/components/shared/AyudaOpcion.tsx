'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ARTICULO_CONFIG_NOTAS,
  type ExplicacionOpcion,
  type PreguntaConfig,
} from '@/modules/ayuda/domain/opciones'

const ANCHO = 320
const MARGEN = 8
const SEPARACION = 6
/** Si abajo queda menos que esto y arriba hay más lugar, el globo se abre hacia arriba. */
const ALTO_MINIMO = 240

type Posicion = { left: number; top?: number; bottom?: number; altoMax: number }

function calcularPosicion(boton: HTMLElement): Posicion {
  const r = boton.getBoundingClientRect()
  const left = Math.min(Math.max(MARGEN, r.left), window.innerWidth - ANCHO - MARGEN)
  const abajo = window.innerHeight - r.bottom - SEPARACION - MARGEN
  const arriba = r.top - SEPARACION - MARGEN
  return abajo < ALTO_MINIMO && arriba > abajo
    ? { left, bottom: window.innerHeight - r.top + SEPARACION, altoMax: arriba }
    : { left, top: r.bottom + SEPARACION, altoMax: abajo }
}

const subtitulo = 'mt-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase'
const lista = 'mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600'

function Detalle({ o }: { o: ExplicacionOpcion }) {
  return (
    <>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{o.queHace}</p>
      <p className={subtitulo}>Qué cambia</p>
      <ul className={lista}>
        {o.impacta.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {o.noCambia && o.noCambia.length > 0 && (
        <>
          <p className={subtitulo}>Qué no cambia</p>
          <ul className={lista}>
            {o.noCambia.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/**
 * Símbolo (?) junto a una opción o un campo: al tocarlo explica qué hace y qué cambia en el balance.
 * El texto sale de la ayuda (@/modules/ayuda/domain/opciones), nunca se escribe en la pantalla.
 * Con una pregunta entera (por ejemplo, el encabezado de una columna) explica todas sus opciones.
 * Se cierra con Escape (sin cerrar el modal que lo contiene), tocando afuera o al desplazar.
 */
export function AyudaOpcion({
  ayuda,
  articulo = ARTICULO_CONFIG_NOTAS,
  className,
}: {
  ayuda: ExplicacionOpcion | PreguntaConfig<string>
  /** Artículo de la ayuda con la explicación completa. */
  articulo?: string
  className?: string
}) {
  const [posicion, setPosicion] = useState<Posicion | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const globo = useRef<HTMLDivElement>(null)
  const id = useId()
  const abierto = posicion !== null
  const pregunta = 'opciones' in ayuda ? ayuda : null
  const nombre = pregunta ? pregunta.titulo : (ayuda as ExplicacionOpcion).etiqueta

  const cerrar = useCallback((devolverFoco: boolean) => {
    setPosicion(null)
    if (devolverFoco) boton.current?.focus()
  }, [])

  useEffect(() => {
    if (!abierto) return
    globo.current?.focus()
    const fuera = (e: Event) => {
      const t = e.target as Node
      if (!globo.current?.contains(t) && !boton.current?.contains(t)) cerrar(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // El modal que lo contiene escucha Escape en window: que no se cierre también.
      e.stopPropagation()
      cerrar(true)
    }
    const desplazar = (e: Event) => {
      if (!globo.current?.contains(e.target as Node)) cerrar(false)
    }
    const redimensionar = () => cerrar(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', desplazar, true)
    window.addEventListener('resize', redimensionar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', desplazar, true)
      window.removeEventListener('resize', redimensionar)
    }
  }, [abierto, cerrar])

  function alternar(e: React.MouseEvent) {
    // Dentro de una opción (label) no tiene que elegirla.
    e.preventDefault()
    e.stopPropagation()
    if (abierto) cerrar(false)
    else if (boton.current) setPosicion(calcularPosicion(boton.current))
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-label={`Qué hace: ${nombre}`}
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        title={`Qué hace: ${nombre}`}
        className={cn(
          'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500',
          abierto && 'bg-blue-50 text-blue-600',
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {posicion &&
        createPortal(
          <div
            ref={globo}
            id={id}
            role="dialog"
            aria-label={nombre}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              left: posicion.left,
              top: posicion.top,
              bottom: posicion.bottom,
              width: ANCHO,
              maxHeight: posicion.altoMax,
            }}
            className="fixed z-[70] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-left font-normal tracking-normal normal-case shadow-xl outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{nombre}</p>
              <button
                type="button"
                onClick={() => cerrar(true)}
                aria-label="Cerrar"
                className="-mt-1 -mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {pregunta ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {pregunta.explicacion}
                </p>
                {Object.values(pregunta.opciones).map((o) => (
                  <div key={o.etiqueta} className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-800">{o.etiqueta}</p>
                    <Detalle o={o} />
                  </div>
                ))}
              </>
            ) : (
              <Detalle o={ayuda as ExplicacionOpcion} />
            )}
            <a
              href={`/ayuda#${articulo}`}
              target="_blank"
              rel="noopener"
              className="mt-3 inline-block text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              Ver en la ayuda
            </a>
          </div>,
          document.body,
        )}
    </>
  )
}
