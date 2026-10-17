import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { AuditorForm } from '@/modules/auditores/components/AuditorForm'
import { findAuditorById } from '@/modules/auditores/repository/auditor.repository'

export const metadata = { title: 'Editar auditor' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarAuditorPage({ params }: Props) {
  const { id } = await params
  const auditor = await findAuditorById(id)
  if (!auditor) notFound()

  return (
    <div>
      <PageHeader
        title="Editar auditor"
        description={auditor.nombreCompleto}
      />
      <div className="px-8 py-6">
        <AuditorForm defaultValues={auditor} />
      </div>
    </div>
  )
}
