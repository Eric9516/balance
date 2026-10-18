import { notFound } from 'next/navigation'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { DocumentoBalance } from '@/modules/exportacion/components/DocumentoBalance'
import { armarEncabezado } from '@/modules/exportacion/domain/documento'
import { cargarDocumentoBalance } from '@/modules/exportacion/services/documento.service'

interface Props {
  params: Promise<{ id: string; ejercicioId: string }>
}

// Solo los datos del título: el documento completo se arma una vez, en la página.
export async function generateMetadata({ params }: Props) {
  const { id, ejercicioId } = await params
  const [sociedad, ejercicio] = await Promise.all([
    findSociedadById(id),
    findEjercicioById(ejercicioId),
  ])
  if (!sociedad || !ejercicio) return { title: 'Imprimir' }
  const encabezado = armarEncabezado(sociedad, ejercicio)
  return { title: `${encabezado.razonSocial} — ${encabezado.linea}` }
}

export default async function ImprimirPage({ params }: Props) {
  const { id, ejercicioId } = await params
  const doc = await cargarDocumentoBalance(ejercicioId)
  if (!doc || doc.sociedadId !== id) notFound()
  return (
    <DocumentoBalance
      doc={doc}
      volverHref={`/sociedades/${id}/ejercicios/${ejercicioId}/cuentas?paso=estados`}
    />
  )
}
