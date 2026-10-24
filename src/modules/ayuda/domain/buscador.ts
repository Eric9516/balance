/**
 * Buscador de la ayuda. Entiende cómo pregunta un contador:
 *  - sin tildes ni mayúsculas, y con la raíz de las palabras ("cargo", "cargar", "cargado");
 *  - con errores de tipeo ("amortisacion") y mientras se escribe ("amort");
 *  - con siglas y sinónimos contables (EEPN, SSP, CMV, "año anterior" = comparativo…);
 *  - con preguntas enteras ("¿cómo cargo el ejercicio anterior?"): ignora las palabras vacías;
 *  - con códigos de error escritos de cualquier forma ("aut 12", "AUT-012", "neg004").
 * Si no encuentra todo, muestra lo más parecido y propone una corrección ("¿Quisiste decir…?").
 * Puro y rápido: el índice se arma una vez y cada búsqueda recorre unos pocos miles de palabras.
 */
import type { ArticuloAyuda, BloqueAyuda } from './tipos'

// ─── Texto ────────────────────────────────────────────────────────────────────

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const VACIAS = new Set(
  (
    'a al algo alguna algun como con cual cuales cuando de del donde el en entre es esta este esto ' +
    'ha hace hacer hago hay la las le lo los me mi mis o para pero por porque puedo que se si sin ' +
    'su sus te tengo un una uno unos unas y ya yo quiero necesito deberia debo sale sirve'
  ).split(' '),
)

const SUFIJOS = [
  'aciones',
  'amientos',
  'amiento',
  'imiento',
  'acion',
  'ables',
  'ando',
  'iendo',
  'ados',
  'adas',
  'idos',
  'idas',
  'able',
  'ado',
  'ada',
  'ido',
  'ida',
  'ar',
  'er',
  'ir',
  'es',
  'os',
  'as',
  'o',
  'a',
  'e',
  's',
]

/** Raíz de una palabra: le saca una terminación común si quedan al menos 4 letras. */
export function raiz(palabra: string): string {
  if (/\d/.test(palabra)) return palabra
  for (const s of SUFIJOS) {
    if (palabra.endsWith(s) && palabra.length - s.length >= 4) return palabra.slice(0, -s.length)
  }
  return palabra
}

/** Distancia de edición con transposiciones (Damerau, alineación óptima). Corta si supera `max`. */
export function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previa2: number[] = []
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    let minimo = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(previa[j]! + 1, actual[j - 1]! + 1, previa[j - 1]! + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, previa2[j - 2]! + 1)
      }
      actual.push(v)
      if (v < minimo) minimo = v
    }
    if (minimo > max) return max + 1
    previa2 = previa
    previa = actual
  }
  return previa[b.length]!
}

/** Errores de tipeo tolerados según el largo de la palabra. */
const tolerancia = (largo: number) => (largo >= 8 ? 2 : largo >= 4 ? 1 : 0)

// ─── Sinónimos y siglas ──────────────────────────────────────────────────────

