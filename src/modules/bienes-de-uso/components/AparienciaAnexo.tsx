'use client'

import '@/modules/exportacion/components/tablas-documento.css'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'
import type { FormatoAnexoBienesUso } from '@prisma/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/shared/Dialogo'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { ANEXOS_CON_VISTA } from '@/modules/documentos/domain/anexos'
import { AnexoBienesUsoDoc } from '@/modules/exportacion/components/AnexosDoc'
import { TEXTOS_DOCUMENTO as T } from '@/modules/exportacion/domain/textos'
import type { ColumnasDocumento } from '@/modules/exportacion/domain/types'
import type { BienDeUsoDTO } from '../domain/types'
import { cambiarFormatoAnexoAction } from '../actions/bienes-de-uso.actions'

const FORMATOS: { valor: FormatoAnexoBienesUso; titulo: string; texto: string }[] = [
  {
    valor: 'UN_CUADRO',
    titulo: 'Un solo cuadro',
    texto: 'El formato tradicional: valor de origen, amortizaciones y netos en la misma fila.',
  },
  {
    valor: 'DOS_CUADROS',
    titulo: 'Dos cuadros',
    texto:
      'Valor de origen arriba; amortizaciones y netos abajo. Más fácil de leer con importes largos.',
  },
]

const TITULO = ANEXOS_CON_VISTA.find((a) => a.clave === 'ANEXO_BIENES_USO')?.titulo ?? ''

/**
 * "Apariencia" del Anexo I: cómo sale en el documento impreso de este balance. La vista previa es
 * la misma pieza que arma el documento, con los datos guardados: lo que se ve es lo que se imprime.
 * Los números son los mismos en las dos vistas.
 */
export function AparienciaAnexo({
  formato,
  bienes,
  netoAnteriorMap,
  columnas,
  noSePuedeCambiar,
  ejercicioId,
  sociedadId,
}: {
  formato: FormatoAnexoBienesUso
  bienes: BienDeUsoDTO[]
  netoAnteriorMap: Map<string, number>
  columnas: ColumnasDocumento
  /** Por qué no se puede cambiar (balance cerrado, rol); null si se puede. */
  noSePuedeCambiar: string | null
  ejercicioId: string
  sociedadId: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [elegido, setElegido] = useState<FormatoAnexoBienesUso>(formato)
  const { isPending, ejecutar } = useGuardarAccion()

  function abrir() {
    setElegido(formato)
    setAbierto(true)
  }

  function usar() {
    ejecutar(
      () => cambiarFormatoAnexoAction(ejercicioId, sociedadId, elegido),
      () => {
        setAbierto(false)
        toastSuccess('Listo: el anexo va a salir así en el documento de este balance.')
        router.refresh()
      },
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        title="Cómo sale este anexo en el documento impreso"
      >
        <Eye className="h-3.5 w-3.5" />
        Apariencia
      </button>

      <Dialogo
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Cómo sale el anexo en el documento"
        bloqueado={isPending}
        className="max-w-6xl"
        footer={
          noSePuedeCambiar ? (
            <Button variant="secondary" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setAbierto(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={usar} disabled={isPending || elegido === formato}>
                {isPending ? 'Guardando…' : 'Usar este formato'}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Formato">
            {FORMATOS.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={elegido === f.valor}
                onClick={() => setElegido(f.valor)}
                className={cn(
                  'rounded-lg border px-3.5 py-2.5 text-left transition-colors',
                  elegido === f.valor
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <span className="block text-sm font-medium text-slate-900">
                  {f.titulo}
                  {f.valor === formato && (
                    <span className="ml-2 text-xs font-normal text-slate-500">(el de ahora)</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{f.texto}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Es la hoja tal como se imprime, con los datos guardados de este balance. Los importes
            son los mismos en los dos formatos: solo cambia cómo se dibuja la tabla.
            {noSePuedeCambiar && (
              <span className="mt-1 block text-amber-700">{noSePuedeCambiar}</span>
            )}
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-white p-6">
            <div className="min-w-[900px] text-tinta">
              <AnexoBienesUsoDoc
                titulo={TITULO}
                subtitulo={T.subtitulos.al(columnas.fechaCierre, columnas.fechaCierreAnterior)}
                anexo={{
                  bienes,
                  netoAnteriorMap,
                  bloqueadas: new Set(),
                  sinDato: [],
                  advertencias: [],
                }}
                columnas={columnas}
                formato={elegido}
              />
            </div>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
