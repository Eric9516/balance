import { cache } from 'react'
import { Prisma, type TipoNota } from '@prisma/client'
import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toNotaDTO, type NotaDTO } from '../domain/types'
import {
  numeracionFinal,
  seQuitaFila,
  type OpcionesRegeneracion,
  type PlanRegeneracion,
} from '../domain/regeneracion'

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Memoizado por request (React cache): la página, los estados y el documento lo piden en el
 * mismo render. Solo lo usan lecturas; ninguna acción lo lee antes y después de escribir.
 *
 * Las notas y sus detalles se piden EN PARALELO (un solo viaje a la base): con `include`,
 * Prisma pediría los detalles en una segunda consulta, después de la primera.
 */
export const findNotasByEjercicio = cache(async (ejercicioId: string): Promise<NotaDTO[]> => {
  const [notas, detalles] = await Promise.all([
    db.notaEjercicio.findMany({ where: { ejercicioId }, orderBy: [{ orden: 'asc' }] }),
    db.detalleNota.findMany({
      where: { nota: { ejercicioId } },
      orderBy: [{ notaEjercicioId: 'asc' }, { orden: 'asc' }],
    }),
  ])
  const porNota = new Map<string, typeof detalles>()
  for (const d of detalles) {
    const lista = porNota.get(d.notaEjercicioId)
    if (lista) lista.push(d)
    else porNota.set(d.notaEjercicioId, [d])
  }
  return notas.map((n) => toNotaDTO({ ...n, detalles: porNota.get(n.id) ?? [] }))
})

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

export type CambiosNota = {
  titulo?: string
  numero?: number | null
  criterioMedicion?: string | null
  textoApertura?: string | null
}

const noEncontrado = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'

/**
 * Modifica una nota solo si es de este ejercicio (está en la condición: una nota ajena no
 * matchea) y solo con las columnas que se editan. Devuelve null si no la encuentra.
 */
export async function updateNota(
  ejercicioId: string,
  id: string,
  cambios: CambiosNota,
): Promise<NotaDTO | null> {
  if (!esUuid(id)) return null
  try {
    const nota = await db.notaEjercicio.update({
      where: { id, ejercicioId },
      data: {
        titulo: cambios.titulo,
        numero: cambios.numero,
        criterioMedicion: cambios.criterioMedicion,
        textoApertura: cambios.textoApertura,
      },
      include: { detalles: { orderBy: { orden: 'asc' } } },
    })
    return toNotaDTO(nota)
  } catch (e) {
    if (noEncontrado(e)) return null
    throw e
  }
}

/** Borra una nota solo si es de este ejercicio. Devuelve si borró. */
export async function deleteNota(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.notaEjercicio.deleteMany({ where: { id, ejercicioId } })
  return count > 0
}

/** ¿La nota es de este ejercicio? Responde que no ante un identificador inválido. */
export async function esNotaDelEjercicio(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const nota = await db.notaEjercicio.findFirst({
    where: { id, ejercicioId },
    select: { id: true },
  })
  return nota !== null
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

export type CambiosDetalle = { concepto?: string; importeActual?: number; importeAnterior?: number }

/**
 * Modifica un detalle solo si su nota es de este ejercicio y solo con las columnas que se
 * editan. Devuelve si lo encontró.
 */
export async function updateDetalle(
  ejercicioId: string,
  id: string,
  cambios: CambiosDetalle,
): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.detalleNota.updateMany({
    where: { id, nota: { ejercicioId } },
    data: {
      concepto: cambios.concepto,
      importeActual: cambios.importeActual,
      importeAnterior: cambios.importeAnterior,
    },
  })
  return count > 0
}

/** Borra un detalle solo si su nota es de este ejercicio. Devuelve si borró. */
export async function deleteDetalle(ejercicioId: string, id: string): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.detalleNota.deleteMany({ where: { id, nota: { ejercicioId } } })
  return count > 0
}

// ─── Regeneración desde rubros clasificados ───────────────────────────────────

