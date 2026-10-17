import { PageHeader } from '@/components/layout/PageHeader'
import { EstudioForm } from '@/modules/estudios/components/EstudioForm'
import { getCurrentEstudio } from '@/lib/estudio-context'

export const metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const estudio = await getCurrentEstudio()

  return (
    <div>
      <PageHeader title="Configuración" description="Datos del estudio contable." />
      <div className="px-8 py-6">
        <EstudioForm defaultValues={estudio} redirectTo="/configuracion" />
      </div>
    </div>
  )
}
