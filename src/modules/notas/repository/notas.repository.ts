import { db } from '@/lib/db'
import type { TipoNota } from '@prisma/client'
import { toNotaDTO, type NotaDTO } from '../domain/types'
import type { CuentaContableDTO, RubroBaseSimple } from '@/modules/importaciones/domain/types'

// ─── Criterios de medición por defecto (del PDF página 3) ─────────────────────
// "Generalmente todos son a valor nominal, menos bienes de cambio que es
//  por costo de reposición y los bienes de uso por su costo de adquisición."

// Etiquetas para CriteriosBienesCambio
const CRITERIO_LABEL: Record<string, string> = {
  COSTO_ADQUISICION: 'costo de adquisición',
  ULTIMA_COMPRA:     'costo de la última compra',
  COSTO_REPOSICION:  'costo de reposición',
}

// Detecta si un rubro es "bienes de cambio" por nombre (case-insensitive)
// independiente del código — si el usuario cambia el código, sigue funcionando
function esRubroBienDeCambio(nombre: string): boolean {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n.includes('bien') && n.includes('cambio')
}

// Configuración de Nota I por ejercicio
export type ConfigNotaI = {
  criteriosBienesCambio?: string | null
  hechosPosterioress?: boolean | null
  hechosPosterioressTexto?: string | null
}

// ─── Texto para Nota 5 — Bienes de Uso (exacto del PDF página 2) ──────────────

const TEXTO_BIENES_USO =
  'La composición y evolución del rubro se expone en el Anexo I, que forma parte integrante de los presentes estados contables.\n\n' +
  'Los bienes de uso se miden por el modelo de costo, sobre la base de su costo de adquisición reexpresado en moneda de cierre, neto de las depreciaciones acumuladas correspondientes.\n\n' +
  'Las depreciaciones se calculan por el método lineal, considerando la vida útil estimada de los bienes.\n\n' +
  'La sociedad no aplica el modelo de revaluación para la medición de sus bienes de uso.'

// ─── Texto para Nota 11 — Cambios en Criterios Contables (exacto del PDF) ────

const TEXTO_CAMBIOS_CRITERIOS =
  'La sociedad ha observado los mismos criterios contables adoptados en el ejercicio anterior.'

// ─── Texto apertura para notas cuantitativas (PDF págs. 2-3) ──────────────────
// Nota Nº 2: sin coma. Resto: con coma. (Exacto del PDF del estudio)

const TEXTO_APERTURA_PRIMERA  = 'El saldo del rubro a fecha de cierre está compuesto por:'
const TEXTO_APERTURA_ESTANDAR = 'El saldo del rubro a fecha de cierre, está compuesto por:'

// ─── Títulos exactos para rubros EERR que sí generan nota ────────────────────
// Según PDF pág. 3: Nota 9 y 10 tienen títulos distintos al nombre del rubro

const TITULO_EERR: Partial<Record<string, string>> = {
  INGRESOS:     'INGRESOS NETOS POR LA VENTA DE BIENES Y SERVICIOS',
  COSTO_VENTAS: 'COSTO DE LOS BIENES Y SERVICIOS VENDIDOS',
}

// ─── SeccionEERR que NO generan nota (van al Anexo III / EERR directo) ────────

const EERR_SIN_NOTA = new Set([
  'GASTOS_ADM',
  'GASTOS_COM',
  'GASTOS_BANCARIOS',
  'IMPUESTOS_CONTRIBUCIONES',
  'RESULTADOS_FINANCIEROS',
  'IMPUESTO_GANANCIAS',
])

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function findNotasByEjercicio(ejercicioId: string): Promise<NotaDTO[]> {
  const notas = await db.notaEjercicio.findMany({
    where: { ejercicioId },
    include: { detalles: { orderBy: { orden: 'asc' } } },
    orderBy: [{ orden: 'asc' }],
  })
  return notas.map(toNotaDTO)
}

export async function createNota(data: {
  ejercicioId: string
  titulo: string
  tipo: TipoNota
  numero?: number | null
  orden: number
  criterioMedicion?: string | null
  textoApertura?: string | null
}): Promise<NotaDTO> {
  const nota = await db.notaEjercicio.create({
    data: {
      ejercicioId: data.ejercicioId,
      titulo: data.titulo,
      tipo: data.tipo,
      numero: data.numero ?? null,
      orden: data.orden,
      criterioMedicion: data.criterioMedicion ?? null,
      textoApertura: data.textoApertura ?? null,
    },
    include: { detalles: { orderBy: { orden: 'asc' } } },
  })
  return toNotaDTO(nota)
}

export async function updateNota(
  id: string,
  data: {
    titulo?: string
    numero?: number | null
    criterioMedicion?: string | null
    textoApertura?: string | null
  },
): Promise<NotaDTO> {
  const nota = await db.notaEjercicio.update({
    where: { id },
    data,
    include: { detalles: { orderBy: { orden: 'asc' } } },
  })
  return toNotaDTO(nota)
}

