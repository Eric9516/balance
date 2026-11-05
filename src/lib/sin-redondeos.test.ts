import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regla primordial (CLAUDE.md): JAMÁS se redondea absolutamente nada.
 *
 * Esta prueba recorre todo el código de la app y falla si aparece un redondeo que no esté en la
 * lista de abajo. Cada uso permitido dice por qué: o no es un importe (un porcentaje de avance, el
 * tamaño de un archivo) o está PENDIENTE de una decisión del dueño del producto. Para agregar uno a
 * la lista hace falta esa decisión: no se agrega para que la prueba pase.
 */

const RAIZ = join(__dirname, '..', '..')
const SRC = join(RAIZ, 'src')

/** Formas de redondear en JavaScript, decimal.js e Intl. */
const REDONDEO =
  /\.toFixed\s*\(|\bMath\.(round|floor|ceil|trunc)\s*\(|\.(toDecimalPlaces|toDP|toPrecision|toSignificantDigits|toSD|toNearest|round)\s*\(|\.toLocaleString\s*\(|Intl\.NumberFormat|maximumFractionDigits/

/**
 * Comparar con tolerancia es redondear: dos importes que difieren en medio centavo no son iguales.
 * Se compara exacto (`comparaImportes`, `restar(a, b) !== 0`).
 */
const TOLERANCIA = /\bTOLERANCIA\w*\b|\)\s*[<>]=?\s*0\.0\d*/

type Permitido = { archivo: string; linea: string; motivo: string; pendiente?: true }

const PERMITIDOS: Permitido[] = [
  {
    archivo: 'src/lib/importe.ts',
    linea: 'const c = Math.round(v * 100)',
    motivo:
      'Solo detecta si un number tiene a lo sumo 2 decimales: el resultado se verifica (c / 100 === v) y nunca se usa redondeado.',
  },
  {
    archivo: 'src/lib/utils/currency.ts',
    linea: 'const absVal = d.abs().toFixed(cifras, Decimal.ROUND_DOWN)',
    motivo:
      'Solo presentación y sin redondear: corta los decimales de más (ROUND_DOWN), por decisión del dueño del producto (2026-10-31). Cálculos y base conservan el valor completo.',
  },
  {
    archivo: 'src/modules/importaciones/lib/excelParsing.ts',
    linea: 'n = Math.floor((n - 1) / 26)',
    motivo:
      'Letra de columna de Excel (A, B, …, AA): división entera de un índice, no es un importe.',
  },
  {
    archivo: 'src/modules/importaciones/components/ClasificacionTable.tsx',
    linea:
      'const progress = cuentas.length > 0 ? Math.round((totalClasificadas / cuentas.length) * 100) : 0',
    motivo: 'Porcentaje de cuentas clasificadas en la barra de avance: no es un importe.',
  },
  {
    archivo: 'src/modules/importaciones/components/ClasificacionTable.tsx',
    linea: '{Math.round(progress)}%',
    motivo: 'Porcentaje de cuentas clasificadas en la barra de avance: no es un importe.',
  },
  {
    archivo: 'src/modules/importaciones/components/PasoMapeo.tsx',
    linea: '{(archivo.size / 1024).toFixed(0)} KB',
    motivo: 'Tamaño del archivo subido: no es un importe.',
  },
]

function archivosDeCodigo(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      // src/test: datos sintéticos y mediciones, no código de la app.
      if (ruta === join(SRC, 'test')) continue
      salida.push(...archivosDeCodigo(ruta))
    } else if (/\.tsx?$/.test(entrada.name) && !/\.(test|itest)\.tsx?$/.test(entrada.name)) {
      salida.push(ruta)
    }
  }
  return salida
}

const esComentario = (linea: string) => /^(\/\/|\/\*|\*)/.test(linea)

function redondeosEnElCodigo() {
  const encontrados: { archivo: string; numero: number; linea: string }[] = []
  for (const ruta of archivosDeCodigo(SRC)) {
    const archivo = relative(RAIZ, ruta).split(sep).join('/')
    readFileSync(ruta, 'utf8')
      .split(/\r?\n/)
      .forEach((texto, i) => {
        const linea = texto.trim()
        if (!esComentario(linea) && (REDONDEO.test(linea) || TOLERANCIA.test(linea))) {
          encontrados.push({ archivo, numero: i + 1, linea })
        }
      })
  }
  return encontrados
}

const permitido = (archivo: string, linea: string) =>
  PERMITIDOS.some((p) => p.archivo === archivo && p.linea === linea)

describe('Regla primordial: jamás se redondea nada', () => {
  const encontrados = redondeosEnElCodigo()

  it('no hay redondeos fuera de la lista de usos permitidos', () => {
    const nuevos = encontrados
      .filter((e) => !permitido(e.archivo, e.linea))
      .map((e) => `${e.archivo}:${e.numero}  ${e.linea}`)
    expect(
      nuevos,
      'Jamás se redondea nada (CLAUDE.md). Para importes usá @/lib/importe y, para mostrarlos, ' +
        'formatCurrency. Si no es un importe o el dueño del producto lo decidió, agregalo a PERMITIDOS con su motivo.',
    ).toEqual([])
  })

  it('cada uso permitido sigue existiendo (la lista no acumula entradas viejas)', () => {
    const viejos = PERMITIDOS.filter(
      (p) => !encontrados.some((e) => e.archivo === p.archivo && e.linea === p.linea),
    ).map((p) => `${p.archivo}  ${p.linea}`)
    expect(viejos, 'Sacá de PERMITIDOS las entradas que ya no están en el código.').toEqual([])
  })

  it('el detector reconoce todas las formas de redondear', () => {
    for (const ejemplo of [
      'x.toFixed(2)',
      'Math.round(x * 100) / 100',
      'Math.floor(x)',
      'Math.ceil(x)',
      'Math.trunc(x)',
      'd.toDecimalPlaces(2)',
      'd.toDP(2)',
      'd.round()',
      'x.toPrecision(10)',
      'd.toSignificantDigits(5)',
      'x.toLocaleString("es-AR")',
      'new Intl.NumberFormat("es-AR")',
      '{ maximumFractionDigits: 2 }',
    ]) {
      expect(REDONDEO.test(ejemplo), ejemplo).toBe(true)
    }
    expect(REDONDEO.test('sumar(a, b)')).toBe(false)
  })

  it('el detector reconoce las comparaciones con tolerancia', () => {
    for (const ejemplo of [
      'const TOLERANCIA = 0.005',
      'if (Math.abs(diferencia) > TOLERANCIA_CENTAVOS) {',
      'cuadra: Math.abs(diferencia) < 0.01,',
      'Math.abs(restar(a, b)) <= 0.005',
    ]) {
      expect(TOLERANCIA.test(ejemplo), ejemplo).toBe(true)
    }
    expect(TOLERANCIA.test('if (restar(a, b) !== 0) {')).toBe(false)
  })
})

describe('La base no redondea al guardar', () => {
  /**
   * Toda columna Decimal es numeric SIN escala (`@db.Decimal`), que guarda el valor exacto.
   * - `@db.Decimal(18, 2)` redondea en silencio a 2 decimales.
   * - `@db.Decimal(30)` es escala 0: redondea a enteros.
   * - Un `Decimal` sin `@db.Decimal` es decimal(65,30) en Prisma: redondea a 30 decimales.
   * Las 42 columnas que tenían escala se migraron en 20261019163923_importes_sin_redondeo.
   */
  it('toda columna Decimal del esquema es numeric sin escala', () => {
    const esquema = readFileSync(join(RAIZ, 'prisma', 'schema.prisma'), 'utf8')
    const conEscala = esquema
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^\w+\s+Decimal\??\s/.test(l))
      .filter((l) => !/@db\.Decimal(?!\s*\()/.test(l))
    expect(
      conEscala,
      'Una columna decimal con escala redondea al guardar. Declarala con @db.Decimal, sin argumentos.',
    ).toEqual([])
  })
})
