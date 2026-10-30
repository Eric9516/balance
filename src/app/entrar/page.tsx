import { redirect } from 'next/navigation'
import { destinoSeguro } from '@/lib/cookie-sesion'
import { sesionActual } from '@/lib/sesion'
import { MarcoAcceso } from '@/modules/acceso/components/MarcoAcceso'
import { FormEntrar } from '@/modules/acceso/components/FormEntrar'

export const metadata = { title: 'Entrar' }

const AVISOS: Record<string, string> = {
  salir: 'Saliste de BalanceRT.',
  codigo: 'Cinco códigos equivocados seguidos: por seguridad, volvé a entrar con tu contraseña.',
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ listo?: string; volver?: string }>
}) {
  const { listo, volver } = await searchParams
  if (await sesionActual()) redirect(destinoSeguro(volver))
  const destino = destinoSeguro(volver)
  return (
    <MarcoAcceso>
      <FormEntrar
        aviso={listo ? AVISOS[listo] : undefined}
        volver={destino === '/' ? undefined : destino}
      />
    </MarcoAcceso>
  )
}