export async function deleteNota(id: string): Promise<void> {
  await db.notaEjercicio.delete({ where: { id } })
}

export async function renumerarNotas(ejercicioId: string): Promise<void> {
  const notas = await db.notaEjercicio.findMany({
    where: { ejercicioId },
    orderBy: { orden: 'asc' },
    select: { id: true },
  })
  let numero = 2
  let orden = 1
  for (const nota of notas) {
    await db.notaEjercicio.update({ where: { id: nota.id }, data: { numero, orden } })
    numero++
    orden++
  }
}

export async function createDetalle(data: {
  notaEjercicioId: string
  concepto: string
  importeActual: number
  importeAnterior: number
  esTotal: boolean
  orden: number
}) {
  return db.detalleNota.create({ data })
}

export async function updateDetalle(
  id: string,
  data: { concepto?: string; importeActual?: number; importeAnterior?: number },
) {
  return db.detalleNota.update({ where: { id }, data })
}

export async function deleteDetalle(id: string): Promise<void> {
  await db.detalleNota.delete({ where: { id } })
}

// ─── Auto-generación desde rubros clasificados ────────────────────────────────
// Crea una nota por cada rubro que tenga cuentas clasificadas.
// Rubros de PN no generan nota (capital, reservas, etc.).
// Bienes de Uso genera nota de texto (tipo INFORMATIVA).
// Al final siempre agrega la nota de Cambios en Criterios Contables.

