import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Convención de tablas editables (CLAUDE.md): un alta o una baja estructural (agregar o eliminar
 * una fila) se persiste de inmediato con `ejecutar` de `useGuardarAccion` y se refleja con
 * `sincronizar` de `useEdicionLote`, que la aplica a lo guardado y al borrador.
 *
 * Con `actualizar` solo cambia el borrador, que se muestra únicamente mientras se edita: fuera de
 * edición la fila nueva no aparece (ni desaparece la eliminada) hasta refrescar la página, y en
 * edición "Cancelar" la hace desaparecer aunque ya esté guardada.
 */

const RAIZ = join(__dirname, '..', '..', '..')
const SRC = join(RAIZ, 'src')

function componentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) return componentes(ruta)
    return e.name.endsWith('.tsx') ? [ruta] : []
  })
}

/** Texto de los argumentos de cada llamada `ejecutar(...)`, con su número de línea. */
function llamadasAEjecutar(codigo: string) {
  const llamadas: { linea: number; argumentos: string }[] = []
  for (const m of codigo.matchAll(/\bejecutar\(/g)) {
    const inicio = m.index + m[0].length
    let profundidad = 1
    let i = inicio
    while (i < codigo.length && profundidad > 0) {
      if (codigo[i] === '(') profundidad++
      else if (codigo[i] === ')') profundidad--
      i++
    }
    llamadas.push({
      linea: codigo.slice(0, m.index).split('\n').length,
      argumentos: codigo.slice(inicio, i - 1),
    })
  }
  return llamadas
}

describe('Convención: altas y bajas estructurales usan sincronizar', () => {
  it('ninguna acción inmediata (ejecutar) actualiza solo el borrador', () => {
    const violaciones: string[] = []
    for (const ruta of componentes(SRC)) {
      const codigo = readFileSync(ruta, 'utf8')
      if (!/useEdicionLote|useComparativoLote/.test(codigo)) continue
      for (const { linea, argumentos } of llamadasAEjecutar(codigo)) {
        if (/\bactualizar\(/.test(argumentos)) {
          violaciones.push(`${relative(RAIZ, ruta).split(sep).join('/')}:${linea}`)
        }
      }
    }
    expect(
      violaciones,
      'Un alta o baja ya persistida se refleja con sincronizar, no con actualizar (ver CLAUDE.md).',
    ).toEqual([])
  })

  it('el detector encuentra actualizar dentro de los argumentos de ejecutar', () => {
    const codigo = `ejecutar(
      () => crear(a, b),
      (nuevo) => {
        actualizar((prev) => [...prev, nuevo])
        avisar(\`Agregada "\${nombre.trim()}"\`)
      },
    )`
    const [llamada] = llamadasAEjecutar(codigo)
    expect(llamada?.argumentos).toContain('actualizar((prev) => [...prev, nuevo])')
    expect(llamada?.argumentos).toContain('avisar(')
  })
})
