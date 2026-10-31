import type { RolUsuario } from '@prisma/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { SinPermiso } from '@/components/shared/SinPermiso'
import { exigirSesion, faltaPermiso } from '@/lib/estudio-context'
import { NOMBRE_DEL_ROL, QUE_HACE_EL_ROL } from '@/modules/acceso/domain/permisos'
import { listarUsuarios } from '@/modules/acceso/services/usuarios.service'
import { AltaUsuario } from '@/modules/acceso/components/AltaUsuario'
import { UsuariosTabla } from '@/modules/acceso/components/UsuariosTabla'

export const metadata = { title: 'Usuarios' }

const ROLES: RolUsuario[] = ['DUENO', 'CONTADOR', 'ASISTENTE']

export default async function UsuariosPage() {
  const sinPermiso = await faltaPermiso('gestionar_usuarios')
  if (sinPermiso) return <SinPermiso error={sinPermiso} />
  const usuarios = await listarUsuarios(await exigirSesion())

  return (
    <div>
      <PageHeader
        ayuda="usuarios"
        title="Usuarios"
        description="La gente del estudio y qué puede hacer cada uno."
        action={<AltaUsuario />}
      />
      <div className="space-y-6 px-8 py-6">
        <UsuariosTabla usuarios={usuarios} />
        <section aria-labelledby="que-puede-cada-rol">
          <h2
            id="que-puede-cada-rol"
            className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
          >
            Qué puede cada rol
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                <p className="text-sm font-medium text-slate-900">{NOMBRE_DEL_ROL[r]}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{QUE_HACE_EL_ROL[r]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
