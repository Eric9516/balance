/**
 * Prueba de espionaje (docs/decisiones/0011): dos estudios en la misma base. Desde uno se intenta
 * leer, cambiar, borrar y crear lo del otro, en cada tabla; todo tiene que fallar o no encontrar
 * nada. Los textos del estudio B llevan la marca SECRETOB: si aparece en algo que ve A, se filtró.
 *
 * Además revisa la estructura, así falla si alguien agrega una tabla sin su regla, una función
 * que saltee las reglas o le da al rol de la app un permiso de más (ver la migración
 * 20261030150000_separacion_por_estudio).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { comoPlataforma, conEstudio } from '@/lib/contexto-base'
import { findSociedadesByEstudio } from '@/modules/sociedades/repository/sociedad.repository'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'

/** Tablas sin estudio: qué puede hacer la app con cada una. */
const SIN_ESTUDIO: Record<string, string[]> = {
  estudios: ['SELECT', 'INSERT', 'UPDATE'], // cada estudio ve y cambia solo el suyo (su regla)
  catalogo_rubros: ['SELECT'], // el oficial: la app solo lo copia a un estudio nuevo
  errores_tecnicos_log: [], // de la plataforma
  _prisma_migrations: [],
}
/** Las funciones que puede ejecutar la app; las demás, ninguna. */
const FUNCIONES_DE_LA_APP = ['_estudio_unico', 'estudio_de_la_sesion', 'uuidv7']
/** Las únicas que corren con los permisos de su dueño (saltean las reglas a propósito). */
const FUNCIONES_ESPECIALES = ['_estudio_unico']

type Datos = { estudio: string; ejercicio: string; sociedad: string }
const A = {} as Datos
const B = {} as Datos

/** Una fila en cada tabla con estudio, con la marca en los textos. Como plataforma. */
async function cargarEstudio(marca: string, anio: number, cuit: string): Promise<Datos> {
  return comoPlataforma(async () => {
    const estudio = await db.estudio.create({
      data: {
        nombre: `Estudio ${marca}`,
        cuit: `30${cuit}1`,
        razonSocial: `Estudio ${marca}`,
        createdAt: new Date(Date.UTC(anio, 0, 1)),
      },
    })
    const e = estudio.id
    const [sociedad, auditor, rubro, grupo] = await Promise.all([
      db.sociedad.create({
        data: { estudioId: e, razonSocial: `Sociedad ${marca}`, cuit: `30${cuit}2` },
      }),
      db.auditor.create({ data: { estudioId: e, nombre: marca, apellido: marca } }),
      db.rubroBase.findUniqueOrThrow({
        where: { estudioId_codigo: { estudioId: e, codigo: 'ACT-CTE-01' } },
      }),
      db.rubroGrupo.create({ data: { estudioId: e, nombre: `Sección ${marca}`, orden: 1 } }),
      db.estudioConfiguracion.create({ data: { estudioId: e } }),
      db.usuarioEstudio.create({
        data: { estudioId: e, nombre: marca, email: `${marca.toLowerCase()}@espionaje.test` },
      }),
      db.plantillaNota.create({
        data: { estudioId: e, titulo: `Plantilla ${marca}`, tipo: 'INFORMATIVA', orden: 1 },
      }),
      db.mapeoExcel.create({
        data: {
          estudioId: e,
          nombre: `Mapeo ${marca}`,
          columnasCodigo: [],
          columnasNombre: [],
          columnasDeudor: [],
          columnasAcreedor: [],
        },
      }),
      db.gastoSeccionConfig.create({ data: { estudioId: e, clave: `legacy:${marca}` } }),
    ])
    await db.rubroActivoEstudio.create({ data: { estudioId: e, rubroId: rubro.id } })
    const ejercicio = await db.ejercicioContable.create({
      data: {
        estudioId: e,
        sociedadId: sociedad.id,
        auditorId: auditor.id,
        fechaInicio: new Date('2025-01-01'),
        fechaCierre: new Date('2025-12-31'),
        denominacion: `Ejercicio ${marca}`,
      },
    })
    const ej = ejercicio.id
    const [importacion, nota, flujo] = await Promise.all([
      db.importacionExcel.create({
        data: { ejercicioId: ej, nombreArchivo: `${marca}.xlsx`, hashArchivo: marca },
      }),
      db.notaEjercicio.create({
        data: { ejercicioId: ej, titulo: `Nota ${marca}`, tipo: 'CUANTITATIVA', orden: 1 },
      }),
      db.flujoDeCajaEjercicio.create({ data: { ejercicioId: ej } }),
      db.evolucionPNMovimiento.create({
        data: { ejercicioId: ej, tipo: 'SALDO_INICIO', orden: 1 },
      }),
      db.bienDeUsoCategoria.create({ data: { ejercicioId: ej, categoria: marca, orden: 1 } }),
      db.costoVentasEjercicio.create({ data: { ejercicioId: ej } }),
      db.errorValidacion.create({
        data: { ejercicioId: ej, tipo: 'CUADRE_BALANCE', severidad: 'ERROR', mensaje: marca },
      }),
      db.comparativoManual.create({
        data: { ejercicioId: ej, modulo: 'SSP', clave: marca, label: marca, valor: 1 },
      }),
      db.documentoEjercicio.create({ data: { ejercicioId: ej, tipo: 'ANEXO', titulo: marca } }),
      db.ajusteTransicionRT54.create({
        data: { ejercicioId: ej, orden: 1, tipo: 'AJUSTE_MEDICION', concepto: marca },
      }),
    ])
    await Promise.all([
      db.cuentaContable.create({
        data: {
          ejercicioId: ej,
          importacionExcelId: importacion.id,
          notaEjercicioId: nota.id,
          rubroBaseId: rubro.id,
          codigo: '1.1.01',
          nombre: `Caja ${marca}`,
          saldoFinal: 100,
        },
      }),
      db.detalleNota.create({ data: { notaEjercicioId: nota.id, orden: 1, concepto: marca } }),
      db.flujoDeCajaItem.create({
        data: { flujoId: flujo.id, seccion: 'ACTIVIDADES_OPERATIVAS', concepto: marca, orden: 1 },
      }),
      db.rubroBase.update({ where: { id: rubro.id }, data: { rubroGrupoId: grupo.id } }),
    ])
    return { estudio: e, ejercicio: ej, sociedad: sociedad.id }
  })
}

