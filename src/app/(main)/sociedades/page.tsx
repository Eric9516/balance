import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { SociedadTable } from '@/modules/sociedades/components/SociedadTable'
import { findSociedadesByEstudio } from '@/modules/sociedades/repository/sociedad.repository'
import { getCurrentEstudioId } from '@/lib/estudio-context'

export const metadata = { title: 'Sociedades' }

export default async function SociedadesPage() {
  const estudioId = await getCurrentEstudioId()
  const sociedades = await findSociedadesByEstudio(estudioId)

  return (
    <div>
      <PageHeader
        ayuda="sociedades"
        title="Sociedades"
        description="Empresas y personas para las que se generan estados contables."
        action={
          <Button asChild>
            <Link href="/sociedades/nueva">
              <Plus className="h-4 w-4" />
              Nueva sociedad
            </Link>
          </Button>
        }
      />
      <div className="px-8 py-6">
        <SociedadTable sociedades={sociedades} />
      </div>
    </div>
  )
}
