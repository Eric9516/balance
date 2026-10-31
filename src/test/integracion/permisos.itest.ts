/**
 * Permisos por rol, controlados por la base (migración 20261030235000_permisos_por_rol): cada rol
 * intenta lo que puede y lo que no, declarando quién es como lo hace la app con la sesión.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), refresh: vi.fn() }))

import { db } from '@/lib/db'
import { comoPlataforma, conEstudio, type Quien } from '@/lib/contexto-base'
import { darDeAltaUsuario } from '@/modules/acceso/services/entrada.service'
import { fijarContrasena } from '@/modules/acceso/repository/acceso.repository'
import { huellaDeContrasena } from '@/modules/acceso/infra/contrasenas'

const CLAVE = 'una clave larga de prueba'
const ctx = { estudio: '', ejercicio: '', dueno: '', contador: '', asistente: '', otro: '' }
const como = <T>(quien: Quien, fn: () => Promise<T>) => conEstudio(ctx.estudio, fn, quien)
const DUENO = (): Quien => ({ usuarioId: ctx.dueno, rol: 'DUENO' })
const CONTADOR = (): Quien => ({ usuarioId: ctx.contador, rol: 'CONTADOR' })
const ASISTENTE = (): Quien => ({ usuarioId: ctx.asistente, rol: 'ASISTENTE' })

async function alta(email: string, rol: 'DUENO' | 'CONTADOR' | 'ASISTENTE') {
  const r = await darDeAltaUsuario({
    estudioId: ctx.estudio,
    email,
    nombre: email,
    rol,
    contrasenaProvisoria: CLAVE,
  })
  if (!r.ok) throw new Error(r.error.mensaje)
  return r.usuarioId
}

const ejercicio = (data: Record<string, unknown>) =>
  db.ejercicioContable.update({ where: { id: ctx.ejercicio }, data })

beforeAll(async () => {
  await comoPlataforma(async () => {
    const e = await db.estudio.create({
      data: {
        nombre: 'Permisos',
        cuit: '30961000001',
        razonSocial: 'Permisos',
        createdAt: new Date('2094-01-01T00:00:00Z'),
      },
    })
    ctx.estudio = e.id
    const s = await db.sociedad.create({
      data: { estudioId: e.id, razonSocial: 'Sociedad permisos', cuit: '30961000002' },
    })
    ctx.ejercicio = (
      await db.ejercicioContable.create({
        data: {
          estudioId: e.id,
          sociedadId: s.id,
          fechaInicio: new Date('2025-01-01'),
          fechaCierre: new Date('2025-12-31'),
          denominacion: 'Ejercicio permisos',
          estado: 'EN_PROCESO',
        },
      })
    ).id
  })
  ctx.dueno = await alta('dueno@permisos.test', 'DUENO')
  ctx.contador = await alta('contador@permisos.test', 'CONTADOR')
  ctx.asistente = await alta('asistente@permisos.test', 'ASISTENTE')
  ctx.otro = await alta('otro@permisos.test', 'ASISTENTE')
})

afterAll(async () => {
  await comoPlataforma(async () => {
    await db.ejercicioContable.deleteMany({ where: { estudioId: ctx.estudio } })
    await db.sociedad.deleteMany({ where: { estudioId: ctx.estudio } })
    await db.estudio.deleteMany({ where: { id: ctx.estudio } })
  })
})

describe('El asistente', () => {
  it('carga y edita el ejercicio y desconfirma, pero no confirma, autoriza, revisa, cierra ni elimina', async () => {
    await como(ASISTENTE(), async () => {
      await ejercicio({ denominacion: 'Cambiada por el asistente' })
      await ejercicio({ estadosConfirmado: false, pnConfirmado: false })
      for (const data of [
        { estadosConfirmado: true },
        { pnConfirmado: true },
        { comparativoAutorizadoEn: new Date(), comparativoAutorizadoPor: 'Asistente' },
        { estado: 'REVISION' },
      ])
        await expect(ejercicio(data), JSON.stringify(data)).rejects.toThrow(/asistente/)
      await expect(db.ejercicioContable.delete({ where: { id: ctx.ejercicio } })).rejects.toThrow(
        /asistente/,
      )
      await db.cuentaContable.create({
        data: { ejercicioId: ctx.ejercicio, codigo: '1', nombre: 'Caja' },
      })
    })
  })

  it('no toca auditores, clasificaciones, secciones, la gente ni el estudio', async () => {
    await como(ASISTENTE(), async () => {
      const rubro = await db.rubroBase.findFirstOrThrow({ select: { id: true } })
      await expect(
        db.auditor.create({ data: { estudioId: ctx.estudio, nombre: 'A', apellido: 'B' } }),
      ).rejects.toThrow(/asistente/)
      await expect(
        db.rubroBase.update({ where: { id: rubro.id }, data: { nombre: 'Otra' } }),
      ).rejects.toThrow(/asistente/)
      await expect(
        db.rubroGrupo.create({ data: { estudioId: ctx.estudio, nombre: 'S', orden: 1 } }),
      ).rejects.toThrow(/asistente/)
      await expect(
        db.usuario.update({ where: { id: ctx.otro }, data: { activo: false } }),
      ).rejects.toThrow(/dueño/)
      await expect(
        db.estudio.update({ where: { id: ctx.estudio }, data: { nombre: 'Otro' } }),
      ).rejects.toThrow(/dueño/)
    })
  })

  it('cambia su propio nombre, pero no su rol ni a otros', async () => {
    await como(ASISTENTE(), async () => {
      await db.usuario.update({ where: { id: ctx.asistente }, data: { nombre: 'Asistente Pérez' } })
      await expect(
        db.usuario.update({ where: { id: ctx.asistente }, data: { rol: 'DUENO' } }),
      ).rejects.toThrow(/dueño/)
      await expect(
        db.usuario.update({ where: { id: ctx.otro }, data: { nombre: 'Otro' } }),
      ).rejects.toThrow(/dueño/)
    })
  })

  it('cambia su propia contraseña, pero no la de otro', async () => {
    const huella = await huellaDeContrasena('otra clave larga del asistente')
    await como(ASISTENTE(), () => fijarContrasena(ctx.asistente, huella, false))
    await expect(
      como(ASISTENTE(), () => fijarContrasena(ctx.otro, huella, false)),
    ).rejects.toThrow()
  })
})

describe('El contador', () => {
  it('confirma, autoriza, pasa a revisión y configura auditores, pero no la gente ni el estudio', async () => {
    await como(CONTADOR(), async () => {
      await ejercicio({ estadosConfirmado: true, pnConfirmado: true })
      await ejercicio({ estado: 'REVISION' })
      await ejercicio({ estado: 'EN_PROCESO', estadosConfirmado: false, pnConfirmado: false })
      await db.auditor.create({ data: { estudioId: ctx.estudio, nombre: 'C', apellido: 'D' } })
      await expect(
        db.usuario.update({ where: { id: ctx.otro }, data: { rol: 'CONTADOR' } }),
      ).rejects.toThrow(/dueño/)
      await expect(
        db.estudio.update({ where: { id: ctx.estudio }, data: { nombre: 'Otro' } }),
      ).rejects.toThrow(/dueño/)
      await expect(db.$queryRaw`SELECT * FROM acceso.estado_de_usuarios()`).rejects.toThrow(/dueño/)
    })
  })
})

describe('El dueño', () => {
  it('maneja a su gente: cambia roles, desactiva y ve su acceso', async () => {
    await como(DUENO(), async () => {
      await db.usuario.update({ where: { id: ctx.otro }, data: { rol: 'CONTADOR' } })
      await db.usuario.update({ where: { id: ctx.otro }, data: { activo: false } })
      await db.usuario.update({ where: { id: ctx.otro }, data: { activo: true, rol: 'ASISTENTE' } })
      const estado = await db.$queryRaw<{ usuario_id: string; contrasena_provisoria: boolean }[]>`
        SELECT usuario_id, contrasena_provisoria FROM acceso.estado_de_usuarios()`
      expect(estado.map((e) => e.usuario_id).sort()).toEqual(
        [ctx.dueno, ctx.contador, ctx.asistente, ctx.otro].sort(),
      )
      await db.estudio.update({ where: { id: ctx.estudio }, data: { nombre: 'Permisos SRL' } })
    })
  })

  it('no se elimina, no se desactiva ni se cambia el rol a sí mismo, y a un dueño no lo elimina', async () => {
    const segundo = await alta('segundo.dueno@permisos.test', 'DUENO')
    await como(DUENO(), async () => {
      await expect(db.usuario.delete({ where: { id: ctx.dueno } })).rejects.toThrow(/propia/)
      await expect(
        db.usuario.update({ where: { id: ctx.dueno }, data: { activo: false } }),
      ).rejects.toThrow(/propio rol/)
      await expect(
        db.usuario.update({ where: { id: ctx.dueno }, data: { rol: 'CONTADOR' } }),
      ).rejects.toThrow(/propio rol/)
      await expect(db.usuario.delete({ where: { id: segundo } })).rejects.toThrow(/cambiale el rol/)
      await db.usuario.update({ where: { id: segundo }, data: { rol: 'CONTADOR' } })
      await db.usuario.delete({ where: { id: segundo } })
    })
  })

  it('le da una contraseña nueva a otro y le puede quitar el código del celular', async () => {
    const huella = await huellaDeContrasena('nueva provisoria del asistente')
    await como(DUENO(), async () => {
      await fijarContrasena(ctx.otro, huella, true)
      await db.$executeRaw`SELECT acceso.quitar_codigo(${ctx.otro}::uuid)`
    })
  })
})

describe('Sin rol declarado (tareas internas)', () => {
  it('no limita por rol, pero sigue sin cruzar estudios', async () => {
    await conEstudio(ctx.estudio, async () => {
      await ejercicio({ estadosConfirmado: true })
      await ejercicio({ estadosConfirmado: false })
    })
  })
})
