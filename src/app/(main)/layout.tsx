import { AppShell } from '@/components/layout/AppShell'
import { getCurrentEstudioId } from '@/lib/estudio-context'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await getCurrentEstudioId()
  return <AppShell>{children}</AppShell>
}
