/**
 * Datos sintéticos para medir rendimiento: un estudio con N sociedades, cada una con su cadena
 * de ejercicios vinculados año a año, y en cada ejercicio todo lo que la app lee al trabajar:
 * cuentas clasificadas, E.E.P.N., bienes de uso, costo de ventas, flujo, notas, anexos,
 * validaciones y la importación de origen.
 *
 * Se siembra con Prisma (nombres de modelo y campo, no de columna) para que la misma medición
 * siga sirviendo cuando cambien los nombres de columnas, los tipos o las claves (Fase 0).
 * Es reproducible: usa un generador pseudoaleatorio con semilla fija.
 */
import type { PrismaClient, Prisma, TipoMovimientoPN } from '@prisma/client'
import { REGLAS } from '@/modules/documentos/domain/reglas'

export type Escala = {
  sociedades: number
  ejerciciosPorSociedad: number
  cuentasPorEjercicio: number
}

/** "grande" representa un estudio muy grande: mil sociedades con quince años de historia. */
export const ESCALAS = {
  rapida: { sociedades: 20, ejerciciosPorSociedad: 5, cuentasPorEjercicio: 500 },
  media: { sociedades: 200, ejerciciosPorSociedad: 10, cuentasPorEjercicio: 800 },
  grande: { sociedades: 1000, ejerciciosPorSociedad: 15, cuentasPorEjercicio: 1500 },
} as const satisfies Record<string, Escala>

export type NombreEscala = keyof typeof ESCALAS

export type Sembrado = {
  estudioId: string
  /** Ejercicio en curso de una sociedad del medio, con toda la cadena de anteriores vinculada. */
  objetivo: { sociedadId: string; ejercicioId: string }
  /** Otro ejercicio en curso, para medir escrituras sin alterar el objetivo. */
  escritura: { ejercicioId: string; importacionId: string }
  filas: Record<string, number>
  segundos: number
}

const MOVIMIENTOS_PN: TipoMovimientoPN[] = [
  'SALDO_INICIO',
  'AJUSTE_INFLACION',
  'MODIFICACION_INICIO',
  'DISTRIB_HONORARIOS',
  'DISTRIB_DIVIDENDOS',
  'DISTRIB_RESERVA_LEGAL',
  'DISTRIB_OTRAS_RESERVAS',
  'DISTRIB_APORTES_IRREVOCABLES',
  'RESULTADO_EJERCICIO',
]
const CATEGORIAS_BDU = ['Inmuebles', 'Rodados', 'Muebles y útiles', 'Maquinarias', 'Instalaciones']
const SECCIONES_FLUJO = [
  'ACTIVIDADES_OPERATIVAS',
  'ACTIVIDADES_INVERSION',
  'ACTIVIDADES_FINANCIAMIENTO',
] as const

/** Generador pseudoaleatorio reproducible (mulberry32). */
function generador(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function enTandas<T>(items: T[], tamanio: number): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < items.length; i += tamanio) tandas.push(items.slice(i, i + tamanio))
  return tandas
}

/** Ejecuta las tareas con a lo sumo `simultaneas` en curso. */
async function enParalelo<T>(tareas: (() => Promise<T>)[], simultaneas: number): Promise<void> {
  let siguiente = 0
  const trabajador = async () => {
    while (siguiente < tareas.length) {
      const tarea = tareas[siguiente++]
      if (tarea) await tarea()
    }
  }
  await Promise.all(Array.from({ length: simultaneas }, trabajador))
}

