import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { renderSVG } from 'uqr'
import { destinoSeguro } from '@/lib/cookie-sesion'
import { sesionActual, tokenDeLaCookie } from '@/lib/sesion'
import { MarcoAcceso } from '@/modules/acceso/components/MarcoAcceso'
import { FormCodigo } from '@/modules/acceso/components/FormCodigo'
import { prepararCodigo } from '@/modules/acceso/services/entrada.service'

export const metadata = { title: 'Configurar el código del celular' }

export default async function ConfigurarCodigoPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  const { volver } = await searchParams
  const sesion = await sesionActual()
  if (!sesion) redirect('/entrar')
  if (sesion.contrasenaProvisoria) redirect('/entrar/nueva-contrasena')
  if (!sesion.faltaCodigo) redirect(destinoSeguro(volver))
  if (sesion.codigoConfigurado) redirect('/entrar/codigo')
  const codigo = await prepararCodigo(await tokenDeLaCookie())
  if (!codigo) redirect('/entrar')
  const destino = destinoSeguro(volver)
  // El QR lo arma uqr a partir de la dirección otpauth: es un SVG sin nada que venga de afuera
  const qr = renderSVG(codigo.direccion, { border: 1 })

  return (
    <MarcoAcceso>
      <div className="rounded-xl border border-slate-200 bg-superficie p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
          Configurá el código del celular
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Como dueño del estudio, además de la contraseña vas a usar un código que muestra tu
          celular. Se configura una sola vez.
        </p>

        <ol className="mt-6 space-y-5 text-sm text-slate-700">
          <li>
            <p className="font-medium text-slate-900">1. Instalá una app de códigos</p>
            <p className="mt-1 text-slate-500">
              Google Authenticator o Microsoft Authenticator, gratis en la tienda de tu celular.
            </p>
          </li>
          <li>
            <p className="font-medium text-slate-900">2. Escaneá este código con la app</p>
            <div
              className="mt-3 h-44 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white p-1"
              role="img"
              aria-label="Código QR para cargar BalanceRT en la app del celular"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <p className="mt-3 text-slate-500">
              ¿No podés escanearlo? Escribí esta clave en la app:
            </p>
            <p
              id="clave-manual"
              className="mt-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-[13px] tracking-wide break-words text-slate-800 select-all"
            >
              {codigo.claveManual}
            </p>
          </li>
          <li>
            <p className="font-medium text-slate-900">3. Escribí el número que aparece</p>
          </li>
        </ol>

        <FormCodigo volver={destino === '/' ? undefined : destino} boton="Confirmar y entrar" />
      </div>
    </MarcoAcceso>
  )
}
