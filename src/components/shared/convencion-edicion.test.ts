import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Convención de tablas editables (CLAUDE.md): un alta o una baja estructural (agregar o eliminar
 * una fila) se persiste de inmediato y se refleja con `sincronizar((prev) => ...)` de
 * `useEdicionLote`, que la aplica a lo guardado y al borrador por separado.
 *
 * Dos formas de hacerlo mal, las dos vistas en la app:
 * - Con `actualizar` solo cambia el borrador, que se ve únicamente mientras se edita: fuera de
 *   edición la fila nueva no aparece (ni desaparece la eliminada) hasta refrescar la página.
 * - Con `sincronizar(valor)`, pasando la lista ya armada: en edición no toca el borrador, así que
 *   la fila no aparece hasta Guardar o Cancelar; y como la lista se arma con lo que se ve, las
 *   ediciones sin guardar pasan a figurar como guardadas y Cancelar ya no las descarta.
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

/** Componentes que usan el borrador compartido, con su ruta legible y su código. */
function tablasEditables() {
  return componentes(SRC)
    .map((ruta) => ({
      archivo: relative(RAIZ, ruta).split(sep).join('/'),
      codigo: readFileSync(ruta, 'utf8'),
    }))
    .filter(({ codigo }) => /useEdicionLote|useComparativoLote/.test(codigo))
}

const linea = (codigo: string, indice: number) => codigo.slice(0, indice).split('\n').length

/** Texto de los argumentos de cada llamada `nombre(...)`, con su número de línea. */
function llamadas(codigo: string, nombre: string) {
  const encontradas: { linea: number; argumentos: string }[] = []
  for (const m of codigo.matchAll(new RegExp(`\\b${nombre}\\(`, 'g'))) {
    const inicio = m.index + m[0].length
    let profundidad = 1
    let i = inicio
    while (i < codigo.length && profundidad > 0) {
      if (codigo[i] === '(') profundidad++
      else if (codigo[i] === ')') profundidad--
      i++
    }
    encontradas.push({ linea: linea(codigo, m.index), argumentos: codigo.slice(inicio, i - 1) })
  }
  return encontradas
}

/** Un argumento que es una función escrita ahí mismo: `(prev) => ...`, `prev => ...` o `async`. */
const esFuncion = (argumento: string) =>
  /^\s*(async\b|\([^)]*\)\s*(:[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/.test(argumento)

describe('Convención: altas y bajas estructurales usan sincronizar con función', () => {
  it('ninguna acción inmediata (ejecutar) actualiza solo el borrador', () => {
    const violaciones = tablasEditables().flatMap(({ archivo, codigo }) =>
      llamadas(codigo, 'ejecutar')
        .filter(({ argumentos }) => /\bactualizar\(/.test(argumentos))
        .map(({ linea }) => `${archivo}:${linea}`),
    )
    expect(
      violaciones,
      'Un alta o baja ya persistida se refleja con sincronizar((prev) => ...), no con actualizar (ver CLAUDE.md).',
    ).toEqual([])
  })

  it('sincronizar recibe siempre una función, nunca la lista ya armada', () => {
    const violaciones = tablasEditables().flatMap(({ archivo, codigo }) =>
      llamadas(codigo, 'sincronizar')
        .filter(({ argumentos }) => !esFuncion(argumentos))
        .map(({ linea, argumentos }) => `${archivo}:${linea}  sincronizar(${argumentos.trim()})`),
    )
    expect(
      violaciones,
      'Pasá una función: sincronizar((prev) => ...). Con un valor, en edición la fila no aparece y Cancelar deja de descartar lo no guardado (ver CLAUDE.md).',
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
    const [llamada] = llamadas(codigo, 'ejecutar')
    expect(llamada?.argumentos).toContain('actualizar((prev) => [...prev, nuevo])')
    expect(llamada?.argumentos).toContain('avisar(')
  })

  it('el detector distingue una función de un valor', () => {
    for (const bien of [
      '(prev) => [...prev, nuevo]',
      'prev => prev.filter((x) => x.id !== id)',
      '(prev: Fila[]): Fila[] => prev',
      '\n      (prev) => new Map(prev).set(clave, entrada)',
    ]) {
      expect(esFuncion(bien), bien).toBe(true)
    }
    for (const mal of [
      'actualizada',
      'next',
      'new Map(valor).set(clave, entrada)',
      '[...lista, x]',
    ]) {
      expect(esFuncion(mal), mal).toBe(false)
    }
  })
})
