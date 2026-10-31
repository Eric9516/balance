import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { AuditorTable } from '@/modules/auditores/components/AuditorTable'
import { findAuditoresByEstudio } from '@/modules/auditores/repository/auditor.repository'
import { faltaPermiso, getCurrentEstudioId } from '@/lib/estudio-context'
import { SinPermiso } from '@/components/shared/SinPermiso'

export const metadata = { title: 'Auditores' }

export default async function AuditoresPage() {
  const sinPermiso = await faltaPermiso('configurar_criterios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const estudioId = await getCurrentEstudioId()
  const auditores = await findAuditoresByEstudio(estudioId)

  return (
    <div>
      <PageHeader
        ayuda="auditores"
        title="Auditores"
        description="Contadores y profesionales habilitados para firmar estados contables."
        action={
          <Button asChild>
            <Link href="/auditores/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo auditor
            </Link>
          </Button>
        }
      />
      <div className="px-8 py-6">
        <AuditorTable auditores={auditores} />
      </div>
    </div>
  )
}
