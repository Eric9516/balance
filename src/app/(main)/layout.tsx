import { AppShell } from '@/components/layout/AppShell'
import { db } from '@/lib/db'
import { exigirSesion } from '@/lib/estudio-context'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion()
  const usuario = await db.usuario.findUniqueOrThrow({
    where: { id: sesion.usuarioId },
    select: { nombre: true, rol: true },
  })
  return <AppShell usuario={usuario}>{children}</AppShell>
}
