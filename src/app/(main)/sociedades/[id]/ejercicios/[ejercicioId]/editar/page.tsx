import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { EjercicioForm } from '@/modules/ejercicios/components/EjercicioForm'
import {
  findEjercicioById,
  findEjerciciosBySociedad,
} from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findAuditoresByEstudio } from '@/modules/auditores/repository/auditor.repository'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import { db } from '@/lib/db'

interface Props {
  params: Promise<{ id: string; ejercicioId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { ejercicioId } = await params
  const ejercicio = await findEjercicioById(ejercicioId)
  return { title: ejercicio ? `Editar — ${ejercicio.denominacion}` : 'Editar ejercicio' }
}

export default async function EditarEjercicioPage({ params }: Props) {
  const { id, ejercicioId } = await params

  const [sociedad, ejercicio] = await Promise.all([
    findSociedadById(id),
    findEjercicioById(ejercicioId),
  ])

  if (!sociedad || !ejercicio) notFound()

  const estudioId = await getCurrentEstudioId()
  const [auditores, todosEjercicios] = await Promise.all([
    findAuditoresByEstudio(estudioId),
    findEjerciciosBySociedad(id),
  ])

  const auditoresActivos = auditores.filter((a) => a.activo)
  const ejerciciosAnteriores = todosEjercicios.filter((e) => e.id !== ejercicioId)

  // Ejercicio que usa a este como comparativo (sucesor en la cadena)
  const sucedidoPor = todosEjercicios.find((e) => e.ejercicioAnteriorId === ejercicioId) ?? null

  // ¿Ya hay comparativos manuales cargados?
  const countComparativos = await db.comparativoManual.count({ where: { ejercicioId } })
  const tieneComparativos = countComparativos > 0

  return (
    <div>
      <PageHeader
        title="Editar ejercicio"
        description={`${sociedad.razonSocial} — ${ejercicio.denominacion}`}
      />
      <div className="px-8 py-6">
        <EjercicioForm
          sociedadId={id}
          auditores={auditoresActivos}
          ejerciciosAnteriores={ejerciciosAnteriores}
          defaultValues={ejercicio}
          sucedidoPor={sucedidoPor}
          tieneComparativos={tieneComparativos}
        />
      </div>
    </div>
  )
}
