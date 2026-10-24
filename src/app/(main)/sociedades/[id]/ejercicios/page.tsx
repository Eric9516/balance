import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { EjercicioTable } from '@/modules/ejercicios/components/EjercicioTable'
import { findEjerciciosBySociedad } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  return { title: sociedad ? `Ejercicios — ${sociedad.razonSocial}` : 'Ejercicios' }
}

export default async function EjerciciosPage({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  if (!sociedad) notFound()

  const ejercicios = await findEjerciciosBySociedad(id)

  return (
    <div>
      <PageHeader
        ayuda="ejercicios"
        title={`Ejercicios — ${sociedad.razonSocial}`}
        description="Períodos contables del cliente."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/sociedades">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Clientes
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/sociedades/${id}/ejercicios/nuevo`}>
                <Plus className="h-4 w-4" />
                Nuevo ejercicio
              </Link>
            </Button>
          </div>
        }
      />
      <div className="px-8 py-6">
        <EjercicioTable ejercicios={ejercicios} sociedadId={id} />
      </div>
    </div>
  )
}
