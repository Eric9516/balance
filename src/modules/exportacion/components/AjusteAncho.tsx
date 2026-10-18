'use client'

import { useEffect } from 'react'

const MINIMO_PT = 5.5
const PASO_PT = 0.25

/**
 * Red de seguridad del ancho: los importes no se parten en dos líneas, así que una
 * tabla con muchas columnas e importes largos puede crecer más que la hoja. Para
 * cada tabla que se pasa, achica la letra de a poco hasta que entre. En pantalla
 * la hoja mide lo mismo que la hoja impresa, por eso la medida sirve para las dos.
 */
function ajustarTablas() {
  for (const hoja of Array.from(document.querySelectorAll<HTMLElement>('.hoja'))) {
    const estilo = getComputedStyle(hoja)
    const disponible =
      hoja.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
    for (const tabla of Array.from(hoja.querySelectorAll<HTMLElement>('.doc-tabla'))) {
      tabla.style.fontSize = ''
      let tamanio = parseFloat(getComputedStyle(tabla).fontSize) * 0.75 // px → pt
      while (tabla.getBoundingClientRect().width > disponible + 0.5 && tamanio > MINIMO_PT) {
        tamanio -= PASO_PT
        tabla.style.fontSize = `${tamanio}pt`
      }
    }
  }
}

export function AjusteAncho() {
  useEffect(() => {
    ajustarTablas()
    // Las fuentes pueden terminar de cargar después del primer render.
    document.fonts?.ready.then(ajustarTablas)
    window.addEventListener('beforeprint', ajustarTablas)
    return () => window.removeEventListener('beforeprint', ajustarTablas)
  }, [])
  return null
}
