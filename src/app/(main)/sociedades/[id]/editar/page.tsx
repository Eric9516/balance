import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SociedadForm } from '@/modules/sociedades/components/SociedadForm'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'

export const metadata = { title: 'Editar sociedad' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarSociedadPage({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  if (!sociedad) notFound()

  return (
    <div>
      <PageHeader
        title="Editar sociedad"
        description={sociedad.razonSocial}
      />
      <div className="px-8 py-6">
        <SociedadForm defaultValues={sociedad} />
      </div>
    </div>
  )
}
