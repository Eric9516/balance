import { redirect } from 'next/navigation'
import { destinoSeguro } from '@/lib/cookie-sesion'
import { sesionActual } from '@/lib/sesion'
import { MarcoAcceso } from '@/modules/acceso/components/MarcoAcceso'
import { FormNuevaContrasena } from '@/modules/acceso/components/FormNuevaContrasena'

export const metadata = { title: 'Elegí tu contraseña' }

export default async function NuevaContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const { volver } = await searchParams
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  if (!sesion.contrasenaProvisoria) redirect(destinoSeguro(volver))
  const destino = destinoSeguro(volver)
  return (
    <MarcoAcceso>
      <FormNuevaContrasena volver={destino === '/' ? undefined : destino} />
    </MarcoAcceso>
  )
}
