import { PageHeader } from '@/components/layout/PageHeader'
import { AuditorForm } from '@/modules/auditores/components/AuditorForm'
import { SinPermiso } from '@/components/shared/SinPermiso'
import { faltaPermiso } from '@/lib/estudio-context'

export const metadata = { title: 'Nuevo auditor' }

export default async function NuevoAuditorPage() {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  return (
    <div>
      <PageHeader
        ayuda="auditor"
        title="Nuevo auditor"
        description="Completá los datos del profesional."
      />
      <div className="px-8 py-6">
        <AuditorForm />
      </div>
    </div>
  )
}
