import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { EjercicioForm } from '@/modules/ejercicios/components/EjercicioForm'
import { findResumenesBySociedad } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findAuditoresByEstudio } from '@/modules/auditores/repository/auditor.repository'
import { getCurrentEstudioId } from '@/lib/estudio-context'

export const metadata = { title: 'Nuevo ejercicio' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function NuevoEjercicioPage({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  if (!sociedad) notFound()

  const estudioId = await getCurrentEstudioId()
  const [auditores, ejercicios] = await Promise.all([
    findAuditoresByEstudio(estudioId),
    findResumenesBySociedad(id),
  ])

  const auditoresActivos = auditores.filter((a) => a.activo)

  return (
    <div>
      <PageHeader ayuda="ejercicio" title="Nuevo ejercicio" description={sociedad.razonSocial} />
      <div className="px-8 py-6">
        <EjercicioForm
          sociedadId={id}
          auditores={auditoresActivos}
          ejerciciosAnteriores={ejercicios}
          categoriaEnteDefault={sociedad.categoriaEnte}
        />
      </div>
    </div>
  )
}
