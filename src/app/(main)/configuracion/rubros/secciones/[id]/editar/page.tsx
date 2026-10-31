import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { RubroGrupoForm } from '@/modules/rubros-grupo/components/RubroGrupoForm'
import { findRubroGrupoById } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'
import { faltaPermiso, getCurrentEstudioId } from '@/lib/estudio-context'
import { SinPermiso } from '@/components/shared/SinPermiso'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata = { title: 'Editar sección — BalanceRT' }

export default async function EditarSeccionPage({ params }: Props) {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const { id } = await params
  const grupo = await findRubroGrupoById(await getCurrentEstudioId(), id)
  if (!grupo) notFound()

  return (
    <div>
      <PageHeader ayuda="seccion" title="Editar sección" description={grupo.nombre} />
      <div className="flex justify-center px-8 py-6">
        <RubroGrupoForm defaultValues={grupo} />
      </div>
    </div>
  )
}
