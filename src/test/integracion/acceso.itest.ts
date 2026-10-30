/**
 * Login propio (migración 20261030180000_login_propio): entrar, sesiones, freno a quien prueba
 * contraseñas, cuentas desactivadas, cambio de contraseña, "siempre un dueño" y el esquema acceso
 * cerrado para la app.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { comoPlataforma, conEstudio } from '@/lib/contexto-base'
import {
  cambiarContrasena,
  darDeAltaUsuario,
  entrar,
  salir,
  sesionDelToken,
  type PedidoDeEntrada,
} from '@/modules/acceso/services/entrada.service'
import { fijarContrasena } from '@/modules/acceso/repository/acceso.repository'
import { huellaDeContrasena } from '@/modules/acceso/infra/contrasenas'
import { codigoDelPaso, desdeBase32, pasoDe } from '@/modules/acceso/domain/codigo'
import { prepararCodigo, verificarCodigo } from '@/modules/acceso/services/entrada.service'

const CLAVE = 'una clave larga de prueba'
const ctx = { a: '', b: '', duenoA: '', contadorA: '', duenoB: '' }

const pedido = (email: string, extra: Partial<PedidoDeEntrada> = {}): PedidoDeEntrada => ({
  email,
  contrasena: CLAVE,
  recordar: false,
  ip: '10.0.0.1',
  navegador: 'pruebas',
  ...extra,
})

async function alta(estudioId: string, email: string, rol: 'DUENO' | 'CONTADOR') {
  const r = await darDeAltaUsuario({
    estudioId,
    email,
    nombre: email,
    rol,
    contrasenaProvisoria: CLAVE,
  })
  if (!r.ok) throw new Error(r.error.mensaje)
  return r.usuarioId
}

const borrarIntentos = () =>
  comoPlataforma(() => db.$executeRaw`DELETE FROM acceso.intentos WHERE email LIKE '%@acceso.test'`)

const codigo = async (p: Promise<{ ok: boolean; error?: { codigo: string } }>) => {
  const r = await p
  return r.ok ? 'ok' : r.error?.codigo
}

beforeAll(async () => {
  const [a, b] = await comoPlataforma(() =>
    Promise.all([
      db.estudio.create({
        data: {
          nombre: 'Acceso A',
          cuit: '30951000001',
          razonSocial: 'Acceso A',
          createdAt: new Date('2095-01-01T00:00:00Z'),
        },
      }),
      db.estudio.create({
        data: {
          nombre: 'Acceso B',
          cuit: '30952000001',
          razonSocial: 'Acceso B',
          createdAt: new Date('2096-01-01T00:00:00Z'),
        },
      }),
    ]),
  )
  ctx.a = a.id
  ctx.b = b.id
  ctx.duenoA = await alta(a.id, 'dueno.a@acceso.test', 'DUENO')
  ctx.contadorA = await alta(a.id, 'contador.a@acceso.test', 'CONTADOR')
  ctx.duenoB = await alta(b.id, 'dueno.b@acceso.test', 'DUENO')
})

afterAll(async () => {
  await borrarIntentos()
  await comoPlataforma(() => db.estudio.deleteMany({ where: { id: { in: [ctx.a, ctx.b] } } }))
})

describe('Entrar', () => {
  it('con la contraseña correcta: la sesión dice quién es, de qué estudio y con qué rol', async () => {
    const r = await entrar(pedido('  Contador.A@Acceso.TEST '))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const horas = (r.vence.getTime() - Date.now()) / 3_600_000
    expect(horas).toBeGreaterThan(7.9)
    expect(horas).toBeLessThan(8.1)
    expect(r.faltaCodigo).toBe(false)
    expect(await sesionDelToken(r.token)).toEqual({
      usuarioId: ctx.contadorA,
      estudioId: ctx.a,
      rol: 'CONTADOR',
      contrasenaProvisoria: true,
      faltaCodigo: false,
      codigoConfigurado: false,
    })
    const u = await comoPlataforma(() =>
      db.usuario.findUniqueOrThrow({ where: { id: ctx.contadorA } }),
    )
    expect(u.ultimoIngreso).not.toBeNull()
  })

  it('"recordar este equipo" deja la sesión 30 días', async () => {
    const r = await entrar(pedido('contador.a@acceso.test', { recordar: true }))
    if (!r.ok) throw new Error(r.error.mensaje)
    const dias = (r.vence.getTime() - Date.now()) / 86_400_000
    expect(dias).toBeGreaterThan(29.9)
    expect(dias).toBeLessThan(30.1)
  })

  it('contraseña equivocada o correo inexistente: el mismo mensaje', async () => {
    expect(
      await codigo(entrar(pedido('dueno.a@acceso.test', { contrasena: 'otra clave larga' }))),
    ).toBe('AUTH-002')
    expect(await codigo(entrar(pedido('nadie@acceso.test')))).toBe('AUTH-002')
    expect(await codigo(entrar(pedido('', { contrasena: '' })))).toBe('AUTH-002')
    await borrarIntentos()
  })

  it('después de 5 fallos seguidos se frena, aunque la contraseña sea correcta', async () => {
    const email = 'contador.a@acceso.test'
    for (let i = 0; i < 5; i++)
      expect(await codigo(entrar(pedido(email, { contrasena: `equivocada numero ${i}` })))).toBe(
        'AUTH-002',
      )
    expect(await codigo(entrar(pedido(email)))).toBe('AUTH-003')
    // Desde otra dirección también: el freno es por correo
    expect(await codigo(entrar(pedido(email, { ip: '10.0.0.2' })))).toBe('AUTH-003')
    await borrarIntentos()
    expect(await codigo(entrar(pedido(email)))).toBe('ok')
  })

  it('30 fallos desde una misma dirección frenan cualquier correo', async () => {
    const ip = '10.9.9.9'
    for (let i = 0; i < 30; i++)
      await entrar(pedido(`nadie${i}@acceso.test`, { ip, contrasena: 'equivocada larga' }))
    expect(await codigo(entrar(pedido('dueno.a@acceso.test', { ip })))).toBe('AUTH-003')
    expect(await codigo(entrar(pedido('dueno.a@acceso.test', { ip: '10.0.0.3' })))).toBe('ok')
    await borrarIntentos()
  })

  it('cuenta o estudio desactivado: lo dice solo con la contraseña correcta, y corta la sesión', async () => {
    const abierta = await entrar(pedido('contador.a@acceso.test'))
    if (!abierta.ok) throw new Error(abierta.error.mensaje)
    await conEstudio(ctx.a, () =>
      db.usuario.update({ where: { id: ctx.contadorA }, data: { activo: false } }),
    )
    expect(await sesionDelToken(abierta.token)).toBeNull()
    expect(await codigo(entrar(pedido('contador.a@acceso.test')))).toBe('AUTH-004')
    expect(
      await codigo(entrar(pedido('contador.a@acceso.test', { contrasena: 'equivocada larga' }))),
    ).toBe('AUTH-002')
    await conEstudio(ctx.a, () =>
      db.usuario.update({ where: { id: ctx.contadorA }, data: { activo: true } }),
    )

    await comoPlataforma(() => db.estudio.update({ where: { id: ctx.b }, data: { activo: false } }))
    expect(await codigo(entrar(pedido('dueno.b@acceso.test')))).toBe('AUTH-004')
    await comoPlataforma(() => db.estudio.update({ where: { id: ctx.b }, data: { activo: true } }))
    await borrarIntentos()
  })
})

describe('Sesiones', () => {
  it('salir la cierra; un número inventado o mal formado no es una sesión', async () => {
    const r = await entrar(pedido('dueno.b@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    expect((await sesionDelToken(r.token))?.estudioId).toBe(ctx.b)
    await salir(r.token)
    expect(await sesionDelToken(r.token)).toBeNull()
    expect(await sesionDelToken('A'.repeat(43))).toBeNull()
    expect(await sesionDelToken("'; DROP TABLE usuarios; --")).toBeNull()
    expect(await sesionDelToken(undefined)).toBeNull()
  })

  it('vencida, no sirve', async () => {
    const r = await entrar(pedido('dueno.b@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    await comoPlataforma(
      () =>
        db.$executeRaw`UPDATE acceso.sesiones SET vence = now() - interval '1 second'
                       WHERE usuario_id = ${ctx.duenoB}::uuid`,
    )
    expect(await sesionDelToken(r.token)).toBeNull()
  })

  it('la base guarda la huella del número, no el número', async () => {
    const r = await entrar(pedido('dueno.b@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    const [fila] = await comoPlataforma(
      () =>
        db.$queryRaw<{ guardado: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM acceso.sesiones
                         WHERE huella = sha256(convert_to(${r.token}, 'UTF8'))) AS guardado`,
    )
    expect(fila?.guardado).toBe(true)
  })
})

describe('Contraseñas', () => {
  it('cambiarla la deja definitiva, cierra las sesiones abiertas y la vieja deja de servir', async () => {
    const r = await entrar(pedido('contador.a@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    const sesion = (await sesionDelToken(r.token))!
    expect(sesion.contrasenaProvisoria).toBe(true)
    expect(await cambiarContrasena(sesion, 'corta')).toMatchObject({
      ok: false,
      error: { codigo: 'FORM-001' },
    })
    expect(await cambiarContrasena(sesion, 'la nueva clave del contador')).toEqual({ ok: true })
    expect(await sesionDelToken(r.token)).toBeNull()
    expect(await codigo(entrar(pedido('contador.a@acceso.test')))).toBe('AUTH-002')
    const nueva = await entrar(
      pedido('contador.a@acceso.test', { contrasena: 'la nueva clave del contador' }),
    )
    if (!nueva.ok) throw new Error(nueva.error.mensaje)
    expect((await sesionDelToken(nueva.token))?.contrasenaProvisoria).toBe(false)
    await borrarIntentos()
  })

  it('quien la cambia sigue adentro en su equipo; en los otros, la sesión se cierra', async () => {
    const huella = await huellaDeContrasena('clave temporal de la prueba')
    await conEstudio(ctx.a, () => fijarContrasena(ctx.contadorA, huella, true))
    const [aca, otro] = await Promise.all([
      entrar(pedido('contador.a@acceso.test', { contrasena: 'clave temporal de la prueba' })),
      entrar(pedido('contador.a@acceso.test', { contrasena: 'clave temporal de la prueba' })),
    ])
    if (!aca.ok || !otro.ok) throw new Error('no entró')
    const sesion = (await sesionDelToken(aca.token))!
    expect(sesion.contrasenaProvisoria).toBe(true)
    expect(await cambiarContrasena(sesion, 'la nueva clave del contador', aca.token)).toEqual({
      ok: true,
    })
    expect(await sesionDelToken(aca.token)).toMatchObject({ contrasenaProvisoria: false })
    expect(await sesionDelToken(otro.token)).toBeNull()
    await borrarIntentos()
  })

  it('desde un estudio no se toca la contraseña de alguien de otro', async () => {
    const huella = await huellaDeContrasena('una clave de intruso larga')
    await expect(
      conEstudio(ctx.a, () => fijarContrasena(ctx.duenoB, huella, false)),
    ).rejects.toThrow()
    expect(await codigo(entrar(pedido('dueno.b@acceso.test')))).toBe('ok')
  })

  it('el correo es uno solo en toda la plataforma', async () => {
    await expect(alta(ctx.b, 'dueno.a@acceso.test', 'CONTADOR')).rejects.toThrow()
  })
})

describe('Siempre un dueño', () => {
  it('no se puede desactivar ni cambiar de rol al único dueño; con otro dueño, sí', async () => {
    const actualizar = (id: string, data: { activo?: boolean; rol?: 'DUENO' | 'CONTADOR' }) =>
      conEstudio(ctx.a, () => db.usuario.update({ where: { id }, data }))
    await expect(actualizar(ctx.duenoA, { activo: false })).rejects.toThrow(/dueño activo/)
    await expect(actualizar(ctx.duenoA, { rol: 'CONTADOR' })).rejects.toThrow(/dueño activo/)
    await actualizar(ctx.contadorA, { rol: 'DUENO' })
    await actualizar(ctx.duenoA, { activo: false })
    await actualizar(ctx.duenoA, { activo: true })
    await actualizar(ctx.contadorA, { rol: 'CONTADOR' })
  })
})

describe('Código del celular', () => {
  const AHORA = 1_900_000_000_000
  const obligatorio = (si: boolean) =>
    comoPlataforma(
      () => db.$executeRaw`UPDATE acceso.ajustes SET codigo_obligatorio_duenos = ${si}`,
    )
  beforeAll(() => obligatorio(true))
  afterAll(() => obligatorio(false))
  const codigoEn = (secreto: Buffer, ms: number) => codigoDelPaso(secreto, pasoDe(ms))
  let secreto: Buffer

  it('el dueño queda a medio entrar: la contraseña sola no alcanza', async () => {
    const r = await entrar(pedido('dueno.a@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    expect(r).toMatchObject({ faltaCodigo: true, codigoConfigurado: false })
    const minutos = (r.vence.getTime() - Date.now()) / 60_000
    expect(minutos).toBeGreaterThan(9.9)
    expect(minutos).toBeLessThan(10.1)
    expect(await sesionDelToken(r.token)).toMatchObject({ faltaCodigo: true, estudioId: ctx.a })
  })

  it('la primera vez lo configura: QR y clave, guardados cifrados, y el código lo completa', async () => {
    const r = await entrar(pedido('dueno.a@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    const preparado = await prepararCodigo(r.token)
    expect(preparado?.direccion).toMatch(
      /^otpauth:\/\/totp\/BalanceRT%3Adueno\.a%40acceso\.test\?secret=/,
    )
    // Volver a la pantalla no cambia el secreto
    expect((await prepararCodigo(r.token))?.claveManual).toBe(preparado?.claveManual)
    secreto = desdeBase32(preparado!.claveManual)
    const [guardado] = await comoPlataforma(
      () =>
        db.$queryRaw<{ secreto: Uint8Array }[]>`
          SELECT secreto FROM acceso.codigos WHERE usuario_id = ${ctx.duenoA}::uuid`,
    )
    expect(Buffer.from(guardado!.secreto).includes(secreto)).toBe(false)

    expect(await verificarCodigo(r.token, '000000', AHORA)).toMatchObject({
      ok: false,
      error: { codigo: 'AUTH-005' },
      sesionCerrada: false,
    })
    expect(await verificarCodigo(r.token, codigoEn(secreto, AHORA), AHORA)).toEqual({ ok: true })
    expect(await sesionDelToken(r.token)).toMatchObject({
      faltaCodigo: false,
      codigoConfigurado: true,
    })
    expect(await prepararCodigo(r.token)).toBeNull()
  })

  it('las veces siguientes pide el código; uno ya usado no vale dos veces', async () => {
    const r = await entrar(pedido('dueno.a@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    expect(r).toMatchObject({ faltaCodigo: true, codigoConfigurado: true })
    expect(await verificarCodigo(r.token, codigoEn(secreto, AHORA), AHORA)).toMatchObject({
      ok: false,
      error: { codigo: 'AUTH-005' },
    })
    const despues = AHORA + 60_000
    expect(await verificarCodigo(r.token, codigoEn(secreto, despues), despues)).toEqual({
      ok: true,
    })
  })

  it('cinco códigos equivocados cierran la sesión', async () => {
    const r = await entrar(pedido('dueno.a@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    for (let i = 0; i < 4; i++)
      expect(await verificarCodigo(r.token, '111111', AHORA)).toMatchObject({
        sesionCerrada: false,
      })
    expect(await verificarCodigo(r.token, '111111', AHORA)).toMatchObject({
      ok: false,
      error: { codigo: 'AUTH-006' },
      sesionCerrada: true,
    })
    expect(await sesionDelToken(r.token)).toBeNull()
    await borrarIntentos()
  })

  it('con el interruptor apagado, el dueño que no lo configuró entra sin código', async () => {
    await obligatorio(false)
    const r = await entrar(pedido('dueno.b@acceso.test'))
    if (!r.ok) throw new Error(r.error.mensaje)
    expect(r).toMatchObject({ faltaCodigo: false, codigoConfigurado: false })
    // El que ya lo tiene configurado lo sigue usando
    const a = await entrar(pedido('dueno.a@acceso.test'))
    if (!a.ok) throw new Error(a.error.mensaje)
    expect(a).toMatchObject({ faltaCodigo: true, codigoConfigurado: true })
    await obligatorio(true)
    await borrarIntentos()
  })

  it('contadores y asistentes entran sin código (salvo que lo activen)', async () => {
    const r = await entrar(
      pedido('contador.a@acceso.test', { contrasena: 'la nueva clave del contador' }),
    )
    if (!r.ok) throw new Error(r.error.mensaje)
    expect(r.faltaCodigo).toBe(false)
    await borrarIntentos()
  })
})

describe('El esquema acceso, cerrado para la app', () => {
  it('la app no lee ni escribe sus tablas', async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL })
    await c.connect()
    try {
      await c.query("SELECT set_config('role', 'balancert_app', false)")
      for (const t of ['contrasenas', 'sesiones', 'intentos', 'codigos', 'ajustes']) {
        await expect(c.query(`SELECT 1 FROM acceso.${t} LIMIT 1`), t).rejects.toThrow(
          /permission denied/,
        )
        await expect(c.query(`DELETE FROM acceso.${t}`), t).rejects.toThrow(/permission denied/)
      }
    } finally {
      await c.end()
    }
  })

  it('cada función corre como su dueño con su search_path, y la app ejecuta solo las de entrar', async () => {
    const funciones = await comoPlataforma(
      () =>
        db.$queryRaw<{ nombre: string; especial: boolean; con_ruta: boolean; la_app: boolean }[]>`
        SELECT p.proname AS nombre, p.prosecdef AS especial,
               coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path=%', false) AS con_ruta,
               has_function_privilege('balancert_app', p.oid, 'EXECUTE') AS la_app
        FROM pg_proc p WHERE p.pronamespace = 'acceso'::regnamespace ORDER BY 1`,
    )
    expect(funciones.every((f) => f.con_ruta)).toBe(true)
    expect(funciones.filter((f) => f.la_app).map((f) => f.nombre)).toEqual([
      'abrir_sesion',
      'aceptar_codigo',
      'cerrar_sesion',
      'codigo_de_la_sesion',
      'codigo_fallido',
      'datos_para_entrar',
      'fijar_contrasena',
      'guardar_codigo',
      'puede_intentar',
      'registrar_intento',
      'sesion_activa',
    ])
    expect(funciones.filter((f) => f.la_app).every((f) => f.especial)).toBe(true)
  })
})
