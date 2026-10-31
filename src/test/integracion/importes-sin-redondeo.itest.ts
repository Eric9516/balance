/**
 * Integración (PostgreSQL real) de la regla primordial: JAMÁS se redondea nada (CLAUDE.md).
 * La base guarda los importes y los índices de inflación exactamente como llegan, con todos sus
 * decimales, y conserva el tope de tamaño que tenían las columnas. Ver
 * docs/decisiones/0009-importes-exactos.md y la migración 20261019163923_importes_sin_redondeo.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client, type DatabaseError } from 'pg'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}))

import { db } from '@/lib/db'
import { importe } from '@/lib/importe'
import { CreateEjercicioSchema } from '@/modules/ejercicios/schemas/ejercicio.schemas'
import { createEjercicio } from '@/modules/ejercicios/repository/ejercicio.repository'
import { derivarDesdeAnteriorPN } from '@/modules/patrimonio-neto/domain/saldosInicio'
import {
  findMovimientosPN,
  guardarMovimientosPN,
} from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'

const ctx = {} as { ejercicioId: string; cuentaId: string }
let pg: Client

const SIN_MOVIMIENTO = {
  capitalSuscripto: 0,
  ajusteCapital: 0,
  aportesIrrevocables: 0,
  reservaLegal: 0,
  otrasReservas: 0,
  rdosNoAsignados: 0,
  totalAnterior: 0,
}

/** Texto exacto que guardó la base, sin pasar por number. */
async function guardado(tabla: string, columna: string, id: string) {
  const r = await pg.query<{ v: string }>(
    `SELECT "${columna}"::text AS v FROM "${tabla}" WHERE id = $1`,
    [id],
  )
  return r.rows[0]?.v
}

/** Intenta guardar un valor y devuelve el control que lo rechazó (o null si lo aceptó). */
async function rechazo(columna: string, valor: string) {
  try {
    await pg.query(`UPDATE cuentas_contables SET "${columna}" = $2::numeric WHERE id = $1`, [
      ctx.cuentaId,
      valor,
    ])
    return null
  } catch (e) {
    const error = e as DatabaseError
    return `${error.code} ${error.constraint}`
  }
}

beforeAll(async () => {
  const sufijo = Date.now().toString().slice(-8)
  const estudio = await db.estudio.create({
    data: { nombre: 'Estudio importes', cuit: `33${sufijo}0`, razonSocial: 'Estudio importes' },
  })
  const sociedad = await db.sociedad.create({
    data: { estudioId: estudio.id, razonSocial: 'Importes SA', cuit: `33${sufijo}1` },
  })
  const auditor = await db.auditor.create({
    data: { estudioId: estudio.id, nombre: 'Ana', apellido: 'Pérez' },
  })
  // El camino real de la app: texto del formulario, validado y convertido por el repositorio.
  const input = CreateEjercicioSchema.parse({
    fechaInicio: '2024-01-01',
    fechaCierre: '2024-12-31',
    denominacion: '',
    numeroEjercicio: '1',
    auditorId: auditor.id,
    modoAnterior: 'SIN_ANTERIOR',
    ejercicioAnteriorId: '',
    categoriaEnte: 'PEQUENA',
    fechaInformeAuditor: '2025-03-15',
    indiceInflacionAnterior: '100.1234567',
    indiceInflacionActual: '125.7654321',
  })
  const ejercicio = await createEjercicio(sociedad.id, estudio.id, input)
  const cuenta = await db.cuentaContable.create({
    data: { ejercicioId: ejercicio.id, codigo: '1.1.01', nombre: 'Caja', saldoFinal: 0 },
  })
  Object.assign(ctx, { ejercicioId: ejercicio.id, cuentaId: cuenta.id })

  pg = new Client({ connectionString: process.env.DATABASE_URL })
  await pg.connect()
})

afterAll(async () => {
  await pg?.end()
})

describe('la base guarda todos los decimales', () => {
  it('los índices de inflación, tal como se cargaron en el formulario', async () => {
    expect(
      await guardado('ejercicios_contables', 'indice_inflacion_anterior', ctx.ejercicioId),
    ).toBe('100.1234567')
    expect(await guardado('ejercicios_contables', 'indice_inflacion_actual', ctx.ejercicioId)).toBe(
      '125.7654321',
    )
  })

  it('un importe reexpresado por el coeficiente vuelve de la base exactamente igual', async () => {
    // Ejercicio anterior con capital 1.000,01 y coeficiente 1,25: el total anterior reexpresado es 1.250,0125.
    const derivado = derivarDesdeAnteriorPN(
      [
        {
          id: '',
          ejercicioId: '',
          tipo: 'SALDO_INICIO',
          orden: 0,
          ...SIN_MOVIMIENTO,
          capitalSuscripto: 1000.01,
        },
      ],
      { actual: 125, anterior: 100 },
    )
    const totalAnterior = derivado.totalAnteriorByTipo?.SALDO_INICIO
    expect(totalAnterior).toBe(1250.0125)

    await guardarMovimientosPN(ctx.ejercicioId, [
      { tipo: 'SALDO_INICIO', orden: 0, ...SIN_MOVIMIENTO, totalAnterior: totalAnterior! },
    ])
    const [mov] = await findMovimientosPN(ctx.ejercicioId)
    expect(mov?.totalAnterior).toBe(1250.0125)
    expect(await guardado('evolucion_pn_movimientos', 'total_anterior', mov!.id)).toBe('1250.0125')
  })

  it('un importe con muchos decimales cargado a mano o desde un Excel', async () => {
    await db.cuentaContable.update({
      where: { id: ctx.cuentaId },
      data: { saldoDeudor: 100.555, saldoAcreedor: 0.0001, saldoFinal: 1234567.123456789 },
    })
    expect(await guardado('cuentas_contables', 'saldo_deudor', ctx.cuentaId)).toBe('100.555')
    expect(await guardado('cuentas_contables', 'saldo_acreedor', ctx.cuentaId)).toBe('0.0001')
    expect(await guardado('cuentas_contables', 'saldo_final', ctx.cuentaId)).toBe(
      '1234567.123456789',
    )
    const c = await db.cuentaContable.findUniqueOrThrow({ where: { id: ctx.cuentaId } })
    expect(importe(c.saldoFinal)).toBe(1234567.123456789)
  })

  it('ninguna columna decimal tiene escala fija', async () => {
    const r = await pg.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'numeric' AND numeric_scale IS NOT NULL`,
    )
    expect(r.rows).toEqual([])
  })
})

describe('la base conserva el tope de tamaño y rechaza lo que no es un importe', () => {
  it('acepta hasta el máximo que admitía la columna anterior (16 dígitos enteros)', async () => {
    expect(await rechazo('saldo_deudor', '9999999999999999.99')).toBeNull()
  })

  it('rechaza 10^16, NaN e infinito con su control de rango', async () => {
    for (const valor of ['1e16', '-1e16', 'NaN', 'Infinity', '-Infinity']) {
      expect(await rechazo('saldo_final', valor), valor).toBe(
        '23514 cuentas_contables_saldo_final_rango',
      )
    }
  })
})
