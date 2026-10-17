import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { RubroBaseForm } from '@/modules/rubros-base/components/RubroBaseForm'
import { findAllRubroGrupos } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'

export const metadata = { title: 'Nueva clasificación — BalanceRT' }

interface Props {
  searchParams: Promise<{ volver?: string; grupoId?: string }>
}

export default async function NuevoRubroPage({ searchParams }: Props) {
  const { volver, grupoId } = await searchParams
  const [grupos] = await Promise.all([findAllRubroGrupos()])
  const volverHref = `/configuracion/rubros${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`

  return (
    <div>
      <PageHeader
        title="Nueva clasificación"
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
        <RubroBaseForm grupos={grupos} defaultGrupoId={grupoId} redirectTo={volverHref} />
      </div>
    </div>
  )
}
