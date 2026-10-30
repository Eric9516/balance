'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, Settings, Scale, BookOpen, Tags, LogOut } from 'lucide-react'
import type { RolUsuario } from '@prisma/client'
import { cn } from '@/lib/utils'
import { salirAction } from '@/modules/acceso/actions/acceso.actions'

export type UsuarioDeLaSesion = { nombre: string; rol: RolUsuario }

const NOMBRE_DEL_ROL: Record<RolUsuario, string> = {
  DUENO: 'Dueño',
  CONTADOR: 'Contador',
  ASISTENTE: 'Asistente',
}

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

export function Sidebar({ usuario }: { usuario: UsuarioDeLaSesion }) {
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
        <span className="font-serif text-[17px] font-semibold tracking-tight text-white">
          Balance<span className="text-blue-300">RT</span>
        </span>
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

      {/* Quién está usando la app */}
      <div className="flex items-center gap-2 border-t border-slate-700/60 px-3 py-3">
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-sm font-medium text-white" title={usuario.nombre}>
            {usuario.nombre}
          </p>
          <p className="text-xs text-slate-400">{NOMBRE_DEL_ROL[usuario.rol]}</p>
        </div>
        <form action={salirAction}>
          <button
            type="submit"
            title="Salir"
            aria-label="Salir"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-700/60 hover:text-white focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  )
}
