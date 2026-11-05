import { Sidebar, type UsuarioDeLaSesion } from './Sidebar'

export function AppShell({
  children,
  usuario,
}: {
  children: React.ReactNode
  usuario: UsuarioDeLaSesion
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-papel">
      <Sidebar usuario={usuario} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