/** Cada grupo: formas de decir lo mismo. Buscar cualquiera encuentra las demás. */
const SINONIMOS: string[][] = [
  ['eepn', 'evolucion del patrimonio neto', 'estado de evolucion del patrimonio neto'],
  ['ssp', 'estado de situacion patrimonial', 'situacion patrimonial', 'balance general'],
  ['eerr', 'estado de resultados', 'cuadro de resultados', 'perdidas y ganancias'],
  ['efe', 'flujo de efectivo', 'estado de flujo de efectivo', 'flujo de fondos'],
  ['cmv', 'costo de ventas', 'costo de mercaderias vendidas', 'anexo ii', 'anexo 2'],
  ['bdu', 'bienes de uso', 'activo fijo', 'anexo i', 'anexo 1'],
  ['anexo iii', 'anexo 3', 'gastos'],
  ['rna', 'resultados no asignados', 'resultados acumulados'],
  [
    'comparativo',
    'ejercicio anterior',
    'ano anterior',
    'ano pasado',
    'periodo anterior',
    'columna anterior',
    'comparativa',
  ],
  [
    'inflacion',
    'reexpresion',
    'reexpresar',
    'coeficiente',
    'indice',
    'ipc',
    'rt 6',
    'moneda homogenea',
  ],
  ['rt 54', 'rt54', 'resolucion tecnica 54'],
  ['pdf', 'imprimir', 'impresion', 'exportar', 'descargar'],
  ['sociedad', 'cliente', 'empresa', 'ente'],
  ['auditor', 'firmante', 'firma'],
  ['rubro', 'clasificacion', 'clasificar'],
  ['nota 1', 'nota i', 'bases de preparacion'],
  ['transicion', 'primera aplicacion', 'primera adopcion'],
  ['autorizar', 'autorizacion', 'compuerta', 'aprobar'],
  ['cerrar', 'cierre', 'cerrado', 'finalizar'],
  ['borrar', 'eliminar', 'quitar', 'sacar'],
  ['guardar', 'grabar'],
  ['importar', 'excel', 'sumas y saldos', 'subir archivo'],
  ['redondeo', 'redondear', 'decimales', 'centavos'],
  ['no cuadra', 'descuadre', 'no cierra', 'no balancea'],
  ['candado', 'bloqueado', 'bloqueada', 'no se puede editar', 'no me deja editar'],
  ['vinculado', 'vincular', 'vinculo'],
  ['manual', 'a mano', 'carga manual'],
]

/** Cada sinónimo como lista de raíces, para comparar con el texto ya normalizado. */
const GRUPOS = SINONIMOS.map((g) => g.map((frase) => normalizar(frase).split(' ').map(raiz)))

// ─── Índice ───────────────────────────────────────────────────────────────────

type Campo = 'codigos' | 'titulo' | 'claves' | 'resumen' | 'cuerpo'
const PESO: Record<Campo, number> = { codigos: 8, titulo: 5, claves: 4, resumen: 2, cuerpo: 1 }

type Documento = {
  articulo: ArticuloAyuda
  campos: Record<Campo, string[]>
  oraciones: string[]
  /** Palabras con contenido del título: para premiar el título que se cubre casi entero. */
  largoTitulo: number
}

function textosDeBloque(b: BloqueAyuda): string[] {
  switch (b.tipo) {
    case 'parrafo':
    case 'aviso':
      return [b.texto]
    case 'pasos':
    case 'lista':
      return b.items
    case 'definiciones':
      return b.items.map((d) => `${d.termino}: ${d.texto}`)
  }
}

const raices = (texto: string) =>
  normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 0)
    .map(raiz)

