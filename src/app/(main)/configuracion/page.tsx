import { PageHeader } from '@/components/layout/PageHeader'
import { EstudioForm } from '@/modules/estudios/components/EstudioForm'
import { PreferenciasForm } from '@/modules/estudios/components/PreferenciasForm'
import { findPreferenciasEstudio } from '@/modules/estudios/repository/preferencias.repository'
import { getCurrentEstudio } from '@/lib/estudio-context'

export const metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const estudio = await getCurrentEstudio()
  const preferencias = await findPreferenciasEstudio(estudio.id)

  return (
    <div>
      <PageHeader title="Configuración" description="Datos y apariencia del estudio contable." />
      <div className="space-y-6 px-8 py-6">
        <EstudioForm defaultValues={estudio} redirectTo="/configuracion" />
        <PreferenciasForm inicial={preferencias} />
      </div>
    </div>
  )
}
