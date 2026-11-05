import { AppShell } from '@/components/layout/AppShell'
import { PreferenciasProvider } from '@/components/shared/PreferenciasProvider'
import { db } from '@/lib/db'
import { exigirSesion } from '@/lib/estudio-context'
import { findPreferenciasEstudio } from '@/modules/estudios/repository/preferencias.repository'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion()
  const [preferencias, usuario] = await Promise.all([
    findPreferenciasEstudio(sesion.estudioId),
    db.usuario.findUniqueOrThrow({
      where: { id: sesion.usuarioId },
      select: { nombre: true, rol: true },
    }),
  ])
  return (
    <PreferenciasProvider value={preferencias}>
      <AppShell densidad={preferencias.densidadTablas} usuario={usuario}>
        {children}
      </AppShell>
    </PreferenciasProvider>
  )
}
