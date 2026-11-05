import { PageHeader } from '@/components/layout/PageHeader'
import { EstudioForm } from '@/modules/estudios/components/EstudioForm'
import { faltaPermiso, getCurrentEstudio } from '@/lib/estudio-context'
import { SinPermiso } from '@/components/shared/SinPermiso'

export const metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const sinPermiso = await faltaPermiso('configurar_estudio')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const estudio = await getCurrentEstudio()

  return (
    <div>
      <PageHeader
        ayuda="estudio"
        title="Configuración"
        description="Los datos del estudio contable."
      />
      <div className="space-y-6 px-8 py-6">
        <EstudioForm defaultValues={estudio} redirectTo="/configuracion" />
      </div>
    </div>
  )
}
