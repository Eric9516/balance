import { PageHeader } from '@/components/layout/PageHeader'
import { SociedadForm } from '@/modules/sociedades/components/SociedadForm'

export const metadata = { title: 'Nueva sociedad' }

export default function NuevaSociedadPage() {
  return (
    <div>
      <PageHeader
        title="Nueva sociedad"
        description="Completá los datos de la empresa o persona."
      />
      <div className="px-8 py-6">
        <SociedadForm />
      </div>
    </div>
  )
}
