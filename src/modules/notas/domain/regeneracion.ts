/**
 * Regeneración de las notas desde los rubros clasificados. Puro: arma un PLAN con todo lo que
 * cambiaría (notas y filas nuevas, importes del ejercicio actual, filas que ya no son cuentas,
 * textos distintos del estándar) y el usuario elige qué aplicar. Nada que haya cargado a mano se
 * borra o se pisa si no lo elige.
 *
 * Reglas de la generación (del modelo de balance del estudio):
 *  - Una nota por rubro con cuentas clasificadas, en el orden de los rubros. Los rubros de PN, los
 *    grupos de gasto y las secciones del EERR que van al Anexo III no generan nota.
 *  - Bienes de uso (rubros con `generaNotaInformativa`) genera una nota de texto.
 *  - Después, siempre, "Cambios en los criterios contables"; y "Hechos posteriores" si está
 *    configurada en la Nota I.
 */

import type { TipoNota } from '@prisma/client'
import type { CuentaContableDTO, RubroBaseSimple } from '@/modules/importaciones/domain/types'
import { claveConcepto, type NotaDTO } from './types'

// ─── Textos y criterios estándar ──────────────────────────────────────────────

/** Etiquetas de CriteriosBienesCambio para el criterio de medición. */
export const CRITERIO_LABEL: Record<string, string> = {
  COSTO_ADQUISICION: 'costo de adquisición',
  ULTIMA_COMPRA: 'costo de la última compra',
  COSTO_REPOSICION: 'costo de reposición',
}

export const TITULO_HECHOS = 'HECHOS POSTERIORES AL CIERRE DEL EJERCICIO'
export const TEXTO_HECHOS_DEFAULT =
  'No existen acontecimientos u operaciones ocurridos entre la fecha de cierre del ejercicio y la de emisión de los presentes estados contables que puedan modificar significativamente la situación patrimonial y financiera de la entidad a la fecha de cierre ni los resultados del presente ejercicio.'

const TITULO_CAMBIOS = 'CAMBIOS EN LOS CRITERIOS CONTABLES'
const TEXTO_CAMBIOS_CRITERIOS =
  'La sociedad ha observado los mismos criterios contables adoptados en el ejercicio anterior.'

// Nota 5 — Bienes de Uso (exacto del PDF página 2)
const TEXTO_BIENES_USO =
  'La composición y evolución del rubro se expone en el Anexo I, que forma parte integrante de los presentes estados contables.\n\n' +
  'Los bienes de uso se miden por el modelo de costo, sobre la base de su costo de adquisición reexpresado en moneda de cierre, neto de las depreciaciones acumuladas correspondientes.\n\n' +
  'Las depreciaciones se calculan por el método lineal, considerando la vida útil estimada de los bienes.\n\n' +
  'La sociedad no aplica el modelo de revaluación para la medición de sus bienes de uso.'

// Apertura de las notas cuantitativas (PDF págs. 2-3): la Nota Nº 2 sin coma, el resto con coma.
const TEXTO_APERTURA_PRIMERA = 'El saldo del rubro a fecha de cierre está compuesto por:'
const TEXTO_APERTURA_ESTANDAR = 'El saldo del rubro a fecha de cierre, está compuesto por:'

// Rubros del EERR que sí generan nota, con el título exacto del PDF (pág. 3).
const TITULO_EERR: Partial<Record<string, string>> = {
  INGRESOS: 'INGRESOS NETOS POR LA VENTA DE BIENES Y SERVICIOS',
  COSTO_VENTAS: 'COSTO DE LOS BIENES Y SERVICIOS VENDIDOS',
}

// Secciones del EERR que NO generan nota (van al Anexo III / EERR directo).
const EERR_SIN_NOTA = new Set([
  'GASTOS_ADM',
  'GASTOS_COM',
  'GASTOS_BANCARIOS',
  'IMPUESTOS_CONTRIBUCIONES',
  'RESULTADOS_FINANCIEROS',
  'IMPUESTO_GANANCIAS',
])

