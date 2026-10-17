import { PageHeader } from '@/components/layout/PageHeader'
import { RubroGrupoForm } from '@/modules/rubros-grupo/components/RubroGrupoForm'

export const metadata = { title: 'Nueva sección — BalanceRT' }

export default function NuevaSeccionPage() {
  return (
    <div>
      <PageHeader
        title="Nueva sección"
        description="Las secciones agrupan las clasificaciones en la tabla y en el dropdown."
      />
      <div className="flex justify-center px-8 py-6">
        <RubroGrupoForm />
      </div>
    </div>
  )
}