/** Las tablas con estudio, leídas de la base (como plataforma). */
async function tablasConEstudio(): Promise<string[]> {
  const filas = await comoPlataforma(
    () =>
      db.$queryRaw<{ tabla: string }[]>`
      SELECT c.relname AS tabla FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
                    AND a.attname = 'estudio_id' AND NOT a.attisdropped)
      ORDER BY 1`,
  )
  return filas.map((f) => f.tabla)
}

const contar = async (sql: string) =>
  Number((await db.$queryRawUnsafe<{ n: bigint }[]>(sql))[0]?.n ?? -1)

/** Ejecuta `fn` en una transacción que siempre se deshace: si algo se filtrara, no queda. */
async function yDeshacer(fn: (tx: typeof db) => Promise<number>): Promise<number> {
  let afectadas = -1
  await db
    .$transaction(async (tx) => {
      afectadas = await fn(tx as typeof db)
      throw new Error('deshacer')
    })
    .catch((e: Error) => {
      if (e.message !== 'deshacer') throw e
    })
  return afectadas
}

let tablas: string[] = []

beforeAll(async () => {
  Object.assign(A, await cargarEstudio('UNOA', 2097, '91000000'))
  Object.assign(B, await cargarEstudio('SECRETOB', 2098, '92000000'))
  tablas = await tablasConEstudio()
})

afterAll(async () => {
  await comoPlataforma(async () => {
    const ids = [A.estudio, B.estudio].filter(Boolean)
    await db.ejercicioContable.deleteMany({ where: { estudioId: { in: ids } } })
    await db.sociedad.deleteMany({ where: { estudioId: { in: ids } } })
    await db.auditor.deleteMany({ where: { estudioId: { in: ids } } })
    await db.estudio.deleteMany({ where: { id: { in: ids } } })
  })
})