/**
 * Aplica el plan de regeneración (ver domain/regeneracion) con las opciones elegidas, en una sola
 * transacción y tocando solo lo que cambia. Siempre: tipo de nota, vínculo de las cuentas con su
 * nota, orden y numeración. Devuelve si se quitó alguna fila con importe del ejercicio anterior.
 */
export async function aplicarRegeneracion(
  ejercicioId: string,
  plan: PlanRegeneracion,
  op: OpcionesRegeneracion,
): Promise<{ quitoAnterior: boolean }> {
  const numeracion = numeracionFinal(plan, op)
  const nuevas = op.notasNuevas ? plan.nuevas : []
  const quitar = plan.existentes.flatMap((n) => n.filasSinCuenta.filter((f) => seQuitaFila(f, op)))

  await db.$transaction(
    async (tx) => {
      // Notas nuevas, ya con su orden y número final.
      const creadas =
        nuevas.length === 0
          ? []
          : await tx.notaEjercicio.createManyAndReturn({
              data: nuevas.map((n) => ({
                ejercicioId,
                titulo: n.titulo,
                tipo: n.tipo,
                criterioMedicion: n.criterioMedicion,
                textoApertura: n.textoApertura,
                orden: numeracion.get(`n:${n.titulo}`)?.orden ?? 0,
                numero: numeracion.get(`n:${n.titulo}`)?.numero ?? null,
              })),
              select: { id: true, titulo: true },
            })
      const idNueva = new Map(creadas.map((c) => [c.titulo, c.id]))

      // Notas existentes: solo las que cambian.
      for (const n of plan.existentes) {
        const final = numeracion.get(`e:${n.notaId}`)
        const textos = op.restaurarTextos ? n.textos : null
        const cambia =
          n.tipo !== n.tipoActual ||
          final?.orden !== n.ordenActual ||
          final?.numero !== n.numeroActual ||
          textos !== null
        if (!cambia) continue
        await tx.notaEjercicio.update({
          where: { id: n.notaId },
          data: {
            tipo: n.tipo,
            orden: final?.orden,
            numero: final?.numero,
            ...(textos ?? {}),
          },
        })
      }

      if (quitar.length > 0) {
        await tx.detalleNota.deleteMany({
          where: { id: { in: quitar.map((f) => f.detalleId) }, nota: { ejercicioId } },
        })
      }
      if (op.importesActuales) {
        for (const f of plan.existentes.flatMap((n) => n.importesActuales)) {
          await tx.detalleNota.update({
            where: { id: f.detalleId },
            data: { importeActual: f.despues },
          })
        }
      }

      const filas = [
        ...nuevas.flatMap((n) =>
          n.filas.map((f) => ({ ...f, notaEjercicioId: idNueva.get(n.titulo)! })),
        ),
        ...(op.filasNuevas
          ? plan.existentes.flatMap((n) =>
              n.filasNuevas.map((f) => ({ ...f, notaEjercicioId: n.notaId })),
            )
          : []),
      ]
      if (filas.length > 0) {
        await tx.detalleNota.createMany({
          data: filas.map((f) => ({ ...f, importeAnterior: 0, esTotal: false })),
        })
      }

      // Cada cuenta, vinculada a la nota de su rubro.
      const vinculos = [
        ...nuevas.map((n) => ({ notaId: idNueva.get(n.titulo)!, cuentaIds: n.cuentaIds })),
        ...plan.existentes.map((n) => ({ notaId: n.notaId, cuentaIds: n.cuentaIdsAVincular })),
      ]
      for (const v of vinculos) {
        if (v.cuentaIds.length === 0) continue
        await tx.cuentaContable.updateMany({
          where: { id: { in: v.cuentaIds }, ejercicioId },
          data: { notaEjercicioId: v.notaId },
        })
      }
    },
    // Sin llamadas externas: solo escrituras de este ejercicio, pero pueden ser muchas.
    { timeout: 30_000 },
  )
  return { quitoAnterior: quitar.some((f) => f.importeAnterior !== 0) }
}
