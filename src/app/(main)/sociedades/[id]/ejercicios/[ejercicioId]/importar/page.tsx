import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Keyboard } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { ImportarExcelForm } from '@/modules/importaciones/components/ImportarExcelForm'
import { countCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'

export const metadata = { title: 'Importar Excel' }

interface Props {
  params: Promise<{ id: string; ejercicioId: string }>
}

export default async function ImportarPage({ params }: Props) {
  const { id, ejercicioId } = await params

  const [sociedad, ejercicio] = await Promise.all([
    findSociedadById(id),
    findEjercicioById(ejercicioId),
  ])

  if (!sociedad || !ejercicio) notFound()

  const totalCuentas = await countCuentasByEjercicio(ejercicioId)

  return (
    <div>
      <PageHeader
        title="Importar balance de sumas y saldos"
        description={`${sociedad.razonSocial} — ${ejercicio.denominacion}`}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/sociedades/${id}/ejercicios/${ejercicioId}/importar-manual`}>
              <Keyboard className="h-3.5 w-3.5 mr-1.5" />
              Carga manual
            </Link>
          </Button>
        }
      />
      <div className="px-8 py-6">
        <ImportarExcelForm
          ejercicioId={ejercicioId}
          sociedadId={id}
          denominacion={ejercicio.denominacion}
          tieneCuentas={totalCuentas > 0}
        />
      </div>
    </div>
  )
}