export async function sembrar(prisma: PrismaClient, escala: Escala): Promise<Sembrado> {
  const inicio = performance.now()
  const azar = generador(20261019)
  const importe = () => Math.round(azar() * 1_000_000_000) / 100

  const estudio = await prisma.estudio.create({
    data: { nombre: 'Estudio de medición', cuit: '30-00000000-1', razonSocial: 'Estudio SA' },
  })
  // Otro estudio en la misma base, con su propio catálogo: las lecturas del primero no lo ven.
  // Más nuevo, para que "el estudio activo" siga siendo el de la medición.
  await prisma.estudio.create({
    data: {
      nombre: 'Estudio vecino',
      cuit: '30-00000000-2',
      razonSocial: 'Vecino SA',
      createdAt: new Date('2099-01-01T00:00:00Z'),
    },
  })
  const auditor = await prisma.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Auditora', esDefault: true },
  })
  const rubros = await prisma.rubroBase.findMany({
    where: { estudioId: estudio.id, activo: true },
    select: { id: true, orden: true, naturalezaEsperada: true },
    orderBy: { orden: 'asc' },
  })

  // ── Sociedades ──────────────────────────────────────────────────────────────
  const sociedades: { id: string }[] = []
  for (const tanda of enTandas(
    Array.from({ length: escala.sociedades }, (_, i) => i),
    1000,
  )) {
    const creadas = await prisma.sociedad.createManyAndReturn({
      data: tanda.map((i) => ({
        estudioId: estudio.id,
        razonSocial: `Sociedad ${String(i + 1).padStart(5, '0')} SA`,
        cuit: `30-${String(10_000_000 + i).padStart(8, '0')}-${i % 10}`,
        categoriaEnte: 'PEQUENA' as const,
      })),
      select: { id: true },
    })
    sociedades.push(...creadas)
  }

  // ── Ejercicios: un año por vuelta, cada uno vinculado al del año anterior ──
  type Ej = { id: string; sociedadId: string; enCurso: boolean }
  const ejercicios: Ej[] = []
  let anteriores = new Map<string, string>()
  const primerAnio = 2026 - escala.ejerciciosPorSociedad
  for (let anio = 0; anio < escala.ejerciciosPorSociedad; anio++) {
    const enCurso = anio === escala.ejerciciosPorSociedad - 1
    const deEsteAnio = new Map<string, string>()
    for (const tanda of enTandas(sociedades, 1000)) {
      const creados = await prisma.ejercicioContable.createManyAndReturn({
        data: tanda.map((s) => {
          const anteriorId = anteriores.get(s.id) ?? null
          return {
            estudioId: estudio.id,
            sociedadId: s.id,
            auditorId: auditor.id,
            numeroEjercicio: anio + 1,
            fechaInicio: new Date(Date.UTC(primerAnio + anio, 0, 1)),
            fechaCierre: new Date(Date.UTC(primerAnio + anio, 11, 31)),
            denominacion: `Ejercicio N° ${anio + 1}`,
            estado: enCurso ? ('EN_PROCESO' as const) : ('CERRADO' as const),
            modoAnterior: anteriorId ? ('VINCULADO' as const) : ('SIN_ANTERIOR' as const),
            ejercicioAnteriorId: anteriorId,
            categoriaEnte: 'PEQUENA' as const,
            adopcionRT54: 'APLICACION_CONTINUADA' as const,
            indiceInflacionAnterior: '100',
            indiceInflacionActual: '130',
            pnConfirmado: !enCurso,
            estadosConfirmado: !enCurso,
          }
        }),
        select: { id: true, sociedadId: true },
      })
      for (const e of creados) {
        deEsteAnio.set(e.sociedadId, e.id)
        ejercicios.push({ ...e, enCurso })
      }
    }
    anteriores = deEsteAnio
  }

  // ── Hijos de cada ejercicio, por tandas de ejercicios en paralelo ──────────
  const reglas = REGLAS.slice(0, 3)
  const importaciones = new Map<string, string>()
  const tareas = enTandas(ejercicios, 10).map((tanda) => async () => {
    const imps = await prisma.importacionExcel.createManyAndReturn({
      data: tanda.map((e) => ({
        ejercicioId: e.id,
        nombreArchivo: 'balance.xlsx',
        hashArchivo: `hash-${e.id}`,
        estado: 'COMPLETADA' as const,
        totalFilas: escala.cuentasPorEjercicio,
        filasImportadas: escala.cuentasPorEjercicio,
      })),
      select: { id: true, ejercicioId: true },
    })
    for (const i of imps) importaciones.set(i.ejercicioId, i.id)

    const cuentas: Prisma.CuentaContableCreateManyInput[] = []
    for (const e of tanda) {
      for (let i = 0; i < escala.cuentasPorEjercicio; i++) {
        const rubro = rubros[i % rubros.length]!
        const monto = importe()
        const deudora = rubro.naturalezaEsperada === 'DEUDORA'
        cuentas.push({
          ejercicioId: e.id,
          importacionExcelId: importaciones.get(e.id) ?? null,
          rubroBaseId: e.enCurso && i % 50 === 0 ? null : rubro.id,
          codigo: `${String(rubro.orden).padStart(3, '0')}.${String(i).padStart(5, '0')}`,
          nombre: `Cuenta ${i}`,
          saldoDeudor: deudora ? monto : 0,
          saldoAcreedor: deudora ? 0 : monto,
          saldoFinal: deudora ? monto : -monto,
        })
      }
    }
    await prisma.cuentaContable.createMany({ data: cuentas })

    await prisma.evolucionPNMovimiento.createMany({
      data: tanda.flatMap((e) =>
        MOVIMIENTOS_PN.map((tipo, orden) => ({
          ejercicioId: e.id,
          tipo,
          orden,
          capitalSuscripto: importe(),
          rdosNoAsignados: importe(),
          totalAnterior: importe(),
        })),
      ),
    })
    await prisma.bienDeUsoCategoria.createMany({
      data: tanda.flatMap((e) =>
        CATEGORIAS_BDU.map((categoria, orden) => ({
          ejercicioId: e.id,
          categoria,
          orden,
          costoInicioReexpresado: importe(),
          altas: importe(),
          costoFinReexpresado: importe(),
          depAcumInicio: importe(),
          depEjercicio: importe(),
          depAcumFin: importe(),
        })),
      ),
    })
    await prisma.costoVentasEjercicio.createMany({
      data: tanda.map((e) => ({
        ejercicioId: e.id,
        existenciaInicial: importe(),
        compras: importe(),
        existenciaFinal: importe(),
      })),
    })

    const flujos = await prisma.flujoDeCajaEjercicio.createManyAndReturn({
      data: tanda.map((e) => ({ ejercicioId: e.id })),
      select: { id: true },
    })
    await prisma.flujoDeCajaItem.createMany({
      data: flujos.flatMap((f) =>
        Array.from({ length: 12 }, (_, i) => ({
          flujoId: f.id,
          seccion: SECCIONES_FLUJO[i % 3]!,
          concepto: `Concepto ${i}`,
          importe: importe(),
          importeAnterior: importe(),
          orden: i,
        })),
      ),
    })

    const notas = await prisma.notaEjercicio.createManyAndReturn({
      data: tanda.flatMap((e) =>
        Array.from({ length: 8 }, (_, i) => ({
          ejercicioId: e.id,
          titulo: `Nota ${i + 1}`,
          tipo: 'CUANTITATIVA' as const,
          numero: i + 2,
          orden: i,
        })),
      ),
      select: { id: true },
    })
    await prisma.detalleNota.createMany({
      data: notas.flatMap((n) =>
        Array.from({ length: 4 }, (_, i) => ({
          notaEjercicioId: n.id,
          orden: i,
          concepto: `Detalle ${i}`,
          importeActual: importe(),
          importeAnterior: importe(),
        })),
      ),
    })

    await prisma.documentoEjercicio.createMany({
      data: tanda.flatMap((e) =>
        reglas.map((r) => ({
          ejercicioId: e.id,
          reglaClave: r.clave,
          tipo: r.tipo,
          titulo: r.titulo,
          estado: 'ACEPTADO' as const,
        })),
      ),
    })
    await prisma.errorValidacion.createMany({
      data: tanda.flatMap((e) =>
        Array.from({ length: 2 }, () => ({
          ejercicioId: e.id,
          tipo: 'CUADRE_BALANCE' as const,
          severidad: 'ADVERTENCIA' as const,
          estado: e.enCurso ? ('ACTIVA' as const) : ('RESUELTA' as const),
          mensaje: 'Validación sintética',
        })),
      ),
    })
  })
  await enParalelo(tareas, 4)

  await prisma.$executeRawUnsafe('ANALYZE')

  const medio = sociedades[Math.floor(sociedades.length / 2)]!
  const otra = sociedades[Math.floor(sociedades.length / 4)]!
  const objetivo = ejercicios.find((e) => e.enCurso && e.sociedadId === medio.id)!
  const escritura = ejercicios.find((e) => e.enCurso && e.sociedadId === otra.id)!

  const filas: Record<string, number> = {
    sociedades: sociedades.length,
    ejercicios: ejercicios.length,
    cuentas: await prisma.cuentaContable.count(),
    notas: await prisma.notaEjercicio.count(),
    detallesNota: await prisma.detalleNota.count(),
    movimientosPN: await prisma.evolucionPNMovimiento.count(),
    itemsFlujo: await prisma.flujoDeCajaItem.count(),
  }

  return {
    estudioId: estudio.id,
    objetivo: { sociedadId: medio.id, ejercicioId: objetivo.id },
    escritura: { ejercicioId: escritura.id, importacionId: importaciones.get(escritura.id)! },
    filas,
    segundos: Math.round((performance.now() - inicio) / 1000),
  }
}