describe('Prueba de espionaje entre estudios', () => {
  it('cada tabla con estudio tiene filas de los dos estudios (si no, la prueba no prueba nada)', async () => {
    expect(tablas.length).toBeGreaterThan(20)
    const vacias: string[] = []
    await comoPlataforma(async () => {
      for (const t of tablas) {
        for (const e of [A.estudio, B.estudio]) {
          if (
            (await contar(`SELECT count(*) AS n FROM public.${t} WHERE estudio_id = '${e}'`)) === 0
          )
            vacias.push(`${t} (${e === A.estudio ? 'A' : 'B'})`)
        }
      }
    })
    expect(vacias, 'Agregá una fila de esa tabla en cargarEstudio()').toEqual([])
  })

  it('desde A no se ve nada de B, en ninguna tabla', async () => {
    const filtradas: string[] = []
    await conEstudio(A.estudio, async () => {
      for (const t of tablas) {
        const deOtro = await contar(
          `SELECT count(*) AS n FROM public.${t} WHERE estudio_id <> '${A.estudio}'`,
        )
        const marca = await contar(
          `SELECT count(*) AS n FROM public.${t} x WHERE x::text LIKE '%SECRETOB%'`,
        )
        const propias = await contar(`SELECT count(*) AS n FROM public.${t}`)
        if (deOtro > 0 || marca > 0 || propias === 0)
          filtradas.push(`${t}: de otro ${deOtro}, marca ${marca}, propias ${propias}`)
      }
      // estudios: solo el suyo
      const estudios = await db.estudio.findMany({ select: { id: true } })
      expect(estudios.map((e) => e.id)).toEqual([A.estudio])
    })
    expect(filtradas).toEqual([])
  })

  it('desde A no se cambia ni se borra nada de B', async () => {
    const tocadas: string[] = []
    await conEstudio(A.estudio, async () => {
      for (const t of [...tablas, 'estudios']) {
        const columna = t === 'estudios' ? 'id' : 'estudio_id'
        const cambiadas = await yDeshacer((tx) =>
          tx.$executeRawUnsafe(
            `UPDATE public.${t} SET ${columna} = ${columna} WHERE ${columna} = '${B.estudio}'`,
          ),
        )
        const borradas =
          t === 'estudios'
            ? 0
            : await yDeshacer((tx) =>
                tx.$executeRawUnsafe(`DELETE FROM public.${t} WHERE estudio_id = '${B.estudio}'`),
              )
        if (cambiadas !== 0 || borradas !== 0)
          tocadas.push(`${t}: cambiadas ${cambiadas}, borradas ${borradas}`)
      }
    })
    expect(tocadas).toEqual([])
  })

  it('desde A no se crea nada a nombre de B ni colgado de un dato de B', async () => {
    await conEstudio(A.estudio, async () => {
      const rubroDeA = await db.rubroBase.findFirstOrThrow({ select: { id: true } })
      const intentos: Promise<unknown>[] = [
        db.sociedad.create({
          data: { estudioId: B.estudio, razonSocial: 'Intrusa', cuit: '30939393931' },
        }),
        db.cuentaContable.create({
          data: { ejercicioId: B.ejercicio, codigo: '9', nombre: 'Intrusa' },
        }),
        db.cuentaContable.create({
          data: {
            ejercicioId: B.ejercicio,
            estudioId: A.estudio,
            codigo: '9',
            nombre: 'Intrusa',
            rubroBaseId: rubroDeA.id,
          },
        }),
        db.rubroGrupo.create({ data: { estudioId: B.estudio, nombre: 'Intrusa', orden: 9 } }),
        db.estudio.create({ data: { nombre: 'Intruso', cuit: '30949494941', razonSocial: 'X' } }),
      ]
      for (const intento of intentos) await expect(intento).rejects.toThrow()
    })
    // Y B sigue con lo suyo
    await comoPlataforma(async () => {
      expect(await db.sociedad.count({ where: { razonSocial: 'Intrusa' } })).toBe(0)
      expect(await db.cuentaContable.count({ where: { nombre: 'Intrusa' } })).toBe(0)
    })
  })

  it('la app, desde A, solo encuentra lo de A', async () => {
    await conEstudio(A.estudio, async () => {
      expect((await findSociedadesByEstudio(A.estudio)).map((s) => s.id)).toEqual([A.sociedad])
      expect(await findSociedadesByEstudio(B.estudio)).toEqual([])
      expect(await findEjercicioById(B.ejercicio)).toBeNull()
      expect(await findCuentasByEjercicio(B.ejercicio)).toEqual([])
      expect(await findRubrosBase(B.estudio)).toEqual([])
      expect((await findCuentasByEjercicio(A.ejercicio)).length).toBe(1)
      expect((await findRubrosBase(A.estudio)).length).toBeGreaterThan(50)
    })
  })

  it('cada conexión trabaja con el estudio de quien la pide, aunque se pidan a la vez', async () => {
    const pedidos = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? A.estudio : B.estudio))
    const vistos = await Promise.all(
      pedidos.map((e) =>
        conEstudio(e, async () => {
          const [fila] = await db.$queryRaw<{ estudio: string; rol: string }[]>`
            SELECT current_setting('app.estudio') AS estudio, current_user AS rol`
          const sociedades = await db.sociedad.findMany({ select: { estudioId: true } })
          return { ...fila, sociedades: sociedades.map((s) => s.estudioId) }
        }),
      ),
    )
    vistos.forEach((v, i) => {
      expect(v).toEqual({ estudio: pedidos[i], rol: 'balancert_app', sociedades: [pedidos[i]] })
    })
  })

  it('sin estudio declarado y con varios estudios en la base, la app no ve nada', async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL })
    await c.connect()
    try {
      await c.query("SELECT set_config('role', 'balancert_app', false)")
      for (const t of ['sociedades', 'cuentas_contables', 'estudios', 'rubros_base']) {
        const { rows } = await c.query<{ n: string }>(`SELECT count(*) AS n FROM public.${t}`)
        expect(Number(rows[0]?.n), t).toBe(0)
      }
    } finally {
      await c.end()
    }
  })
})

