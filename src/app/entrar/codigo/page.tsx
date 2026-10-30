import { redirect } from 'next/navigation'
import { Smartphone } from 'lucide-react'
import { destinoSeguro } from '@/lib/cookie-sesion'
import { sesionActual } from '@/lib/sesion'
import { MarcoAcceso } from '@/modules/acceso/components/MarcoAcceso'
import { FormCodigo } from '@/modules/acceso/components/FormCodigo'

export const metadata = { title: 'Código del celular' }

export default async function CodigoPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const { volver } = await searchParams
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  if (sesion.contrasenaProvisoria) redirect('/entrar/nueva-contrasena')
  if (!sesion.faltaCodigo) redirect(destinoSeguro(volver))
  if (!sesion.codigoConfigurado) redirect('/entrar/configurar-codigo')
  const destino = destinoSeguro(volver)
  return (
    <MarcoAcceso>
      <div className="rounded-xl border border-slate-200 bg-superficie p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Smartphone className="h-5 w-5" />
        </div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
          Código del celular
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Abrí la app de códigos de tu celular y escribí las 6 cifras de BalanceRT.
        </p>
        <FormCodigo volver={destino === '/' ? undefined : destino} boton="Entrar" />
      </div>
    </MarcoAcceso>
  )
}
