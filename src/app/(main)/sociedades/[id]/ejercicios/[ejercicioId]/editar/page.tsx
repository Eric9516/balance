import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { EjercicioForm } from '@/modules/ejercicios/components/EjercicioForm'
import {
  findEjercicioById,
  findResumenesBySociedad,
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
  const [auditores, resumenes, countComparativos] = await Promise.all([
    findAuditoresByEstudio(estudioId),
    // Resúmenes livianos: el formulario calcula los elegibles (excluye al propio) y el candidato.
    findResumenesBySociedad(id),
    // ¿Ya hay importes manuales del ejercicio anterior cargados?
    db.comparativoManual.count({ where: { ejercicioId } }),
  ])

  const auditoresActivos = auditores.filter((a) => a.activo)

  // Ejercicio que usa a este como ejercicio anterior (sucesor en la cadena)
  const sucedidoPor = resumenes.find((e) => e.ejercicioAnteriorId === ejercicioId) ?? null

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
          ejerciciosAnteriores={resumenes}
          defaultValues={ejercicio}
          sucedidoPor={sucedidoPor}
          tieneComparativos={countComparativos > 0}
          categoriaEnteDefault={sociedad.categoriaEnte}
        />
      </div>
    </div>
  )
}