describe('Estructura de la separación', () => {
  it('el rol de la app no puede saltear las reglas ni entrar solo', async () => {
    const [rol] = await comoPlataforma(
      () =>
        db.$queryRaw<{ super: boolean; saltea: boolean; entra: boolean }[]>`
        SELECT rolsuper AS super, rolbypassrls AS saltea, rolcanlogin AS entra
        FROM pg_roles WHERE rolname = 'balancert_app'`,
    )
    expect(rol).toEqual({ super: false, saltea: false, entra: false })
  })

  it('cada tabla con estudio tiene sus reglas activas, forzadas y restrictivas', async () => {
    const faltan = await comoPlataforma(
      () =>
        db.$queryRaw<{ tabla: string }[]>`
        SELECT c.relname AS tabla FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
                      AND a.attname = 'estudio_id' AND NOT a.attisdropped)
          AND NOT (c.relrowsecurity AND c.relforcerowsecurity
            AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
                        AND p.polname = 'solo_su_estudio' AND NOT p.polpermissive
                        AND pg_get_expr(p.polqual, p.polrelid) LIKE '%estudio_de_la_sesion()%'
                        AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%estudio_de_la_sesion()%')
            AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'la_app'))`,
    )
    expect(
      faltan.map((f) => f.tabla),
      "Terminá la migración con SELECT public._estudio_en_la_tabla('public.<tabla>')",
    ).toEqual([])
  })

  it('las tablas sin estudio tienen solo los permisos previstos para la app', async () => {
    const filas = await comoPlataforma(
      () =>
        db.$queryRaw<{ tabla: string; permisos: string[] }[]>`
        SELECT c.relname AS tabla,
               array_remove(ARRAY[
                 CASE WHEN has_table_privilege('balancert_app', c.oid, 'SELECT') THEN 'SELECT' END,
                 CASE WHEN has_table_privilege('balancert_app', c.oid, 'INSERT') THEN 'INSERT' END,
                 CASE WHEN has_table_privilege('balancert_app', c.oid, 'UPDATE') THEN 'UPDATE' END,
                 CASE WHEN has_table_privilege('balancert_app', c.oid, 'DELETE') THEN 'DELETE' END,
                 CASE WHEN has_table_privilege('balancert_app', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END
               ], NULL) AS permisos
        FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
          AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
                          AND a.attname = 'estudio_id' AND NOT a.attisdropped)
        ORDER BY 1`,
    )
    expect(Object.fromEntries(filas.map((f) => [f.tabla, f.permisos]))).toEqual(SIN_ESTUDIO)
  })

  it('la app ejecuta solo sus funciones, y solo una saltea las reglas a propósito', async () => {
    const [ejecutables, especiales] = await comoPlataforma(() =>
      Promise.all([
        db.$queryRaw<{ nombre: string }[]>`
          SELECT p.proname AS nombre FROM pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace
            AND has_function_privilege('balancert_app', p.oid, 'EXECUTE')
          ORDER BY 1`,
        db.$queryRaw<{ nombre: string }[]>`
          SELECT p.proname AS nombre FROM pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
          ORDER BY 1`,
      ]),
    )
    expect(ejecutables.map((f) => f.nombre)).toEqual(FUNCIONES_DE_LA_APP)
    expect(especiales.map((f) => f.nombre)).toEqual(FUNCIONES_ESPECIALES)
  })
})
