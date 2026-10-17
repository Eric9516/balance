import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

export default async function HomePage() {
  const estudio = await db.estudio.findFirst({ where: { activo: true }, select: { id: true } })
  if (!estudio) redirect('/setup')
  redirect('/sociedades')
}
