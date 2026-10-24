import Link from 'next/link'
import { Plus, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { RubroBaseTable } from '@/modules/rubros-base/components/RubroBaseTable'
import { findAllRubrosBase } from '@/modules/rubros-base/repository/rubro-base.repository'
import { findAllRubroGrupos } from '@/modules/rubros-grupo/repository/rubro-grupo.repository'

export const metadata = { title: 'Clasificaciones — BalanceRT' }

interface Props {
  searchParams: Promise<{ volver?: string }>
}

export default async function RubrosPage({ searchParams }: Props) {
  const { volver } = await searchParams
  const [rubros, grupos] = await Promise.all([findAllRubrosBase(), findAllRubroGrupos()])

  const nuevoHref = `/configuracion/rubros/nuevo${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`

  return (
    <div>
      <PageHeader
        ayuda="clasificaciones"
        title="Clasificaciones"
        description={`${grupos.length} ${grupos.length === 1 ? 'sección' : 'secciones'} · ${rubros.length} clasificaciones`}
        action={
          <div className="flex items-center gap-2">
            {volver && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={volver}>← Volver a clasificar</Link>
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link href="/configuracion/rubros/nueva-seccion">
                <FolderPlus className="mr-1.5 h-4 w-4" />
                Nueva sección
              </Link>
            </Button>
            <Button asChild>
              <Link href={nuevoHref}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva clasificación
              </Link>
            </Button>
          </div>
        }
      />
      <div className="px-8 py-6">
        <RubroBaseTable rubros={rubros} grupos={grupos} volver={volver} />
      </div>
    </div>
  )
}
