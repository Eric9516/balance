'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Palette, Rows3, Rows4 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { guardarPreferenciasAction } from '../actions/preferencias.actions'
import {
  ACENTOS_SUGERIDOS,
  DENSIDAD_LABELS,
  validarAcento,
  type DensidadTablas,
  type PreferenciasEstudio,
} from '../domain/preferencias'

const DENSIDADES: { valor: DensidadTablas; icono: typeof Rows3; texto: string }[] = [
  {
    valor: 'COMODA',
    icono: Rows3,
    texto: 'Letra de 14 px y filas más altas. Ideal para trabajo diario.',
  },
  { valor: 'COMPACTA', icono: Rows4, texto: 'Letra de 13 px y más filas visibles en pantalla.' },
]

/** Identidad visual y densidad de tablas del estudio (se guardan en la base). */
export function PreferenciasForm({ inicial }: { inicial: PreferenciasEstudio }) {
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()
  const [color, setColor] = useState(inicial.colorPrimario.toUpperCase())
  const [densidad, setDensidad] = useState<DensidadTablas>(inicial.densidadTablas)
  const error = validarAcento(color)
  const cambiado =
    color !== inicial.colorPrimario.toUpperCase() || densidad !== inicial.densidadTablas

  function guardar() {
    ejecutar(
      () => guardarPreferenciasAction({ colorPrimario: color, densidadTablas: densidad }),
      () => {
        toastSuccess('Preferencias guardadas')
        router.refresh()
      },
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          El color de acento identifica al estudio en toda la aplicación. La densidad define cómo se
          ven las tablas de trabajo.
        </p>
      </CardHeader>
      <CardContent className="space-y-7">
        {/* Acento */}
        <section className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            <Palette className="h-3.5 w-3.5" /> Color de acento
          </p>
          <div className="flex flex-wrap gap-2.5">
            {ACENTOS_SUGERIDOS.map((a) => {
              const activo = a.hex.toUpperCase() === color
              return (
                <button
                  key={a.hex}
                  type="button"
                  onClick={() => setColor(a.hex.toUpperCase())}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    activo
                      ? 'border-slate-900 bg-white text-slate-900'
                      : 'border-linea bg-white text-slate-600 hover:border-slate-300',
                  )}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: a.hex }}
                  >
                    {activo && <Check className="h-3 w-3 text-white" />}
                  </span>
                  {a.nombre}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer rounded border border-linea bg-white"
              aria-label="Elegir otro color"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value.trim().toUpperCase())}
              maxLength={7}
              className="w-28 rounded-lg border border-linea bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
            />
            {/* Vista previa con el color elegido, sin depender del CSS global */}
            <span
              className="rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: error ? '#9a9488' : color }}
            >
              Botón de ejemplo
            </span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </section>

        {/* Densidad */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Densidad de las tablas
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DENSIDADES.map((d) => {
              const activo = d.valor === densidad
              const Icono = d.icono
              return (
                <button
                  key={d.valor}
                  type="button"
                  onClick={() => setDensidad(d.valor)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                    activo
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-linea bg-white hover:border-slate-300',
                  )}
                >
                  <Icono
                    className={cn('mt-0.5 h-5 w-5', activo ? 'text-blue-700' : 'text-slate-400')}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {DENSIDAD_LABELS[d.valor]}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{d.texto}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={guardar} disabled={isPending || !cambiado || error !== null}>
          {isPending ? 'Guardando...' : 'Guardar apariencia'}
        </Button>
      </CardFooter>
    </Card>
  )
}
