import type { DensidadTablas } from '@prisma/client'
import { Sidebar } from './Sidebar'

export function AppShell({
  children,
  densidad = 'COMODA',
}: {
  children: React.ReactNode
  densidad?: DensidadTablas
}) {
  return (
    <div
      className="flex h-screen overflow-hidden bg-papel"
      data-densidad={densidad === 'COMPACTA' ? 'compacta' : 'comoda'}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
