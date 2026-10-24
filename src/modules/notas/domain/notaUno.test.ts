import { describe, it, expect } from 'vitest'
import { armarNotaUno, type EntradaNotaUno } from './notaUno'
import { bloquesTextoNota } from './textoNota'
import type { NotaTransicionGenerada } from '@/modules/transicion-rt54/lib/generarNota'

const fecha = (s: string) => new Date(`${s}T00:00:00Z`)

const base = (
  cambios: Partial<EntradaNotaUno['ejercicio']> = {},
  otros: Partial<EntradaNotaUno> = {},
): EntradaNotaUno => ({
  sociedad: { provincia: 'Córdoba' },
  ejercicio: {
    fechaInicio: fecha('2025-01-01'),
    fechaCierre: fecha('2025-12-31'),
    adopcionRT54: 'PRIMERA_ADOPCION',
    categoriaEnte: 'PEQUENA',
    indiceInflacionAnterior: 100,
    indiceInflacionActual: 131.55,
    notaUnoTexto: null,
    notaUnoEditadaEn: null,
    ...cambios,
  },
  conComparativo: true,
  transicion: null,
  ...otros,
})

const transicion = (conAjuste: boolean): NotaTransicionGenerada => ({
  titulo: 'Transición',
  parrafos: [
    'X aplica por primera vez la RT 54.',
    'A los efectos de la norma, la entidad se encuadra como "Entidad pequeña".',
    conAjuste
      ? 'Los efectos se exponen en las conciliaciones siguientes.'
      : 'La adopción no produjo efectos.',
  ],
  conciliacionPN: [
    { concepto: 'PN según normas anteriores', importe: 1000, esBase: true },
    ...(conAjuste ? [{ concepto: 'Provisión para vacaciones', importe: -150 }] : []),
    { concepto: 'PN según RT 54', importe: conAjuste ? 850 : 1000, esTotal: true },
  ],
  conciliacionResultado: [],
  reclasificaciones: [],
  advertencias: [],
})

const titulos = (texto: string) =>
  bloquesTextoNota(texto)
    .filter((b) => b.titulo)
    .map((b) => b.texto)

describe('Nota 1: bases de preparación', () => {
  it('primera aplicación con ajustes: seis apartados y la transición en el 1.6', () => {
    const n = armarNotaUno(base({}, { transicion: transicion(true) }))
    expect(n.titulo).toBe('Bases de preparación y adopción de la RT 54')
    expect(titulos(n.texto)).toEqual([
      '1.1. Bases de preparación',
      '1.2. Adopción de la RT 54',
      '1.3. Unidad de medida',
      '1.4. Clasificación de la Entidad',
      '1.5. Empresa en marcha',
      '1.6. Modificación de saldos al inicio por la transición a la RT 54',
    ])
    expect(n.transicion?.apartado).toBe('1.6')
    expect(n.texto).toContain('Los efectos se exponen en el apartado 1.6.')
    expect(n.texto).toContain('iniciado el 1 de enero de 2025')
    // La categoría va en su apartado, no se repite en la adopción.
    expect(n.texto).not.toContain('se encuadra como')
    expect(n.advertencias).toEqual([])
  })

  it('variación del índice con el coeficiente completo, mostrada con 2 decimales', () => {
    expect(armarNotaUno(base()).texto).toContain('fue del 31,55%.')
    expect(armarNotaUno(base({ indiceInflacionActual: 131.556 })).texto).toContain(
      'fue del 31,56%.',
    )
  })

  it('la resolución del Consejo de Córdoba solo para sociedades de Córdoba', () => {
    expect(armarNotaUno(base()).texto).toContain('Córdoba mediante Resolución N° 35/24')
    const otra = armarNotaUno({ ...base(), sociedad: { provincia: 'Santa Fe' } }).texto
    expect(otra).toContain('Consejo Profesional de Ciencias Económicas de la jurisdicción')
    expect(otra).not.toContain('35/24')
  })

  it('aplicación continuada: sin transición y con otro título', () => {
    const n = armarNotaUno(
      base({ adopcionRT54: 'APLICACION_CONTINUADA' }, { transicion: transicion(true) }),
    )
    expect(n.titulo).toBe('Bases de preparación de los estados contables')
    expect(titulos(n.texto)).toContain('1.2. Aplicación de la RT 54')
    expect(n.transicion).toBeNull()
  })

  it('la numeración se corre sola y avisa lo que falta', () => {
    const n = armarNotaUno(
      base({ adopcionRT54: null, categoriaEnte: null, indiceInflacionActual: null }),
    )
    expect(titulos(n.texto)).toEqual([
      '1.1. Bases de preparación',
      '1.2. Unidad de medida',
      '1.3. Empresa en marcha',
    ])
    expect(n.advertencias).toHaveLength(3)
  })

  it('primera aplicación sin ajustes: no hay apartado de transición', () => {
    const n = armarNotaUno(base({}, { transicion: transicion(false) }))
    expect(n.transicion).toBeNull()
    expect(n.texto).toContain('La adopción no produjo efectos.')
  })

  it('el texto del contador reemplaza al generado; las conciliaciones siguen saliendo', () => {
    const n = armarNotaUno(
      base(
        { notaUnoTexto: 'Texto propio.', notaUnoEditadaEn: fecha('2026-04-01') },
        { transicion: transicion(true) },
      ),
    )
    expect(n.texto).toBe('Texto propio.')
    expect(n.editada).toBe(true)
    expect(n.textoGenerado).toContain('1.1. Bases de preparación')
    expect(n.transicion?.apartado).toBe('1.6')
  })
})
