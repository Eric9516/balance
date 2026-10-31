import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { RubroBaseForm } from '@/modules/rubros-base/components/RubroBaseForm'
import { findRubroBaseById } from '@/modules/rubros-base/repository/rubro-base.repository'
import { findAllRubroGrupos } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'
import { faltaPermiso, getCurrentEstudioId } from '@/lib/estudio-context'
import { SinPermiso } from '@/components/shared/SinPermiso'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ volver?: string }>
}

export const metadata = { title: 'Editar clasificación — BalanceRT' }

export default async function EditarRubroPage({ params, searchParams }: Props) {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const { id } = await params
  const { volver } = await searchParams
  const estudioId = await getCurrentEstudioId()
  const [rubro, grupos] = await Promise.all([
    findRubroBaseById(estudioId, id),
    findAllRubroGrupos(estudioId),
  ])
  if (!rubro) notFound()

  const volverHref = `/configuracion/rubros${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`

  return (
    <div>
      <PageHeader
        ayuda="clasificacion"
        title="Editar clasificación"
        description={rubro.nombre}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href={volverHref}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Volver
            </Link>
          </Button>
        }
      />
      <div className="flex justify-center px-8 py-6">
        <RubroBaseForm defaultValues={rubro} grupos={grupos} redirectTo={volverHref} />
      </div>
    </div>
  )
}