export async function generarNotasDesdeRubros(
  ejercicioId: string,
  rubros: RubroBaseSimple[],
  cuentas: CuentaContableDTO[],
  config: ConfigNotaI = {},
): Promise<void> {
  const notasExistentes = await db.notaEjercicio.findMany({
    where: { ejercicioId },
    include: { detalles: { orderBy: { orden: 'asc' } } },
    orderBy: { orden: 'asc' },
  })
  const notasPorTitulo = new Map(
    notasExistentes.map((n) => [n.titulo.trim().toUpperCase(), n]),
  )

  // Agrupar cuentas por rubro, ordenadas por código
  const byRubro = new Map<string, CuentaContableDTO[]>()
  for (const c of cuentas.filter((c) => c.rubroBaseId)) {
    const list = byRubro.get(c.rubroBaseId!) ?? []
    list.push(c)
    byRubro.set(c.rubroBaseId!, list)
  }

  // Solo los rubros que tienen cuentas, en el orden del PDF (por rubro.orden)
  // Excluir rubros de PN (no generan notas de composición)
  const rubrosConCuentas = rubros
    .filter((r) =>
      byRubro.has(r.id) &&
      r.estadoDestino !== 'PN' &&
      !r.rubroGrupoEsGasto &&
      !(r.estadoDestino === 'EERR' && r.seccionEERR && EERR_SIN_NOTA.has(r.seccionEERR))
    )
    .sort((a, b) => a.orden - b.orden)

  let numeroNota = 2
  let ordenNota = 1

  for (const rubro of rubrosConCuentas) {
    const cuentasRubro = [...(byRubro.get(rubro.id) ?? [])].sort((a, b) =>
      a.codigo.localeCompare(b.codigo),
    )

    // Usa el flag del rubro — no depende del código
    const esInformativa = rubro.generaNotaInformativa
    const esEERR = rubro.estadoDestino === 'EERR'
    const tipo: TipoNota = esInformativa ? 'INFORMATIVA' : 'CUANTITATIVA'

    // Título: para EERR usar el título exacto del PDF; para el resto, nombre del rubro
    const titulo = esEERR && rubro.seccionEERR && TITULO_EERR[rubro.seccionEERR]
      ? TITULO_EERR[rubro.seccionEERR]!
      : rubro.nombre.toUpperCase()

    // Criterio:
    // - Notas informativas (bienes de uso) y EERR: sin criterio en la línea
    // - Bienes de cambio: usa config del ejercicio (o 'costo de reposición' como fallback)
    // - Resto: 'valor nominal'
    const criterioMedicion = esInformativa || esEERR
      ? null
      : esRubroBienDeCambio(rubro.nombre)
        ? (config.criteriosBienesCambio ? (CRITERIO_LABEL[config.criteriosBienesCambio] ?? 'costo de reposición') : 'costo de reposición')
        : 'valor nominal'

    // textoApertura: INFORMATIVA usa el texto del rubro (o fallback); Nota 2 sin coma; resto con coma
    const textoApertura = esInformativa
      ? (rubro.textoNotaDefault ?? TEXTO_BIENES_USO)
      : numeroNota === 2
        ? TEXTO_APERTURA_PRIMERA
        : TEXTO_APERTURA_ESTANDAR

    const notaExistente = notasPorTitulo.get(titulo.trim().toUpperCase())
    const nota = notaExistente
      ? await db.notaEjercicio.update({
          where: { id: notaExistente.id },
          data: {
            tipo,
            orden: ordenNota,
            criterioMedicion,
            textoApertura,
          },
        })
      : await db.notaEjercicio.create({
          data: {
            ejercicioId,
            titulo,
            tipo,
            numero: numeroNota,
            orden: ordenNota,
            criterioMedicion,
            textoApertura,
          },
        })

    // Vincular cuentas a esta nota
    await db.cuentaContable.updateMany({
      where: { id: { in: cuentasRubro.map((c) => c.id) } },
      data: { notaEjercicioId: nota.id },
    })

    // Sincronizar detalles para notas cuantitativas:
    // - Actualiza importeActual de filas que coinciden con una cuenta actual (por concepto)
    // - Agrega filas para cuentas nuevas sin fila
    // - Elimina filas cuyo concepto no coincide con ninguna cuenta actual del rubro
    //   (la cuenta fue reclasificada)
    // - Preserva filas con esTotal=true (totales manuales)
    if (tipo === 'CUANTITATIVA') {
      const existingDetalles = notaExistente?.detalles ?? []
      const cuentasKeys = new Set(cuentasRubro.map((c) => c.nombre.trim().toLowerCase()))

      const byConcepto = new Map(
        existingDetalles
          .filter((d) => !d.esTotal)
          .map((d) => [d.concepto.trim().toLowerCase(), d]),
      )
      const maxOrden = existingDetalles.length > 0
        ? Math.max(...existingDetalles.map((d) => d.orden))
        : 0

      // Eliminar filas de cuentas que ya no están clasificadas en este rubro
      const stalIds = existingDetalles
        .filter((d) => !d.esTotal && !cuentasKeys.has(d.concepto.trim().toLowerCase()))
        .map((d) => d.id)
      if (stalIds.length > 0) {
        await db.detalleNota.deleteMany({ where: { id: { in: stalIds } } })
      }

      for (let i = 0; i < cuentasRubro.length; i++) {
        const c = cuentasRubro[i]
        const key = c.nombre.trim().toLowerCase()
        const existing = byConcepto.get(key)

        if (existing) {
          // Ya existe: solo actualiza el importe actual (saldo puede haber cambiado)
          await db.detalleNota.update({
            where: { id: existing.id },
            data: { importeActual: Math.abs(c.saldoFinal) },
          })
        } else {
          // Cuenta nueva clasificada después de la última generación: agregar fila
          await db.detalleNota.create({
            data: {
              notaEjercicioId: nota.id,
              concepto: c.nombre,
              importeActual: Math.abs(c.saldoFinal),
              importeAnterior: 0,
              esTotal: false,
              orden: maxOrden + i + 1,
            },
          })
        }
      }
    }

    numeroNota++
    ordenNota++
  }

  // Nota penúltima: Cambios en Criterios Contables (siempre la misma)
  const tituloCambios = 'CAMBIOS EN LOS CRITERIOS CONTABLES'
  const notaCambios = notasPorTitulo.get(tituloCambios)
  if (notaCambios) {
    await db.notaEjercicio.update({
      where: { id: notaCambios.id },
      data: {
        tipo: 'INFORMATIVA',
        orden: ordenNota,
        criterioMedicion: null,
        textoApertura: TEXTO_CAMBIOS_CRITERIOS,
      },
    })
  } else {
    await db.notaEjercicio.create({
      data: {
        ejercicioId,
        titulo: tituloCambios,
        tipo: 'INFORMATIVA',
        numero: numeroNota,
        orden: ordenNota,
        criterioMedicion: null,
        textoApertura: TEXTO_CAMBIOS_CRITERIOS,
      },
    })
  }
  numeroNota++
  ordenNota++

  // Nota final: Hechos Posteriores (solo si está configurada)
  if (config.hechosPosterioress) {
    const tituloHechos = 'HECHOS POSTERIORES AL CIERRE DEL EJERCICIO'
    const textoHechos =
      config.hechosPosterioressTexto?.trim() ||
      'No existen acontecimientos u operaciones ocurridos entre la fecha de cierre del ejercicio y la de emisión de los presentes estados contables que puedan modificar significativamente la situación patrimonial y financiera de la entidad a la fecha de cierre ni los resultados del presente ejercicio.'
    const notaHechos = notasPorTitulo.get(tituloHechos)
    if (notaHechos) {
      await db.notaEjercicio.update({
        where: { id: notaHechos.id },
        data: {
          tipo: 'INFORMATIVA',
          orden: ordenNota,
          criterioMedicion: null,
          textoApertura: textoHechos,
        },
      })
    } else {
      await db.notaEjercicio.create({
        data: {
          ejercicioId,
          titulo: tituloHechos,
          tipo: 'INFORMATIVA',
          numero: numeroNota,
          orden: ordenNota,
          criterioMedicion: null,
          textoApertura: textoHechos,
        },
      })
    }
  }

  await renumerarNotas(ejercicioId)
}
