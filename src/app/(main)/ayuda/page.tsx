import { PageHeader } from '@/components/layout/PageHeader'
import { CentroAyuda } from '@/modules/ayuda/components/CentroAyuda'

export const metadata = { title: 'Ayuda — BalanceRT' }

export default function AyudaPage() {
  return (
    <div>
      <PageHeader
        title="Ayuda"
        description="Cómo hacer un balance completo con BalanceRT, paso a paso, y qué significa cada mensaje."
      />
      <CentroAyuda />
    </div>
  )
}