/**
 * Bienes de cambio por nombre (sin acentos ni mayúsculas): si cambia el código, sigue andando. La
 * nota lleva el nombre del rubro, así que la misma regla encuentra la nota.
 */
export const PALABRAS_BIENES_DE_CAMBIO = ['bien', 'cambio'] as const

function esRubroBienDeCambio(nombre: string): boolean {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return PALABRAS_BIENES_DE_CAMBIO.every((p) => n.includes(p))
}

type RubroNota = Pick<
  RubroBaseSimple,
  'estadoDestino' | 'seccionEERR' | 'rubroGrupoEsGasto' | 'generaNotaInformativa'
>

/** ¿El rubro, si tiene cuentas, genera nota? (de texto o con detalle por cuenta) */
function generaNota(r: RubroNota): boolean {
  return (
    r.estadoDestino !== 'PN' &&
    !r.rubroGrupoEsGasto &&
    !(r.estadoDestino === 'EERR' && r.seccionEERR && EERR_SIN_NOTA.has(r.seccionEERR))
  )
}

/**
 * ¿El rubro, si tiene cuentas, genera una nota con detalle por cuenta? Con esa nota se carga el
 * ejercicio anterior cuenta por cuenta (ver aplicarAnteriorDesdeNotas).
 */
export function generaNotaCuantitativa(r: RubroNota): boolean {
  return generaNota(r) && !r.generaNotaInformativa
}

/** Configuración de la Nota I que usa la generación. */
export type ConfigNotaI = {
  criteriosBienesCambio?: string | null
  hechosPosterioress?: boolean | null
  hechosPosterioressTexto?: string | null
}

// ─── Lo que la generación quiere que sea cada nota ───────────────────────────

type NotaObjetivo = {
  titulo: string
  tipo: 'INFORMATIVA' | 'CUANTITATIVA'
  criterioMedicion: string | null
  textoApertura: string
  ordenProvisional: number
  /** Cuentas del rubro, por código. Vacío en las notas que no son de un rubro. */
  cuentas: CuentaContableDTO[]
}

const clave = (titulo: string) => titulo.trim().toUpperCase()

