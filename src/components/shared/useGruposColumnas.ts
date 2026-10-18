'use client'

import { useSyncExternalStore } from 'react'

/**
 * Grupos de columnas plegables de una tabla de trabajo. Plegado = se muestra solo
 * el total del grupo. Es una comodidad de lectura por usuario: se recuerda en el
 * navegador (localStorage) y nunca afecta datos. Servidor y primer render usan el
 * mismo valor por defecto (sin desajustes de hidratación).
 */

const EVENTO = 'balancert:columnas'

function suscribir(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(EVENTO, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(EVENTO, callback)
  }
}

// Sin preferencia guardada, la tabla arranca en "solo totales": es lo que cabe en
// pantalla a tamaño cómodo. El detalle se abre por grupo (y siempre en edición).
const POR_DEFECTO = '__todos__'

function leer(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

export function useGruposColumnas<G extends string>(clave: string, grupos: readonly G[]) {
  const storageKey = `balancert:columnas:${clave}`
  const raw = useSyncExternalStore(
    suscribir,
    () => leer(storageKey),
    () => POR_DEFECTO,
  )

  let plegados: Set<G>
  try {
    plegados =
      raw === POR_DEFECTO
        ? new Set(grupos)
        : new Set(
            (JSON.parse(raw) as string[]).filter((g): g is G =>
              (grupos as readonly string[]).includes(g),
            ),
          )
  } catch {
    plegados = new Set()
  }

  function persistir(next: Set<G>) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]))
      window.dispatchEvent(new Event(EVENTO))
    } catch {
      // Sin almacenamiento: la tabla queda expandida.
    }
  }

  return {
    estaPlegado: (g: G) => plegados.has(g),
    alternar: (g: G) => {
      const next = new Set(plegados)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      persistir(next)
    },
    todosPlegados: grupos.every((g) => plegados.has(g)),
    plegarTodos: () => persistir(new Set(grupos)),
    expandirTodos: () => persistir(new Set()),
  }
}
