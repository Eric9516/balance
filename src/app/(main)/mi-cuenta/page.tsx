import { PageHeader } from '@/components/layout/PageHeader'
import { exigirSesion } from '@/lib/estudio-context'
import { NOMBRE_DEL_ROL, QUE_HACE_EL_ROL } from '@/modules/acceso/domain/permisos'
import { miCuenta } from '@/modules/acceso/services/usuarios.service'
import { MiContrasena, MisDatos, OtrosEquipos } from '@/modules/acceso/components/MiCuenta'

export const metadata = { title: 'Mi cuenta' }

export default async function MiCuentaPage() {
  const cuenta = await miCuenta(await exigirSesion())

  return (
    <div>
      <PageHeader ayuda="mi-cuenta" title="Mi cuenta" description="Tus datos y tu contraseña." />
      <div className="max-w-2xl space-y-6 px-8 py-6">
        <MisDatos
          datos={{
            nombre: cuenta.nombre,
            email: cuenta.email,
            rol: NOMBRE_DEL_ROL[cuenta.rol],
            queHace: QUE_HACE_EL_ROL[cuenta.rol],
            quienLoCambia:
              cuenta.rol === 'DUENO'
                ? 'Tu rol lo cambia otro dueño del estudio.'
                : 'Tu rol lo cambia el dueño del estudio.',
            estudio: cuenta.estudio.nombre,
          }}
        />
        <MiContrasena />
        <OtrosEquipos />
      </div>
    </div>
  )
}
