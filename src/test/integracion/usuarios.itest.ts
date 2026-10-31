/**
 * Configuración → Usuarios y Mi cuenta (servicio usuarios.service): lo que hace el dueño con su
 * gente y cada persona con su cuenta, con las reglas de Gestión empresarial.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { comoPlataforma } from '@/lib/contexto-base'
import { darDeAltaUsuario, entrar, sesionDelToken } from '@/modules/acceso/services/entrada.service'
import type { SesionActiva } from '@/modules/acceso/repository/acceso.repository'
import {
  activarUsuario,
  agregarUsuario,
  cambiarMiContrasena,
  cambiarMiNombre,
  cambiarRol,
  cerrarOtrasSesiones,
  contrasenaProvisoria,
  eliminarUsuario,
  listarUsuarios,
  nuevaContrasenaProvisoria,
} from '@/modules/acceso/services/usuarios.service'

const CLAVE = 'una clave larga de prueba'
const ctx = { estudio: '', otroEstudio: '', dueno: '', contador: '' }
const IP = '10.0.9.1'

const sesion = (usuarioId: string, rol: SesionActiva['rol']): SesionActiva => ({
  usuarioId,
  estudioId: ctx.estudio,
  rol,
  contrasenaProvisoria: false,
  faltaCodigo: false,
  codigoConfigurado: false,
})
const DUENO = () => sesion(ctx.dueno, 'DUENO')

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

const entrarCon = async (email: string, contrasena = CLAVE) => {
  const r = await entrar({ email, contrasena, recordar: false, ip: IP, navegador: 'pruebas' })
  if (!r.ok) throw new Error(r.error.mensaje)
  return r.token
}

beforeAll(async () => {
  const [e, otro] = await comoPlataforma(() =>
    Promise.all([
      db.estudio.create({
        data: {
          nombre: 'Usuarios',
          cuit: '30931000001',
          razonSocial: 'Usuarios',
          createdAt: new Date('2093-01-01T00:00:00Z'),
        },
      }),
      db.estudio.create({
        data: {
          nombre: 'Usuarios otro',
          cuit: '30932000001',
          razonSocial: 'Usuarios otro',
          createdAt: new Date('2093-02-01T00:00:00Z'),
        },
      }),
    ]),
  )
  ctx.estudio = e.id
  ctx.otroEstudio = otro.id
  ctx.dueno = await alta(e.id, 'dueno@usuarios.test', 'DUENO')
  ctx.contador = await alta(e.id, 'contador@usuarios.test', 'CONTADOR')
  await alta(otro.id, 'dueno@otro-usuarios.test', 'DUENO')
})

afterAll(async () => {
  await comoPlataforma(async () => {
    await db.$executeRaw`DELETE FROM acceso.intentos WHERE email LIKE '%usuarios.test'`
    await db.estudio.deleteMany({ where: { id: { in: [ctx.estudio, ctx.otroEstudio] } } })
  })
})

describe('La contraseña provisoria', () => {
  it('es fácil de dictar: 3 grupos de 4, sin letras ni números que se confunden', () => {
    for (let i = 0; i < 200; i++)
      expect(contrasenaProvisoria()).toMatch(
        /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/,
      )
  })
})

describe('El dueño y su gente', () => {
  it('agrega a una persona con una contraseña provisoria con la que puede entrar', async () => {
    const r = await agregarUsuario(DUENO(), {
      nombre: '  Asistente Nueva ',
      email: ' Asistente@Usuarios.TEST ',
      rol: 'ASISTENTE',
    })
    if (!r.ok) throw new Error(r.error.mensaje)
    const token = await entrarCon('asistente@usuarios.test', r.data.contrasena)
    expect(await sesionDelToken(token)).toMatchObject({
      estudioId: ctx.estudio,
      rol: 'ASISTENTE',
      contrasenaProvisoria: true,
    })
  })

  it('no repite un correo, aunque sea de otro estudio, ni acepta datos vacíos', async () => {
    const repetido = await agregarUsuario(DUENO(), {
      nombre: 'Otra',
      email: 'dueno@otro-usuarios.test',
      rol: 'ASISTENTE',
    })
    expect(repetido.ok || repetido.error.mensaje).toMatch(/Ya hay una cuenta con ese correo/)
    const vacio = await agregarUsuario(DUENO(), {
      nombre: ' ',
      email: 'x@usuarios.test',
      rol: 'ASISTENTE',
    })
    expect(vacio.ok).toBe(false)
    const malCorreo = await agregarUsuario(DUENO(), {
      nombre: 'X',
      email: 'sin arroba',
      rol: 'ASISTENTE',
    })
    expect(malCorreo.ok).toBe(false)
  })

  it('ve solo a la gente de su estudio, con su acceso', async () => {
    const lista = await listarUsuarios(DUENO())
    expect(lista.map((u) => u.email).sort()).toEqual(
      ['asistente@usuarios.test', 'contador@usuarios.test', 'dueno@usuarios.test'].sort(),
    )
    const nueva = lista.find((u) => u.email === 'asistente@usuarios.test')!
    expect(nueva).toMatchObject({ contrasenaProvisoria: true, codigoActivado: false, esVos: false })
    expect(lista.find((u) => u.esVos)?.id).toBe(ctx.dueno)
  })

  it('cambia roles, desactiva y reactiva, pero no a sí mismo', async () => {
    expect((await cambiarRol(DUENO(), ctx.contador, 'ASISTENTE')).ok).toBe(true)
    expect((await cambiarRol(DUENO(), ctx.contador, 'CONTADOR')).ok).toBe(true)
    expect((await activarUsuario(DUENO(), ctx.contador, false)).ok).toBe(true)
    expect((await activarUsuario(DUENO(), ctx.contador, true)).ok).toBe(true)
    for (const r of [
      await cambiarRol(DUENO(), ctx.dueno, 'CONTADOR'),
      await activarUsuario(DUENO(), ctx.dueno, false),
      await eliminarUsuario(DUENO(), ctx.dueno),
      await nuevaContrasenaProvisoria(DUENO(), ctx.dueno),
    ])
      expect(r.ok || r.error.codigo).toBe('NEG-063')
  })

  it('una contraseña provisoria nueva cierra las sesiones de esa persona', async () => {
    const token = await entrarCon('contador@usuarios.test')
    const r = await nuevaContrasenaProvisoria(DUENO(), ctx.contador)
    if (!r.ok) throw new Error(r.error.mensaje)
    expect(await sesionDelToken(token)).toBeNull()
    const nueva = await sesionDelToken(await entrarCon('contador@usuarios.test', r.data.contrasena))
    expect(nueva?.contrasenaProvisoria).toBe(true)
  })

  it('a un dueño no lo elimina: primero le cambia el rol', async () => {
    const segundo = await alta(ctx.estudio, 'segundo@usuarios.test', 'DUENO')
    await expect(eliminarUsuario(DUENO(), segundo)).rejects.toThrow(/cambiale el rol/)
    expect((await cambiarRol(DUENO(), segundo, 'ASISTENTE')).ok).toBe(true)
    expect((await eliminarUsuario(DUENO(), segundo)).ok).toBe(true)
  })

  it('no toca a la gente de otro estudio', async () => {
    const [ajeno] = await comoPlataforma(() =>
      db.usuario.findMany({ where: { estudioId: ctx.otroEstudio }, select: { id: true } }),
    )
    await expect(cambiarRol(DUENO(), ajeno!.id, 'ASISTENTE')).rejects.toThrow()
    await expect(eliminarUsuario(DUENO(), ajeno!.id)).rejects.toThrow()
  })
})

describe('Mi cuenta', () => {
  it('cada uno cambia su nombre', async () => {
    expect((await cambiarMiNombre(sesion(ctx.contador, 'CONTADOR'), ' Contador Pérez ')).ok).toBe(
      true,
    )
    const u = await comoPlataforma(() =>
      db.usuario.findUniqueOrThrow({ where: { id: ctx.contador }, select: { nombre: true } }),
    )
    expect(u.nombre).toBe('Contador Pérez')
    expect((await cambiarMiNombre(DUENO(), '   ')).ok).toBe(false)
  })

  it('cambiar la contraseña pide la actual, cierra los otros equipos y mantiene este', async () => {
    const esteEquipo = await entrarCon('dueno@usuarios.test')
    const otroEquipo = await entrarCon('dueno@usuarios.test')
    const mal = await cambiarMiContrasena(DUENO(), {
      actual: 'no es la actual',
      nueva: 'el mate de las cinco y media',
      token: esteEquipo,
      ip: IP,
    })
    expect(mal.ok || mal.error.mensaje).toMatch(/actual no es correcta/)
    const bien = await cambiarMiContrasena(DUENO(), {
      actual: CLAVE,
      nueva: 'el mate de las cinco y media',
      token: esteEquipo,
      ip: IP,
    })
    expect(bien.ok).toBe(true)
    expect(await sesionDelToken(esteEquipo)).not.toBeNull()
    expect(await sesionDelToken(otroEquipo)).toBeNull()
    await entrarCon('dueno@usuarios.test', 'el mate de las cinco y media')
  })

  it('cerrar en los demás equipos deja abierto este', async () => {
    const clave = 'el mate de las cinco y media'
    const esteEquipo = await entrarCon('dueno@usuarios.test', clave)
    const otroEquipo = await entrarCon('dueno@usuarios.test', clave)
    await cerrarOtrasSesiones(esteEquipo)
    expect(await sesionDelToken(esteEquipo)).not.toBeNull()
    expect(await sesionDelToken(otroEquipo)).toBeNull()
  })
})