function objetivos(
  rubros: RubroBaseSimple[],
  cuentas: CuentaContableDTO[],
  config: ConfigNotaI,
): NotaObjetivo[] {
  const porRubro = new Map<string, CuentaContableDTO[]>()
  for (const c of cuentas) {
    if (!c.rubroBaseId) continue
    const lista = porRubro.get(c.rubroBaseId) ?? []
    lista.push(c)
    porRubro.set(c.rubroBaseId, lista)
  }

  const conNota = rubros
    .filter((r) => porRubro.has(r.id) && generaNota(r))
    .sort((a, b) => a.orden - b.orden)

  const lista: NotaObjetivo[] = conNota.map((rubro, i) => {
    const esInformativa = rubro.generaNotaInformativa
    const esEERR = rubro.estadoDestino === 'EERR'
    const tituloEERR = esEERR && rubro.seccionEERR ? TITULO_EERR[rubro.seccionEERR] : undefined
    // Criterio: sin criterio en las informativas y en el EERR; bienes de cambio según la Nota I
    // (costo de reposición si no está configurado); el resto, valor nominal.
    const criterioMedicion =
      esInformativa || esEERR
        ? null
        : esRubroBienDeCambio(rubro.nombre)
          ? ((config.criteriosBienesCambio
              ? CRITERIO_LABEL[config.criteriosBienesCambio]
              : undefined) ?? 'costo de reposición')
          : 'valor nominal'
    return {
      titulo: tituloEERR ?? rubro.nombre.toUpperCase(),
      tipo: generaNotaCuantitativa(rubro) ? 'CUANTITATIVA' : 'INFORMATIVA',
      criterioMedicion,
      textoApertura: esInformativa
        ? (rubro.textoNotaDefault ?? TEXTO_BIENES_USO)
        : i === 0
          ? TEXTO_APERTURA_PRIMERA
          : TEXTO_APERTURA_ESTANDAR,
      ordenProvisional: i + 1,
      cuentas: [...(porRubro.get(rubro.id) ?? [])].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }
  })

  lista.push({
    titulo: TITULO_CAMBIOS,
    tipo: 'INFORMATIVA',
    criterioMedicion: null,
    textoApertura: TEXTO_CAMBIOS_CRITERIOS,
    ordenProvisional: lista.length + 1,
    cuentas: [],
  })
  if (config.hechosPosterioress) {
    lista.push({
      titulo: TITULO_HECHOS,
      tipo: 'INFORMATIVA',
      criterioMedicion: null,
      textoApertura: config.hechosPosterioressTexto?.trim() || TEXTO_HECHOS_DEFAULT,
      ordenProvisional: lista.length + 1,
      cuentas: [],
    })
  }
  return lista
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

export type FilaNueva = { concepto: string; importeActual: number; orden: number }

export type PlanNotaNueva = {
  titulo: string
  tipo: 'INFORMATIVA' | 'CUANTITATIVA'
  criterioMedicion: string | null
  textoApertura: string
  cuentaIds: string[]
  filas: FilaNueva[]
}

export type PlanNotaExistente = {
  notaId: string
  titulo: string
  tipoActual: TipoNota
  /** Tipo final: estructural, se aplica siempre. */
  tipo: TipoNota
  ordenActual: number
  numeroActual: number | null
  /** Solo si el texto o el criterio son distintos del estándar. */
  textos: { criterioMedicion: string | null; textoApertura: string } | null
  cuentaIdsAVincular: string[]
  filasNuevas: FilaNueva[]
  importesActuales: { detalleId: string; concepto: string; antes: number; despues: number }[]
  filasSinCuenta: { detalleId: string; concepto: string; importeAnterior: number }[]
}

export type PlanRegeneracion = {
  nuevas: PlanNotaNueva[]
  existentes: PlanNotaExistente[]
  /** Orden en que la generación deja las notas, para numerarlas al final. */
  secuencia: { clave: string; ordenProvisional: number }[]
}

/** Saldo de la cuenta como se muestra en la nota. */
const importeEnNota = (c: CuentaContableDTO) => Math.abs(c.saldoFinal)

export function planificarRegeneracion(params: {
  notas: NotaDTO[]
  rubros: RubroBaseSimple[]
  cuentas: CuentaContableDTO[]
  config: ConfigNotaI
}): PlanRegeneracion {
  const { notas, rubros, cuentas, config } = params
  const porTitulo = new Map(notas.map((n) => [clave(n.titulo), n]))
  const usadas = new Set<string>()
  const plan: PlanRegeneracion = { nuevas: [], existentes: [], secuencia: [] }

  for (const obj of objetivos(rubros, cuentas, config)) {
    const nota = porTitulo.get(clave(obj.titulo))
    const cuantitativa = obj.tipo === 'CUANTITATIVA'

    if (!nota) {
      plan.nuevas.push({
        titulo: obj.titulo,
        tipo: obj.tipo,
        criterioMedicion: obj.criterioMedicion,
        textoApertura: obj.textoApertura,
        cuentaIds: obj.cuentas.map((c) => c.id),
        filas: cuantitativa
          ? obj.cuentas.map((c, i) => ({
              concepto: c.nombre,
              importeActual: importeEnNota(c),
              orden: i + 1,
            }))
          : [],
      })
      plan.secuencia.push({ clave: `n:${obj.titulo}`, ordenProvisional: obj.ordenProvisional })
      continue
    }

    usadas.add(nota.id)
    const textosDistintos =
      nota.criterioMedicion !== obj.criterioMedicion || nota.textoApertura !== obj.textoApertura
    const existente: PlanNotaExistente = {
      notaId: nota.id,
      titulo: nota.titulo,
      tipoActual: nota.tipo,
      tipo: obj.tipo,
      ordenActual: nota.orden,
      numeroActual: nota.numero,
      textos: textosDistintos
        ? { criterioMedicion: obj.criterioMedicion, textoApertura: obj.textoApertura }
        : null,
      cuentaIdsAVincular: obj.cuentas.filter((c) => c.notaEjercicioId !== nota.id).map((c) => c.id),
      filasNuevas: [],
      importesActuales: [],
      filasSinCuenta: [],
    }

    if (cuantitativa) {
      const filas = nota.detalles.filter((d) => !d.esTotal)
      const porConcepto = new Map(filas.map((d) => [claveConcepto(d.concepto), d]))
      const nombres = new Set(obj.cuentas.map((c) => claveConcepto(c.nombre)))
      const maxOrden = nota.detalles.length > 0 ? Math.max(...nota.detalles.map((d) => d.orden)) : 0
      obj.cuentas.forEach((c, i) => {
        const fila = porConcepto.get(claveConcepto(c.nombre))
        const despues = importeEnNota(c)
        if (!fila) {
          existente.filasNuevas.push({
            concepto: c.nombre,
            importeActual: despues,
            orden: maxOrden + i + 1,
          })
        } else if (fila.importeActual !== despues) {
          existente.importesActuales.push({
            detalleId: fila.id,
            concepto: fila.concepto,
            antes: fila.importeActual,
            despues,
          })
        }
      })
      existente.filasSinCuenta = filas
        .filter((d) => !nombres.has(claveConcepto(d.concepto)))
        .map((d) => ({ detalleId: d.id, concepto: d.concepto, importeAnterior: d.importeAnterior }))
    }

    plan.existentes.push(existente)
    plan.secuencia.push({ clave: `e:${nota.id}`, ordenProvisional: obj.ordenProvisional })
  }

  // Las notas que no son de ningún rubro (por ejemplo, la de transición a la RT 54) se quedan
  // donde están y solo se renumeran.
  for (const nota of notas) {
    if (usadas.has(nota.id)) continue
    plan.existentes.push({
      notaId: nota.id,
      titulo: nota.titulo,
      tipoActual: nota.tipo,
      tipo: nota.tipo,
      ordenActual: nota.orden,
      numeroActual: nota.numero,
      textos: null,
      cuentaIdsAVincular: [],
      filasNuevas: [],
      importesActuales: [],
      filasSinCuenta: [],
    })
    plan.secuencia.push({ clave: `e:${nota.id}`, ordenProvisional: nota.orden })
  }
  return plan
}

// ─── Opciones ─────────────────────────────────────────────────────────────────

export type OpcionesRegeneracion = {
  notasNuevas: boolean
  filasNuevas: boolean
  importesActuales: boolean
  /** Filas que ya no son cuentas del rubro y no tienen importe anterior. */
  quitarFilasSinCuenta: boolean
  /** Filas que ya no son cuentas del rubro pero tienen importe anterior: se pierde ese importe. */
  quitarFilasConAnterior: boolean
  restaurarTextos: boolean
}

/** Lo que agrega o actualiza desde el balance, sí; lo que borra o pisa algo cargado a mano, no. */
export const OPCIONES_POR_DEFECTO: OpcionesRegeneracion = {
  notasNuevas: true,
  filasNuevas: true,
  importesActuales: true,
  quitarFilasSinCuenta: true,
  quitarFilasConAnterior: false,
  restaurarTextos: false,
}

/** ¿Se quita esta fila sin cuenta con estas opciones? */
export function seQuitaFila(fila: { importeAnterior: number }, op: OpcionesRegeneracion): boolean {
  return fila.importeAnterior === 0 ? op.quitarFilasSinCuenta : op.quitarFilasConAnterior
}

/**
 * Orden y número final de cada nota: todas en el orden en que las deja la generación (las que no
 * son de un rubro, en su lugar), numeradas desde la Nota 2 (la 1 son los criterios contables).
 */
export function numeracionFinal(
  plan: PlanRegeneracion,
  op: OpcionesRegeneracion,
): Map<string, { orden: number; numero: number }> {
  const entradas = plan.secuencia
    .filter((e) => op.notasNuevas || !e.clave.startsWith('n:'))
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.ordenProvisional - b.ordenProvisional || a.i - b.i)
  return new Map(entradas.map((e, i) => [e.clave, { orden: i + 1, numero: i + 2 }]))
}

