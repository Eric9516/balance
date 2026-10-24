/**
 * La ayuda no se desactualiza: cada paso del ejercicio y cada código de error de la app tienen su
 * explicación, y el buscador encuentra lo que un contador escribiría.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, it, expect } from 'vitest'
import { ARTICULOS, ARTICULO_POR_ID, buscarEnAyuda, resumenDePaso } from './contenido'
import { PASO_INFO, articuloDePaso, type InfoPasoKey } from './domain/pasos'
import { INFO_PANTALLAS } from './domain/pantallas'

const SRC = join(__dirname, '..', '..')

/** Códigos de error o aviso que aparecen en el código de la app (sin pruebas). */
function codigosDeLaApp(): Set<string> {
  const codigos = new Set<string>()
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name)
      if (e.isDirectory()) {
        if (!ruta.endsWith(`${sep}test`)) recorrer(ruta)
      } else if (/\.tsx?$/.test(e.name) && !/\.(test|itest)\.tsx?$/.test(e.name)) {
        for (const m of readFileSync(ruta, 'utf8').matchAll(/'((?:NEG|AUT|AUTH|TECH)-\d{3})'/g)) {
          codigos.add(m[1]!)
        }
      }
    }
  }
  recorrer(SRC)
  return codigos
}

const titulos = (q: string) => buscarEnAyuda(q).resultados.map((r) => r.articulo.id)

describe('La ayuda cubre toda la app', () => {
  it('cada paso del ejercicio tiene su artículo, que empieza con el resumen del paso', () => {
    for (const paso of [...Object.keys(PASO_INFO), 'ejercicios'] as (
      InfoPasoKey | 'ejercicios'
    )[]) {
      const articulo = ARTICULO_POR_ID.get(articuloDePaso(paso))
      expect(articulo, `falta el artículo del paso "${paso}"`).toBeDefined()
      expect(resumenDePaso(articulo!), paso).not.toBeNull()
    }
  })

  it('cada pantalla tiene su botón (i) y lleva a un artículo que existe', () => {
    for (const [clave, { articulo }] of Object.entries(INFO_PANTALLAS)) {
      expect(ARTICULO_POR_ID.has(articulo), `${clave} → ${articulo}`).toBe(true)
    }
    const paginas: string[] = []
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (e.name === 'page.tsx') paginas.push(ruta)
      }
    }
    recorrer(join(SRC, 'app', '(main)'))
    const sinBoton = paginas
      .filter((p) => !p.includes(`${sep}ayuda${sep}`))
      .filter((p) => !/ayuda="|<StepInfoButton/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(SRC.length + 1))
    expect(
      sinBoton,
      'Agregá ayuda="<pantalla>" al PageHeader (ver src/modules/ayuda/domain/pantallas.ts)',
    ).toEqual([])
  })

  it('cada código de error o aviso de la app está explicado', () => {
    const explicados = new Set(ARTICULOS.flatMap((a) => a.codigos ?? []))
    const faltan = [...codigosDeLaApp()].filter((c) => !explicados.has(c)).sort()
    expect(faltan, 'Agregá su explicación en src/modules/ayuda/contenido/mensajes.ts').toEqual([])
  })

  it('identificadores únicos y relacionados que existen', () => {
    expect(new Set(ARTICULOS.map((a) => a.id)).size).toBe(ARTICULOS.length)
    for (const a of ARTICULOS) {
      for (const r of a.relacionados ?? []) {
        expect(ARTICULO_POR_ID.has(r), `${a.id} → ${r}`).toBe(true)
      }
    }
  })
})

describe('El buscador entiende al contador', () => {
  it('sin tildes ni mayúsculas y con la raíz de las palabras', () => {
    expect(titulos('EVOLUCION DEL PATRIMONIO')[0]).toBe('paso-patrimonio-neto')
    expect(titulos('amortizaciones')).toContain('paso-bienes-de-uso')
  })

  it('con errores de tipeo y mientras se escribe', () => {
    expect(titulos('amortisacion')).toContain('paso-bienes-de-uso')
    expect(titulos('flujo de efect')[0]).toBe('flujo-efectivo')
  })

  it('con siglas y sinónimos', () => {
    expect(titulos('eepn')[0]).toBe('paso-patrimonio-neto')
    expect(titulos('cmv')).toContain('paso-costo-ventas')
    expect(titulos('anexo 2')).toContain('paso-costo-ventas')
    expect(titulos('año pasado a mano')[0]).toBe('anterior-manual')
  })

  it('con preguntas enteras', () => {
    expect(titulos('¿Cómo cargo el ejercicio anterior a mano?')[0]).toBe('anterior-manual')
    expect(titulos('no me deja cerrar el ejercicio')).toContain('neg-004')
    expect(titulos('¿cómo saco una nota del pdf?')).toContain('pregunta-sacar-nota')
  })

  it('con códigos de error escritos de cualquier forma', () => {
    for (const q of ['AUT-012', 'aut 12', 'Aut012', 'error aut-12']) {
      const b = buscarEnAyuda(q)
      expect(b.codigo, q).toBe('AUT-012')
      expect(b.resultados[0]?.articulo.id, q).toBe('aut-012')
    }
  })

  it('marca las palabras encontradas en el fragmento', () => {
    const r = buscarEnAyuda('existencia final').resultados.find(
      (x) => x.articulo.id === 'paso-costo-ventas',
    )
    expect(r?.fragmento?.marcas.length).toBeGreaterThan(0)
  })

  it('propone una corrección cuando una palabra no existe', () => {
    // "dividenzzos" ya lo encuentra como error de tipeo; "resreba" está demasiado lejos.
    expect(titulos('dividenzzos')).toContain('paso-patrimonio-neto')
    expect(buscarEnAyuda('resreba').sugerencia).toMatch(/^reservas?$/)
  })

  it('una consulta vacía no devuelve nada', () => {
    expect(buscarEnAyuda('   ').resultados).toEqual([])
    expect(buscarEnAyuda('¿cómo?').resultados).toEqual([])
  })
})
