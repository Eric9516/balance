'use client'

import { useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'

export type ParaPasar = { nombre: string; email: string; contrasena: string; nueva: boolean }

/**
 * La contraseña provisoria recién creada, para pasársela a la persona. Se muestra una sola vez: la
 * base guarda solo su huella, y al entrar la persona la cambia por una suya.
 */
export function ContrasenaParaPasar({
  datos,
  onClose,
}: {
  datos: ParaPasar | null
  onClose: () => void
}) {
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    if (!datos) return
    try {
      await navigator.clipboard.writeText(datos.contrasena)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 2000)
    } catch {
      // Sin permiso para copiar: la contraseña queda a la vista para escribirla a mano
    }
  }

  return (
    <Dialogo
      open={Boolean(datos)}
      onClose={onClose}
      title={datos?.nueva ? `${datos.nombre} ya tiene su cuenta` : 'Contraseña provisoria nueva'}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      {datos && (
        <>
          <p className="text-sm text-slate-600">
            Pasale estos datos a {datos.nombre} por un medio privado: en persona, por teléfono o por
            mensaje.
          </p>
          <dl className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div>
              <dt className="text-xs font-medium text-slate-500">Correo</dt>
              <dd className="mt-0.5 text-sm text-slate-900">{datos.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Contraseña provisoria</dt>
              <dd className="mt-1 flex items-center justify-between gap-3">
                <span className="font-mono text-lg tracking-wider text-slate-900 select-all">
                  {datos.contrasena}
                </span>
                <Button variant="secondary" size="sm" onClick={copiar}>
                  {copiada ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiada
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </Button>
              </dd>
            </div>
          </dl>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Al entrar la va a cambiar por una suya. Por seguridad, esta contraseña no se vuelve a
            mostrar.
          </p>
        </>
      )}
    </Dialogo>
  )
}