function oraciones(textos: string[]): string[] {
  return textos.flatMap((t) => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿"(])/)).filter((o) => o.trim())
}

export type ConsultaCodigo = { codigo: string; resto: string }

/** "aut 12", "AUT-012" o "neg004" → AUT-012 / NEG-004, y lo que queda de la consulta. */
export function extraerCodigo(consulta: string): ConsultaCodigo | null {
  const m = normalizar(consulta).match(/\b(neg|aut|auth|tech|val)\s*(\d{1,3})\b/)
  if (!m) return null
  const codigo = `${m[1]!.toUpperCase()}-${m[2]!.padStart(3, '0')}`
  return { codigo, resto: normalizar(consulta).replace(m[0], ' ').trim() }
}

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

export type Fragmento = { texto: string; marcas: [inicio: number, fin: number][] }

export type ResultadoBusqueda = {
  articulo: ArticuloAyuda
  puntaje: number
  fragmento: Fragmento | null
}

export type Busqueda = {
  resultados: ResultadoBusqueda[]
  /** No hay artículos con todo lo buscado: se muestran los que tienen una parte. */
  parcial: boolean
  /** Consulta corregida para proponer ("¿Quisiste decir…?"), si alguna palabra no existe. */
  sugerencia: string | null
  /** Código de error reconocido en la consulta. */
  codigo: string | null
}

/** Un concepto de la consulta: una palabra o un grupo de sinónimos (cualquiera vale). */
type Concepto = { alternativas: string[][]; palabras: string[] }

function conceptos(texto: string): Concepto[] {
  const palabras = normalizar(texto)
    .split(' ')
    .filter((p) => p && !VACIAS.has(p))
  const usadas = new Array<boolean>(palabras.length).fill(false)
  const lista: Concepto[] = []
  const stems = palabras.map(raiz)
  // Primero los sinónimos de varias palabras, de los más largos a los más cortos.
  const frases = GRUPOS.flatMap((g, gi) => g.map((f) => ({ f, gi }))).sort(
    (x, y) => y.f.length - x.f.length,
  )
  for (const { f, gi } of frases) {
    for (let i = 0; i + f.length <= stems.length; i++) {
      if (usadas.slice(i, i + f.length).some(Boolean)) continue
      if (f.every((s, k) => s === stems[i + k])) {
        for (let k = 0; k < f.length; k++) usadas[i + k] = true
        lista.push({ alternativas: GRUPOS[gi]!, palabras: palabras.slice(i, i + f.length) })
      }
    }
  }
  stems.forEach((s, i) => {
    if (!usadas[i]) lista.push({ alternativas: [[s]], palabras: [palabras[i]!] })
  })
  return lista
}

/** Qué tan bien aparece una raíz en una lista de raíces: 1 igual, 0,7 empieza así, 0,5 con un error. */
function calidad(buscada: string, tokens: string[]): number {
  let mejor = 0
  const max = tolerancia(buscada.length)
  for (const t of tokens) {
    if (t === buscada) return 1
    if (buscada.length >= 3 && t.startsWith(buscada)) mejor = Math.max(mejor, 0.7)
    else if (max > 0 && mejor < 0.5 && distancia(buscada, t, max) <= max) mejor = 0.5
  }
  return mejor
}

function puntajeConcepto(c: Concepto, doc: Documento): number {
  let mejor = 0
  for (const alt of c.alternativas) {
    for (const campo of Object.keys(PESO) as Campo[]) {
      const tokens = doc.campos[campo]
      const q = Math.min(...alt.map((s) => calidad(s, tokens)))
      if (q > 0) mejor = Math.max(mejor, q * PESO[campo])
    }
  }
  return mejor
}

function fragmento(doc: Documento, cs: Concepto[]): Fragmento | null {
  const buscadas = cs.flatMap((c) => c.alternativas.flat())
  let mejor: { texto: string; n: number } | null = null
  for (const o of doc.oraciones) {
    const tokens = raices(o)
    const n = cs.filter((c) =>
      c.alternativas.some((alt) => alt.every((s) => calidad(s, tokens) > 0)),
    ).length
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { texto: o, n }
  }
  if (!mejor) return null
  const marcas: [number, number][] = []
  const re = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(mejor.texto))) {
    const r = raiz(normalizar(m[0]))
    if (buscadas.some((s) => s === r || (s.length >= 3 && r.startsWith(s)))) {
      marcas.push([m.index, m.index + m[0].length])
    }
  }
  return { texto: mejor.texto, marcas }
}

/**
 * Arma el buscador sobre los artículos. `textoExtra` suma texto propio de un artículo que no está
 * en sus bloques (por ejemplo, el resumen del paso que explica).
 */
