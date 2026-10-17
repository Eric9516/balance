'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, Settings, Scale, BookOpen, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_TRABAJO = [{ href: '/sociedades', label: 'Sociedades', icon: Building2 }]

const NAV_CONFIGURACION = [
  { href: '/auditores', label: 'Auditores', icon: Users },
  { href: '/configuracion/rubros', label: 'Clasificaciones RT 54', icon: Tags },
  { href: '/configuracion', label: 'Estudio', icon: Settings },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-slate-700 text-white'
          : 'text-slate-300 hover:bg-slate-700/60 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/configuracion') {
      return pathname === '/configuracion'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex min-h-screen w-56 flex-shrink-0 flex-col bg-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-700/60 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
          <Scale className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-white">BalanceRT</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 px-3 pt-4">
        {/* Trabajo */}
        <div className="space-y-0.5">
          <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
            Trabajo
          </p>
          {NAV_TRABAJO.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        {/* Configuración */}
        <div className="space-y-0.5">
          <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
            Configuración
          </p>
          {NAV_CONFIGURACION.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700/60 px-3 py-4">
        <NavItem href="/ayuda" label="Ayuda" icon={BookOpen} active={isActive('/ayuda')} />
      </div>
    </aside>
  )
}
