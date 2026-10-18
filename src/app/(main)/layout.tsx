import { AppShell } from '@/components/layout/AppShell'
import { PreferenciasProvider } from '@/components/shared/PreferenciasProvider'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { findPreferenciasEstudio } from '@/modules/estudios/repository/preferencias.repository'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const estudioId = await getCurrentEstudioId()
  const preferencias = await findPreferenciasEstudio(estudioId)
  // El acento ya viene validado (acentoSeguro: solo #RRGGBB oscuro), así que es
  // seguro inyectarlo en CSS. Se aplica en :root para que alcance también a los
  // modales que se montan en document.body.
  const css = `:root{--acento:${preferencias.colorPrimario}}`
  return (
    <PreferenciasProvider value={preferencias}>
      <style>{css}</style>
      <AppShell densidad={preferencias.densidadTablas}>{children}</AppShell>
    </PreferenciasProvider>
  )
}
