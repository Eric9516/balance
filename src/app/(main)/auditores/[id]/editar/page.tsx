import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { AuditorForm } from '@/modules/auditores/components/AuditorForm'
import { findAuditorById } from '@/modules/auditores/repository/auditor.repository'
import { SinPermiso } from '@/components/shared/SinPermiso'
import { faltaPermiso } from '@/lib/estudio-context'

export const metadata = { title: 'Editar auditor' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarAuditorPage({ params }: Props) {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const { id } = await params
  const auditor = await findAuditorById(id)
  if (!auditor) notFound()

  return (
    <div>
      <PageHeader ayuda="auditor" title="Editar auditor" description={auditor.nombreCompleto} />
      <div className="px-8 py-6">
        <AuditorForm defaultValues={auditor} />
      </div>
    </div>
  )
}