// ─── Resumen para el usuario ──────────────────────────────────────────────────

export type ItemResumen = { nota: string; detalle?: string; importe?: number }

export type GrupoResumen = {
  clave: keyof OpcionesRegeneracion
  titulo: string
  descripcion: string
  items: ItemResumen[]
}

export type ResumenRegeneracion = {
  grupos: GrupoResumen[]
  /** Cambia el orden, el número o el tipo de alguna nota (se aplica siempre). */
  reordena: boolean
}

export function resumirPlan(plan: PlanRegeneracion): ResumenRegeneracion {
  const ex = plan.existentes
  const sinCuenta = ex.flatMap((n) =>
    n.filasSinCuenta.map((f) => ({
      nota: n.titulo,
      detalle: f.concepto,
      importe: f.importeAnterior,
    })),
  )
  const grupos: GrupoResumen[] = [
    {
      clave: 'notasNuevas',
      titulo: 'Notas nuevas',
      descripcion: 'Rubros con cuentas que todavía no tienen nota.',
      items: plan.nuevas.map((n) => ({ nota: n.titulo })),
    },
    {
      clave: 'filasNuevas',
      titulo: 'Filas nuevas',
      descripcion: 'Cuentas del balance que todavía no figuran en su nota.',
      items: ex.flatMap((n) => n.filasNuevas.map((f) => ({ nota: n.titulo, detalle: f.concepto }))),
    },
    {
      clave: 'importesActuales',
      titulo: 'Importes del ejercicio actual',
      descripcion: 'Se reemplazan por el saldo de cada cuenta en el balance.',
      items: ex.flatMap((n) =>
        n.importesActuales.map((f) => ({
          nota: n.titulo,
          detalle: f.concepto,
          importe: f.despues,
        })),
      ),
    },
    {
      clave: 'quitarFilasSinCuenta',
      titulo: 'Quitar filas que ya no son cuentas del rubro',
      descripcion:
        'Su concepto no es una cuenta del rubro en el balance (por ejemplo, se reclasificó) y no tienen importe del ejercicio anterior.',
      items: sinCuenta
        .filter((f) => f.importe === 0)
        .map(({ nota, detalle }) => ({ nota, detalle })),
    },
    {
      clave: 'quitarFilasConAnterior',
      titulo: 'Quitar filas con importe del ejercicio anterior',
      descripcion:
        'Tampoco son cuentas del rubro en el balance (por ejemplo, un banco que se cerró durante el año), pero tienen importe del ejercicio anterior. Si las quitás, ese importe se pierde y se anula la autorización del comparativo.',
      items: sinCuenta.filter((f) => f.importe !== 0),
    },
    {
      clave: 'restaurarTextos',
      titulo: 'Volver al texto estándar',
      descripcion:
        'El texto de apertura o el criterio de medición es distinto del estándar: lo editaste, o cambió el estándar. Si lo marcás, se reemplaza por el estándar.',
      items: ex.filter((n) => n.textos).map((n) => ({ nota: n.titulo })),
    },
  ]

  const numeracion = numeracionFinal(plan, OPCIONES_POR_DEFECTO)
  const reordena = ex.some((n) => {
    const final = numeracion.get(`e:${n.notaId}`)
    return (
      n.tipo !== n.tipoActual || final?.orden !== n.ordenActual || final?.numero !== n.numeroActual
    )
  })
  return { grupos: grupos.filter((g) => g.items.length > 0), reordena }
}