export function crearBuscador(
  articulos: ArticuloAyuda[],
  textoExtra: (a: ArticuloAyuda) => string[] = () => [],
): (consulta: string) => Busqueda {
  const docs: Documento[] = articulos.map((a) => {
    const cuerpo = [...a.bloques.flatMap(textosDeBloque), ...textoExtra(a)]
    return {
      articulo: a,
      campos: {
        codigos: (a.codigos ?? []).flatMap(raices),
        titulo: raices(a.titulo),
        claves: a.claves.flatMap(raices),
        resumen: raices(a.resumen),
        cuerpo: cuerpo.flatMap(raices),
      },
      oraciones: oraciones([a.resumen, ...cuerpo]),
      largoTitulo: normalizar(a.titulo)
        .split(' ')
        .filter((w) => w && !VACIAS.has(w)).length,
    }
  })
  // Palabras conocidas (forma normalizada) por raíz, para proponer correcciones.
  const vocabulario = new Map<string, string>()
  for (const a of articulos) {
    const textos = [a.titulo, a.resumen, ...a.claves, ...a.bloques.flatMap(textosDeBloque)]
    for (const p of normalizar(textos.join(' ')).split(' ')) {
      if (p.length >= 4 && !vocabulario.has(raiz(p))) vocabulario.set(raiz(p), p)
    }
  }

  return (consulta: string): Busqueda => {
    const cod = extraerCodigo(consulta)
    const cs = conceptos(cod ? cod.resto : consulta)
    if (!cod && cs.length === 0)
      return { resultados: [], parcial: false, sugerencia: null, codigo: null }

    const puntuados = docs.map((doc) => {
      const porConcepto = cs.map((c) => puntajeConcepto(c, doc))
      const conCodigo = cod && doc.articulo.codigos?.includes(cod.codigo) ? 100 : 0
      // Un título cubierto casi entero por la consulta es lo que se buscaba.
      const enTitulo = cs.filter((c) =>
        c.alternativas.some((alt) => alt.every((s) => calidad(s, doc.campos.titulo) > 0)),
      ).length
      const cobertura = doc.largoTitulo > 0 ? Math.min(1, enTitulo / doc.largoTitulo) * 3 : 0
      // Sin un código en la consulta, los mensajes de error van después de las explicaciones.
      const factor = !cod && doc.articulo.categoria === 'mensajes' ? 0.85 : 1
      const base = porConcepto.reduce((s, p) => s + p, 0) + (enTitulo > 0 ? cobertura : 0)
      return {
        doc,
        encontrados: porConcepto.filter((p) => p > 0).length,
        puntaje: conCodigo + base * factor,
        conCodigo,
      }
    })
    const completos = puntuados.filter(
      (p) =>
        (cs.length === 0 || p.encontrados === cs.length) &&
        (!cod || p.conCodigo > 0 || cs.length > 0),
    )
    const parcial = completos.length === 0
    const elegidos = (
      parcial
        ? puntuados.filter((p) => p.encontrados > 0 && p.encontrados * 2 >= cs.length)
        : completos
    ).filter((p) => p.puntaje > 0)
    elegidos.sort(
      (x, y) => y.puntaje - x.puntaje || x.doc.articulo.titulo.localeCompare(y.doc.articulo.titulo),
    )

    // ¿Quisiste decir…? Para cada palabra que no aparece en ningún artículo, la conocida más cercana.
    let corregida = false
    const sugeridas = cs.map((c) => {
      if (c.alternativas.length > 1 || docs.some((d) => puntajeConcepto(c, d) > 0)) {
        return c.palabras.join(' ')
      }
      const palabra = c.palabras[0]!
      let mejor: { p: string; d: number } | null = null
      for (const [r, p] of vocabulario) {
        const d = distancia(raiz(palabra), r, 2)
        if (d <= 2 && (!mejor || d < mejor.d)) mejor = { p, d }
      }
      if (mejor) corregida = true
      return mejor ? mejor.p : palabra
    })

    return {
      resultados: elegidos.map((p) => ({
        articulo: p.doc.articulo,
        puntaje: p.puntaje,
        fragmento: fragmento(p.doc, cs),
      })),
      parcial: parcial && elegidos.length > 0,
      sugerencia: corregida ? sugeridas.join(' ') : null,
      codigo: cod?.codigo ?? null,
    }
  }
}
