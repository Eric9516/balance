import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { StepInfoButton } from '@/components/shared/StepInfoButton'
import { EjercicioTable } from '@/modules/ejercicios/components/EjercicioTable'
import { findEjerciciosBySociedad } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import type { StepInfo } from '@/components/shared/StepInfoButton'

const EJERCICIOS_INFO: StepInfo = {
  title: 'Ejercicios contables',
  purpose:
    'Lista todos los períodos contables de esta sociedad. Desde acá se crea cada ejercicio, se trabaja sobre sus cuentas, anexos y estados, y se vincula con el anterior para generar balances con columna comparativa.',
  sources: [
    'Datos del ejercicio: fechas de inicio y cierre, número de ejercicio, auditor asignado.',
    'Vínculo al ejercicio anterior (opcional): habilita la columna comparativa reexpresada por inflación en todos los estados y anexos.',
  ],
  formulas: ['No aplica — esta pantalla es de gestión, no realiza cálculos contables.'],
  notes: [
    'Vinculá cada ejercicio al anterior desde "Editar" para que los estados muestren columna comparativa.',
    'Una vez vinculados, los ejercicios aparecen conectados visualmente en esta lista.',
  ],
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  return { title: sociedad ? `Ejercicios — ${sociedad.razonSocial}` : 'Ejercicios' }
}

export default async function EjerciciosPage({ params }: Props) {
  const { id } = await params
  const sociedad = await findSociedadById(id)
  if (!sociedad) notFound()

  const ejercicios = await findEjerciciosBySociedad(id)

  return (
    <div>
      <PageHeader
        title={`Ejercicios — ${sociedad.razonSocial}`}
        description="Períodos contables del cliente."
        action={
          <div className="flex items-center gap-2">
            <StepInfoButton info={EJERCICIOS_INFO} />
            <Button variant="secondary" size="sm" asChild>
              <Link href="/sociedades">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Clientes
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/sociedades/${id}/ejercicios/nuevo`}>
                <Plus className="h-4 w-4" />
                Nuevo ejercicio
              </Link>
            </Button>
          </div>
        }
      />
      <div className="px-8 py-6">
        <EjercicioTable ejercicios={ejercicios} sociedadId={id} />
      </div>
    </div>
  )
}
