import { PageHeader } from '@/components/layout/PageHeader'
import { AuditorForm } from '@/modules/auditores/components/AuditorForm'

export const metadata = { title: 'Nuevo auditor' }

export default function NuevoAuditorPage() {
  return (
    <div>
      <PageHeader title="Nuevo auditor" description="Completá los datos del profesional." />
      <div className="px-8 py-6">
        <AuditorForm />
      </div>
    </div>
  )
}
