import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { comoPlataforma } from '@/lib/contexto-base'

/**
 * Sin estudio visible: si la base no tiene ninguno, se configura el primero. Si tiene alguno pero la
 * app no lo ve (más de un estudio y todavía sin login, ver contexto-base.ts), no hay a dónde ir: se
 * corta con un error claro en vez de rebotar entre /setup y /sociedades.
 */
async function sinEstudioVisible(): Promise<never> {
  const alguno = await comoPlataforma(() => db.estudio.findFirst({ select: { id: true } }))
  if (alguno) {
    throw new Error(
      'La base tiene más de un estudio y la app todavía no sabe cuál mostrar (falta el login).',
    )
  }
  redirect('/setup')
}

export const getCurrentEstudioId = cache(async (): Promise<string> => {
  const estudio = await db.estudio.findFirst({
    where: { activo: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!estudio) return sinEstudioVisible()
  return estudio.id
})

export const getCurrentEstudio = cache(async () => {
  const estudio = await db.estudio.findFirst({
    where: { activo: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!estudio) return sinEstudioVisible()
  return estudio
})
