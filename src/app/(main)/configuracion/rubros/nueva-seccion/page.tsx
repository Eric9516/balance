import { PageHeader } from '@/components/layout/PageHeader'
import { RubroGrupoForm } from '@/modules/rubros-grupo/components/RubroGrupoForm'
import { SinPermiso } from '@/components/shared/SinPermiso'
import { faltaPermiso } from '@/lib/estudio-context'

export const metadata = { title: 'Nueva sección — BalanceRT' }

export default async function NuevaSeccionPage() {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  return (
    <div>
      <PageHeader
        ayuda="seccion"
        title="Nueva sección"
        description="Las secciones agrupan las clasificaciones en la tabla y en el dropdown."
      />
      <div className="flex justify-center px-8 py-6">
        <RubroGrupoForm />
      </div>
    </div>
  )
}
