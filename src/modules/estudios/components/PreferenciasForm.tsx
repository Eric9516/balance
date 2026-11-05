'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Columns3, Rows3, Rows4, TableProperties } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { guardarPreferenciasAction } from '../actions/preferencias.actions'
import {
  DENSIDAD_LABELS,
  type DensidadTablas,
  type FormatoAnexoBienesUso,
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

const FORMATOS_BDU: {
  valor: FormatoAnexoBienesUso
  icono: typeof Rows3
  titulo: string
  texto: string
}[] = [
  {
    valor: 'UN_CUADRO',
    icono: Columns3,
    titulo: 'Un solo cuadro',
    texto:
      'El formato tradicional: valor de origen, amortizaciones y netos en la misma fila. Hoja apaisada.',
  },
  {
    valor: 'DOS_CUADROS',
    icono: TableProperties,
    titulo: 'Dos cuadros',
    texto:
      'Valor de origen arriba y amortizaciones con los netos abajo. Más fácil de leer con importes largos.',
  },
]

/** Densidad de las tablas y formato del documento del estudio (en la base). El color es fijo. */
export function PreferenciasForm({ inicial }: { inicial: PreferenciasEstudio }) {
  const router = useRouter()
  const { isPending, ejecutar } = useGuardarAccion()
  const [densidad, setDensidad] = useState<DensidadTablas>(inicial.densidadTablas)
  const [anexoBdu, setAnexoBdu] = useState<FormatoAnexoBienesUso>(inicial.anexoBienesUso)
  const cambiado = densidad !== inicial.densidadTablas || anexoBdu !== inicial.anexoBienesUso

  function guardar() {
    ejecutar(
      () => guardarPreferenciasAction({ densidadTablas: densidad, anexoBienesUso: anexoBdu }),
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
          La densidad define cómo se ven las tablas de trabajo, y el formato del anexo, cómo sale en
          el documento.
        </p>
      </CardHeader>
      <CardContent className="space-y-7">
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

        {/* Anexo de Bienes de Uso en el documento */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Anexo de Bienes de Uso en el documento
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FORMATOS_BDU.map((f) => {
              const activo = f.valor === anexoBdu
              const Icono = f.icono
              return (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setAnexoBdu(f.valor)}
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
                    <span className="block text-sm font-semibold text-slate-800">{f.titulo}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{f.texto}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-500">
            Los importes son los mismos en las dos vistas: solo cambia cómo se dibuja la tabla.
          </p>
        </section>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={guardar} disabled={isPending || !cambiado}>
          {isPending ? 'Guardando...' : 'Guardar apariencia'}
        </Button>
      </CardFooter>
    </Card>
  )
}
