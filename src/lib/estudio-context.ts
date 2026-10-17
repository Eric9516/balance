import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

export const getCurrentEstudioId = cache(async (): Promise<string> => {
  const estudio = await db.estudio.findFirst({
    where: { activo: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!estudio) redirect('/setup')
  return estudio.id
})

export const getCurrentEstudio = cache(async () => {
  const estudio = await db.estudio.findFirst({
    where: { activo: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!estudio) redirect('/setup')
  return estudio
})
