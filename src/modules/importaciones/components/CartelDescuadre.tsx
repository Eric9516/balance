'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'
import { describirDiferencia } from '../domain/importacion'
import type { CambioPorConfirmar } from '../hooks/useFilaCuentaEdicion'

/** "El haber supera al debe por 127.329.842,74": la diferencia completa, sin redondear. */
function frase(diferencia: number): string {
  const s = describirDiferencia(diferencia)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * El cartel que pregunta antes de guardar un cambio de cuentas que descuadra el balance de sumas y
 * saldos (o agranda el descuadre). Lo seguro, volver sin guardar, es el botón principal.
 */
export function CartelDescuadre({
  cambio,
  guardando,
  onVolver,
  onConfirmar,
}: {
  cambio: CambioPorConfirmar | null
  guardando: boolean
  onVolver: () => void
  onConfirmar: () => void
}) {
  const borrar = cambio?.tipo === 'BORRAR'
  return (
    <Dialogo
      open={cambio !== null}
      onClose={onVolver}
      title={
        borrar ? 'Borrar esta cuenta descuadra el balance' : 'Este cambio descuadra el balance'
      }
      bloqueado={guardando}
      footer={
        <>
          <Button variant="destructive" onClick={onConfirmar} disabled={guardando}>
            {guardando ? 'Guardando…' : borrar ? 'Borrar igual' : 'Guardar igual'}
          </Button>
          <Button autoFocus onClick={onVolver} disabled={guardando}>
            {borrar ? 'Volver sin borrar' : 'Volver sin guardar'}
          </Button>
        </>
      }
    >
      {cambio && (
        <>
          <p className="text-sm text-slate-600">
            Cuenta <span className="font-mono text-slate-800">{cambio.cuenta.codigo}</span>{' '}
            <span className="font-medium text-slate-800">{cambio.cuenta.nombre}</span>
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 px-3.5 py-3 text-sm">
            <dt className="text-slate-500">Hoy</dt>
            <dd className="text-slate-800">{frase(cambio.efecto.antes)}</dd>
            <dt className="text-slate-500">{borrar ? 'Si la borrás' : 'Si guardás'}</dt>
            <dd className="font-semibold text-red-700">{frase(cambio.efecto.despues)}</dd>
          </dl>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">
              Los estados contables salen de estas cuentas: con el balance descuadrado, tampoco van
              a cuadrar. Si fue sin querer, volvé sin {borrar ? 'borrar' : 'guardar'}.
            </p>
          </div>
        </>
      )}
    </Dialogo>
  )
}
