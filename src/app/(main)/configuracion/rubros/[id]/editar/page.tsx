import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { RubroBaseForm } from '@/modules/rubros-base/components/RubroBaseForm'
import { findRubroBaseById } from '@/modules/rubros-base/repository/rubro-base.repository'
import { findAllRubroGrupos } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ volver?: string }>
}

export const metadata = { title: 'Editar clasificación — BalanceRT' }

export default async function EditarRubroPage({ params, searchParams }: Props) {
  const { id } = await params
  const { volver } = await searchParams
  const [rubro, grupos] = await Promise.all([
    findRubroBaseById(id),
    findAllRubroGrupos(),
  ])
  if (!rubro) notFound()

  const volverHref = `/configuracion/rubros${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`

  return (
    <div>
      <PageHeader
        title="Editar clasificación"
        description={rubro.nombre}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href={volverHref}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Volver
            </Link>
          </Button>
        }
      />
      <div className="px-8 py-6 flex justify-center">
        <RubroBaseForm defaultValues={rubro} grupos={grupos} redirectTo={volverHref} />
      </div>
    </div>
  )
}
