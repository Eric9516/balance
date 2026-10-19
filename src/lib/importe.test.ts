import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  MAX_IMPORTE_EXACTO,
  comparaImportes,
  dividir,
  importe,
  multiplicar,
  restar,
  sumar,
  sumarPor,
} from './importe'

/** Generador pseudoaleatorio reproducible (mulberry32). */
function azar(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('sumar y restar son exactos', () => {
  it('no arrastra el error del number de JavaScript', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // lo que evita este módulo
    expect(sumar(0.1, 0.2)).toBe(0.3)
    expect(restar(0.3, 0.1)).toBe(0.2)
    expect(sumar(1.005, 2.005, 3.005)).toBe(6.015)
  })

  it('justo debajo del límite cada centavo es distinto; justo encima ya no', () => {
    expect(2 ** 46 - 0.01 === 2 ** 46 - 0.02).toBe(false)
    expect(2 ** 47 - 0.01 === 2 ** 47 - 0.02).toBe(true) // por eso existe el límite
  })

  it('miles de importes con centavos suman exactamente lo mismo que contando centavos enteros', () => {
    const r = azar(20261019)
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const centavos = Array.from({ length: 2000 }, () => Math.round((r() - 0.5) * 2e12))
      const importes = centavos.map((c) => c / 100)
      const esperado = centavos.reduce((a, c) => a + c, 0) / 100
      expect(sumarPor(importes, (x) => x)).toBe(esperado)
      expect(sumar(...importes)).toBe(esperado)
    }
  })

  it('suma importes grandes con centavos, hasta el máximo exacto', () => {
    expect(sumar(35_000_000_000_000.45, 35_000_000_000_000.46)).toBe(70_000_000_000_000.91)
    expect(restar(MAX_IMPORTE_EXACTO, 0.01)).toBe(70_368_744_177_663.98)
    expect(sumar(MAX_IMPORTE_EXACTO, -0.99)).toBe(70_368_744_177_663)
  })

  it('los vacíos cuentan como cero', () => {
    expect(sumar(null, undefined, 5)).toBe(5)
    expect(restar(null, 2)).toBe(-2)
  })

  it('acepta los decimales de la base (Prisma.Decimal) y texto', () => {
    expect(sumar(new Decimal('123456789.12'), '0.88')).toBe(123456790)
    expect(importe(new Decimal('-1500.50'))).toBe(-1500.5)
  })
})

describe('multiplicar y dividir', () => {
  it('reexpresa con el coeficiente sin error acumulado', () => {
    const coeficiente = dividir(125, 100)
    expect(coeficiente).toBe(1.25)
    expect(multiplicar(1000.01, coeficiente)).toBe(1250.0125) // no redondea a centavos
    expect(multiplicar(0.1, 3)).toBe(0.3)
  })

  it('dividir por cero corta con un error claro', () => {
    expect(() => dividir(10, 0)).toThrow()
    try {
      dividir(10, 0)
    } catch (e) {
      expect(e).toMatchObject({ codigo: 'NEG-061' })
    }
  })
})

describe('límite de exactitud', () => {
  it('un resultado que supera el máximo no se redondea en silencio: corta con NEG-060', () => {
    let capturado: unknown
    try {
      sumar(MAX_IMPORTE_EXACTO, 0.01)
    } catch (e) {
      capturado = e
    }
    expect(capturado).toMatchObject({ codigo: 'NEG-060', tipo: 'NEGOCIO' })
    expect((capturado as { mensaje: string }).mensaje).toContain('70.368.744.177.664,00')
  })

  it('un valor que no es número corta con NEG-061', () => {
    expect(() => sumar(Number.NaN)).toThrow()
    expect(() => importe('doce')).toThrow()
  })
})

const D34 = Decimal.clone({ precision: 34 })

describe('camino rápido (centavos enteros) = cálculo decimal puro', () => {
  /** Referencia: decimal.js (34 dígitos, como el módulo) leyendo cada number por su representación más corta. */
  const referencia = (valores: number[], signo: 1 | -1 = 1) =>
    valores
      .reduce(
        (acc, v, i) => (i === 0 || signo === 1 ? acc.plus(String(v)) : acc.minus(String(v))),
        new D34(0),
      )
      .toNumber()

  it('da exactamente el mismo resultado con importes de 2 decimales, con más decimales y mezclados', () => {
    const r = azar(424242)
    const generar = (): number => {
      const tipo = r()
      if (tipo < 0.6) return Math.round((r() - 0.5) * 2e10) / 100 // centavos
      if (tipo < 0.8) return (r() - 0.5) * 1e6 * (1 + r()) // reexpresado: muchos decimales
      if (tipo < 0.9) return Math.round((r() - 0.5) * 2e15) / 100 // grandes, hasta 10 billones
      return 0
    }
    for (let vuelta = 0; vuelta < 3000; vuelta++) {
      const valores = Array.from({ length: 1 + Math.floor(r() * 40) }, generar)
      expect(sumar(...valores)).toBe(referencia(valores))
      expect(restar(valores[0], ...valores.slice(1))).toBe(referencia(valores, -1))
    }
  })

  it('multiplicar por un coeficiente da lo mismo que decimal.js', () => {
    const r = azar(777)
    for (let vuelta = 0; vuelta < 5000; vuelta++) {
      const v = r() < 0.7 ? Math.round((r() - 0.5) * 2e12) / 100 : (r() - 0.5) * 1e7
      const k = r() < 0.5 ? Math.round(r() * 1e4) / 1e3 : 1 + r() * 9
      expect(multiplicar(v, k)).toBe(new D34(String(v)).times(String(k)).toNumber())
    }
  })

  it('restar un valor igual al minuendo da cero, también por el camino exacto', () => {
    expect(restar(5, 5)).toBe(0)
    expect(restar(1.2345678, 1.2345678)).toBe(0)
    expect(restar(1.2345678, 0.0345678, 1.2)).toBe(0)
  })

  it('importe() de un Decimal de la base da lo mismo que leerlo como decimal', () => {
    for (const texto of ['0.01', '-0.29', '123456789.12', '70368744177663.99', '1250.0125']) {
      expect(importe(new Decimal(texto))).toBe(new Decimal(texto).toNumber())
    }
  })
})

describe('comparaImportes', () => {
  it('iguala con tolerancia de un centavo', () => {
    expect(comparaImportes(100, 100.01)).toBe(true)
    expect(comparaImportes(100, 100.02)).toBe(false)
    expect(comparaImportes(0.1 + 0.2, 0.3)).toBe(true)
  })
})
