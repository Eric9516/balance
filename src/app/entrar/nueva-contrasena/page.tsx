import { redirect } from 'next/navigation'
import { sesionActual } from '@/lib/sesion'
import { MarcoAcceso } from '@/modules/acceso/components/MarcoAcceso'
import { FormNuevaContrasena } from '@/modules/acceso/components/FormNuevaContrasena'

export const metadata = { title: 'Elegí tu contraseña' }

export default async function NuevaContrasenaPage() {
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  if (!sesion.contrasenaProvisoria) redirect('/')
  return (
    <MarcoAcceso>
      <FormNuevaContrasena />
    </MarcoAcceso>
  )
}
