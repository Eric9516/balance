/**
 * Medición de rendimiento con el código real de la app (`pnpm rendimiento`).
 *
 * Siembra un estudio sintético grande, ejecuta las operaciones que hacen las pantallas
 * principales tal como las encadena cada página, y mide por operación:
 * - tiempo local (mediana y p95), sin latencia de red;
 * - tiempo con la latencia simulada de Supabase, y de ahí los viajes secuenciales a la base;
 * - cantidad de consultas;
 * - lecturas completas de tablas grandes en los planes de ejecución reales.
 * Además lista las claves foráneas sin índice y las tablas más pesadas.
 *
 * Variables: RENDIMIENTO_ESCALA = rapida | media | grande (por defecto media),
 * RENDIMIENTO_LATENCIA_MS (ida y vuelta simulada, por defecto 30).
 * El informe queda en .rendimiento/<escala>.md y .json (no se sube a git).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { crearPoolPg } from '@/lib/pool-pg'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
  notFound: () => {
    throw new Error('notFound')
  },
}))

import { db } from '@/lib/db'
import {
  findSociedadById,
  findSociedadesByEstudio,
} from '@/modules/sociedades/repository/sociedad.repository'
import {
  findCadenaAnterior,
  findEjercicioById,
  findEjerciciosBySociedad,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  findCuentasByEjercicio,
  replaceCuentas,
  resumenCuentasByEjercicio,
} from '@/modules/importaciones/repository/cuentas.repository'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { evaluarAutorizacionSinPersistir } from '@/modules/ejercicios/services/autorizacion.service'
import { cargarDocumentoBalance } from '@/modules/exportacion/services/documento.service'
import { RENDIMIENTO_DATABASE_URL, PUERTO_INTERMEDIARIO } from './postgres.setup'
import { ESCALAS, sembrar, type NombreEscala, type Sembrado } from './datos-sinteticos'
import {
  analizarPlanes,
  capturarConsultas,
  clavesForaneasSinIndice,
  cronometrar,
  deDatos,
  filasPorTabla,
  iniciarIntermediario,
  repetidas,
  tamanios,
} from './medir'

const ESCALA = (process.env.RENDIMIENTO_ESCALA ?? 'media') as NombreEscala
const LATENCIA_MS = Number(process.env.RENDIMIENTO_LATENCIA_MS ?? 30)
const REPETICIONES = 10
const REPETICIONES_CON_LATENCIA = 7

type Operacion = { nombre: string; fn: () => Promise<unknown> }

function operaciones(s: Sembrado, cuentasPorEjercicio: number): Operacion[] {
  const { sociedadId, ejercicioId } = s.objetivo
  const ejercicio = async () => (await findEjercicioById(ejercicioId))!
  const reemplazo = Array.from({ length: cuentasPorEjercicio }, (_, i) => ({
    codigo: `9.${String(i).padStart(5, '0')}`,
    nombre: `Cuenta importada ${i}`,
    saldoDeudor: 1000 + i,
    saldoAcreedor: 0,
    saldoFinal: 1000 + i,
  }))
  return [
    { nombre: 'Lista de sociedades', fn: () => findSociedadesByEstudio(s.estudioId) },
    {
      nombre: 'Lista de ejercicios de una sociedad',
      fn: () => findEjerciciosBySociedad(sociedadId),
    },
    {
      // Primera oleada de la página del ejercicio (cuentas/page.tsx), igual que la página.
      nombre: 'Página del ejercicio: datos base',
      fn: () =>
        Promise.all([
          findSociedadById(sociedadId),
          findEjercicioById(ejercicioId),
          resumenCuentasByEjercicio(ejercicioId),
          db.bienDeUsoCategoria.count({ where: { ejercicioId } }),
          db.costoVentasEjercicio.findFirst({ where: { ejercicioId }, select: { id: true } }),
          db.notaEjercicio.count({ where: { ejercicioId } }),
          db.cuentaContable.findFirst({
            where: { ejercicioId, rubroBase: { rubroGrupo: { esGasto: true } } },
            select: { id: true },
          }),
          evaluarDocumentos(ejercicioId),
        ]),
    },
    {
      nombre: 'Paso Estados',
      fn: async () => {
        const e = await ejercicio()
        const cuentas = await findCuentasByEjercicio(ejercicioId)
        const { estadosData } = await cargarEstadosConPN(e, cuentas)
        return cargarFlujo(e, estadosData)
      },
    },
    {
      nombre: 'Paso Anterior con compuerta',
      fn: async () => {
        const e = await ejercicio()
        const cuentas = await findCuentasByEjercicio(ejercicioId)
        const [estados] = await Promise.all([
          cargarEstadosConPN(e, cuentas),
          findBienesDeUso(ejercicioId),
          findNotasByEjercicio(ejercicioId),
        ])
        return evaluarAutorizacionSinPersistir(e, { estados })
      },
    },
    { nombre: 'Documento imprimible completo', fn: () => cargarDocumentoBalance(ejercicioId) },
    { nombre: 'Cadena de ejercicios anteriores', fn: () => findCadenaAnterior(ejercicioId) },
    {
      nombre: `Importar ${cuentasPorEjercicio} cuentas (reemplazo)`,
      fn: () => replaceCuentas(s.escritura.ejercicioId, s.escritura.importacionId, reemplazo),
    },
  ]
}

const ms = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString())

describe(`Rendimiento (escala ${ESCALA})`, () => {
  const intermediario = iniciarIntermediario(
    PUERTO_INTERMEDIARIO,
    new URL(RENDIMIENTO_DATABASE_URL),
  )
  let pg: Client
  let sembrado: Sembrado

  beforeAll(async () => {
    await intermediario.escuchar()
    const sembrador = new PrismaClient({
      adapter: new PrismaPg(crearPoolPg({ connectionString: RENDIMIENTO_DATABASE_URL }), {
        disposeExternalPool: true,
      }),
    })
    try {
      sembrado = await sembrar(sembrador, ESCALAS[ESCALA])
    } finally {
      await sembrador.$disconnect()
    }
    pg = new Client({ connectionString: RENDIMIENTO_DATABASE_URL })
    await pg.connect()
  })

  afterAll(async () => {
    await db.$disconnect()
    await pg?.end()
    await intermediario.cerrar()
  })

  it('mide las operaciones principales y revisa el esquema', async () => {
    // db.ts avisa por consola de cada consulta lenta: acá lo dicen los planes, sin ruido.
    const avisar = console.warn
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('[db lenta]')) return
      avisar(...args)
    })

    const captura = capturarConsultas(db)
    const filas = await filasPorTabla(pg)
    const resultados = []

    // Ida y vuelta efectiva del intermediario: en Windows los temporizadores tienen unos 15 ms
    // de resolución, así que la demora real puede ser mayor que la pedida. Se mide con una
    // consulta mínima y con ese valor se cuentan los viajes de cada operación.
    const consultaMinima = () => db.$queryRawUnsafe('SELECT 1')
    intermediario.fijarLatencia(0)
    const sinRed = await cronometrar(consultaMinima, 20)
    intermediario.fijarLatencia(LATENCIA_MS)
    const conRed = await cronometrar(consultaMinima, 10)
    intermediario.fijarLatencia(0)
    const idaYVuelta = Math.max(1, conRed.mediana - sinRed.mediana)

    for (const op of operaciones(sembrado, ESCALAS[ESCALA].cuentasPorEjercicio)) {
      intermediario.fijarLatencia(0)
      const { consultas } = await captura.durante(op.fn)
      const local = await cronometrar(op.fn, REPETICIONES)
      intermediario.fijarLatencia(LATENCIA_MS)
      const remoto = await cronometrar(op.fn, REPETICIONES_CON_LATENCIA, 2)
      intermediario.fijarLatencia(0)
      const planes = await analizarPlanes(pg, consultas, filas)

      const deLaOperacion = deDatos(consultas)
      expect(deLaOperacion.length, `${op.nombre}: no se capturaron consultas`).toBeGreaterThan(0)
      const viajes = Math.max(1, Math.round((remoto.mediana - local.mediana) / idaYVuelta))
      const tablasLeidasEnteras = new Map<string, number>()
      for (const p of planes)
        for (const l of p.lecturasCompletas) tablasLeidasEnteras.set(l.tabla, l.filasTabla)
      const consultasRepetidas = repetidas(consultas)
      resultados.push({
        nombre: op.nombre,
        consultas: deLaOperacion.length,
        repetidas: consultasRepetidas.reduce((n, r) => n + r.veces, 0),
        consultasRepetidas,
        viajes,
        local,
        estimadoConRed: local.mediana + viajes * LATENCIA_MS,
        lecturasCompletas: [...tablasLeidasEnteras].map(([tabla, filasTabla]) => ({
          tabla,
          filasTabla,
        })),
        consultasConLecturaCompleta: planes
          .filter((p) => p.lecturasCompletas.length > 0)
          .map((p) => p.sql),
        erroresDePlan: planes.filter((p) => p.error).map((p) => ({ sql: p.sql, error: p.error })),
      })
    }

    const fkSinIndice = await clavesForaneasSinIndice(pg)
    const masPesadas = await tamanios(pg)

    // ── Informe ──────────────────────────────────────────────────────────────
    const md: string[] = [
      `# Medición de rendimiento: escala ${ESCALA}`,
      '',
      `Fecha: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · siembra: ${sembrado.segundos} s · red simulada: ${LATENCIA_MS} ms pedidos, ${ms(idaYVuelta)} ms efectivos por ida y vuelta`,
      '',
      '| Datos | Filas |',
      '|---|---|',
      ...Object.entries(sembrado.filas).map(([k, v]) => `| ${k} | ${v.toLocaleString('es-AR')} |`),
      '',
      '- **Viajes:** idas y vueltas secuenciales a la base. Las consultas en paralelo cuentan como un viaje.',
      `- **Estimado con red:** tiempo local más ${LATENCIA_MS} ms por viaje, como con Supabase en otra ciudad.`,
      '- **Repetidas:** consultas idénticas a otra anterior de la misma operación. Fuera de una página real, `cache()` de React no las deduplica.',
      '',
      `| Operación | Consultas | Repetidas | Viajes | Local mediana (ms) | Local p95 (ms) | Estimado con red (ms) | Lecturas completas de tablas grandes |`,
      '|---|---|---|---|---|---|---|---|',
      ...resultados.map(
        (r) =>
          `| ${r.nombre} | ${r.consultas} | ${r.repetidas} | ${r.viajes} | ${ms(r.local.mediana)} | ${ms(r.local.p95)} | ${ms(r.estimadoConRed)} | ${r.lecturasCompletas.length === 0 ? 'ninguna' : r.lecturasCompletas.map((l) => `${l.tabla} (${l.filasTabla.toLocaleString('es-AR')})`).join(', ')} |`,
      ),
      '',
      '## Claves foráneas sin índice',
      '',
      ...(fkSinIndice.length === 0
        ? ['Ninguna.']
        : [
            '| Tabla | Columnas | Filas |',
            '|---|---|---|',
            ...fkSinIndice.map(
              (f) => `| ${f.tabla} | ${f.columnas} | ${f.filas.toLocaleString('es-AR')} |`,
            ),
          ]),
      '',
      '## Tablas más pesadas',
      '',
      '| Tabla | Filas | Tamaño con índices |',
      '|---|---|---|',
      ...masPesadas.map((t) => `| ${t.tabla} | ${t.filas.toLocaleString('es-AR')} | ${t.total} |`),
    ]
    const conRepetidas = resultados.filter((r) => r.consultasRepetidas.length > 0)
    if (conRepetidas.length > 0) {
      md.push('', '## Consultas repetidas', '')
      for (const r of conRepetidas) {
        md.push(`**${r.nombre}**`, '')
        for (const c of r.consultasRepetidas)
          md.push(`- ${c.veces} de más: \`${c.sql.replace(/\s+/g, ' ').slice(0, 160)}\``)
        md.push('')
      }
    }
    const errores = resultados.flatMap((r) =>
      r.erroresDePlan.map((e) => `- ${r.nombre}: ${e.error}`),
    )
    if (errores.length > 0)
      md.push('', '## Consultas sin plan (no se pudieron explicar)', '', ...errores)

    const carpeta = join(process.cwd(), '.rendimiento')
    mkdirSync(carpeta, { recursive: true })
    writeFileSync(join(carpeta, `${ESCALA}.md`), md.join('\n') + '\n')
    writeFileSync(
      join(carpeta, `${ESCALA}.json`),
      JSON.stringify(
        {
          escala: ESCALA,
          latenciaMs: LATENCIA_MS,
          idaYVuelta,
          sembrado,
          resultados,
          fkSinIndice,
          masPesadas,
        },
        null,
        2,
      ),
    )
    console.log(md.join('\n'))

    // Regla de CLAUDE.md: toda clave foránea lleva índice. Se exige después de escribir el
    // informe, para que igual quede la medición completa.
    expect(
      fkSinIndice.map((f) => `${f.tabla}.${f.columnas}`),
      'Hay claves foráneas sin índice (ver el informe)',
    ).toEqual([])
  })
})
