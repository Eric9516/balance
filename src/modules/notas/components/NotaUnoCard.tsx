'use client'

/**
 * Nota 1 en el paso Notas: la arma la app con los datos del ejercicio y el contador puede
 * reemplazarla por su texto (Editar → Guardar o Cancelar). "Volver al texto generado" descarta el
 * texto propio y la nota vuelve a mantenerse al día sola. Las conciliaciones de la transición no se
 * escriben: salen de los ajustes cargados.
 */
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { BotonEditar } from '@/components/shared/BotonEditar'
import { useEdicionLote } from '@/components/shared/useEdicionLote'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { formatCurrency } from '@/lib/utils/currency'
import type {
  FilaConciliacion,
  NotaTransicionGenerada,
} from '@/modules/transicion-rt54/lib/generarNota'
import { guardarNotaUnoAction } from '../actions/notas.actions'
import { bloquesTextoNota } from '../domain/textoNota'

export type NotaUnoVista = {
  titulo: string
  /** Texto escrito por el contador; null = se muestra el generado. */
  textoPropio: string | null
  textoGenerado: string
  editadaEn: string | null
  transicion: { apartado: string; nota: NotaTransicionGenerada } | null
  advertencias: string[]
}

export function TextoNota({ texto }: { texto: string }) {
  return (
    <div className="space-y-2.5">
      {bloquesTextoNota(texto).map((b, i) =>
        b.titulo ? (
          <p key={i} className="pt-1 text-sm font-semibold text-slate-900">
            {b.texto}
          </p>
        ) : (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {b.texto}
          </p>
        ),
      )}
    </div>
  )
}

function Conciliacion({ titulo, filas }: { titulo: string; filas: FilaConciliacion[] }) {
  if (filas.length === 0) return null
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
          <th className="py-1.5 font-semibold">{titulo}</th>
          <th className="py-1.5 text-right font-semibold">$</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className={f.esTotal ? 'border-t border-slate-300 font-semibold' : undefined}>
            <td className={`py-1 ${f.esBase || f.esTotal ? '' : 'pl-4'}`}>{f.concepto}</td>
            <td className="py-1 text-right tabular-nums">{formatCurrency(f.importe)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function NotaUnoCard({
  nota,
  ejercicioId,
  sociedadId,
  editable,
}: {
  nota: NotaUnoVista
  ejercicioId: string
  sociedadId: string
  /** false con el ejercicio cerrado. */
  editable: boolean
}) {
  const guardar = async (borrador: string | null) => {
    // Si quedó igual al generado, se guarda como generado: así sigue al día con los datos.
    const propio =
      borrador?.trim() && borrador.trim() !== nota.textoGenerado.trim() ? borrador : null
    const r = await guardarNotaUnoAction(ejercicioId, sociedadId, propio)
    return r.ok ? { ok: true as const, data: r.data.texto } : r
  }
  const edicion = useEdicionLote<string | null>(nota.textoPropio, guardar, 'Nota 1 guardada')
  const volver = useGuardarAccion()
  const propio = edicion.valor
  const texto = propio ?? nota.textoGenerado

  function editar() {
    edicion.iniciarEdicion()
    edicion.actualizar((prev) => prev ?? nota.textoGenerado)
  }
  function volverAlGenerado() {
    volver.ejecutar(
      () => guardarNotaUnoAction(ejercicioId, sociedadId, null),
      () => edicion.sincronizar(() => null),
    )
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-labelledby="titulo-nota-uno"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div>
          <h2 id="titulo-nota-uno" className="text-sm font-bold text-slate-900">
            Nota N° 1: <span className="uppercase">{nota.titulo}</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {propio !== null
              ? `Texto escrito por el contador${nota.editadaEn ? ` (${nota.editadaEn})` : ''}: no cambia si cambian los datos del ejercicio.`
              : 'Armada con los datos del ejercicio: se actualiza sola si cambian.'}
          </p>
        </div>
        {editable && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {propio !== null && !edicion.editando && (
              <button
                type="button"
                onClick={volverAlGenerado}
                disabled={volver.isPending}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Volver al texto generado
              </button>
            )}
            <BotonEditar
              editando={edicion.editando}
              onEditar={editar}
              onGuardar={edicion.confirmar}
              onCancelar={edicion.cancelar}
              isPending={edicion.isPending}
            />
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {nota.advertencias.length > 0 && propio === null && (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-700">
            {nota.advertencias.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                {a}
              </li>
            ))}
          </ul>
        )}
        {edicion.editando ? (
          <div className="space-y-1.5">
            <label htmlFor="texto-nota-uno" className="text-xs text-slate-500">
              Separá los párrafos con una línea en blanco. Los títulos de los apartados empiezan con
              su número (1.1., 1.2.…).
            </label>
            <textarea
              id="texto-nota-uno"
              value={propio ?? ''}
              onChange={(e) => edicion.actualizar(e.target.value)}
              rows={22}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-400 focus:outline-none"
            />
          </div>
        ) : (
          <TextoNota texto={texto} />
        )}
        {nota.transicion && (
          <div className="space-y-3 rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Apartado {nota.transicion.apartado}: las conciliaciones salen de los ajustes de
              transición cargados más abajo; no se escriben.
            </p>
            <Conciliacion
              titulo="Conciliación del patrimonio neto al inicio"
              filas={nota.transicion.nota.conciliacionPN}
            />
            <Conciliacion
              titulo="Conciliación del resultado del ejercicio anterior"
              filas={nota.transicion.nota.conciliacionResultado}
            />
            {nota.transicion.nota.reclasificaciones.length > 0 && (
              <Conciliacion
                titulo="Reclasificaciones de exposición"
                filas={nota.transicion.nota.reclasificaciones.map((r) => ({
                  concepto:
                    r.origen && r.destino
                      ? `${r.concepto} (${r.origen} → ${r.destino})`
                      : r.concepto,
                  importe: r.importe,
                }))}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
