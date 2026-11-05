import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SociedadDTO } from '../domain/types'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { TEXTOS_CARATULA, armarCaratula } from '../domain/caratula'

// ─── Componente ───────────────────────────────────────────────────────────────
// Los textos salen de domain/caratula.ts (fuente única con el documento imprimible).

interface Props {
  sociedad: SociedadDTO
  ejercicio: EjercicioContableDTO
}

export function CaratulaContent({ sociedad, ejercicio }: Props) {
  const c = armarCaratula(sociedad, ejercicio)

  return (
    <div className="space-y-4">
      {/* Acciones rápidas */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/sociedades/${sociedad.id}/editar`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar cliente
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/sociedades/${sociedad.id}/ejercicios/${ejercicio.id}/editar`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar ejercicio
          </Link>
        </Button>
      </div>

      {/* Alerta datos faltantes */}
      {c.camposFaltantes.length > 0 && (
        <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Datos sin completar: {c.camposFaltantes.join(', ')}.{' '}
            <span className="font-normal text-amber-700">
              Editá el cliente o el ejercicio para completar la carátula.
            </span>
          </p>
        </div>
      )}

      {/* Documento */}
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-16 py-12 text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
            {c.razonSocial}
          </p>
          {c.domicilio && <p className="mt-2 text-sm text-slate-700">{c.domicilio}</p>}
          {c.provinciaLinea && <p className="mt-0.5 text-sm text-slate-700">{c.provinciaLinea}</p>}
          <p className="mt-4 text-base font-bold text-slate-900">{c.cuit}</p>

          {c.actividadesPrincipales.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 italic">{TEXTOS_CARATULA.actividadPrincipal}</p>
              {c.actividadesPrincipales.map((act, i) => (
                <p
                  key={i}
                  className="mt-0.5 text-sm leading-snug font-bold text-slate-900 uppercase"
                >
                  {act}
                </p>
              ))}
              {c.actividadesSecundarias.length > 0 && (
                <div className="mt-3">
                  {c.actividadesSecundarias.map((act, i) => (
                    <p
                      key={i}
                      className="mt-0.5 text-sm leading-snug font-bold text-slate-900 uppercase"
                    >
                      {act}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-10 mb-2">
            <p className="text-3xl font-bold tracking-widest text-slate-900 uppercase">
              {TEXTOS_CARATULA.titulo}
            </p>
          </div>

          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-700">
            {c.parrafo}
          </p>

          <div className="mt-10 border-t border-slate-200" />

          <div className="mt-8">
            <p className="text-sm text-slate-600">{TEXTOS_CARATULA.inscripcionTitulo}</p>
            <p className="text-sm text-slate-600">
              {TEXTOS_CARATULA.inscripcionEstatuto}{' '}
              <span className="font-bold text-slate-900">{c.inscripcion ?? '—'}</span>
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-600">{TEXTOS_CARATULA.matriculaTitulo}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {TEXTOS_CARATULA.matricula(c.matriculaPJ)}
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-600">{TEXTOS_CARATULA.plazoTitulo}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">{c.plazoDuracion ?? '—'}</p>
          </div>

          {c.composicionCapital && (
            <div className="mt-8 pb-2">
              <p className="text-sm text-slate-600">{TEXTOS_CARATULA.composicionTitulo}</p>
              <p className="text-xs text-slate-500">{TEXTOS_CARATULA.composicionSubtitulo}</p>
              {c.composicionCapital.length > 0 ? (
                c.composicionCapital.map((linea, i) => (
                  <p
                    key={i}
                    className="mx-auto mt-1 max-w-sm text-sm leading-snug font-bold text-slate-900"
                  >
                    {linea}
                  </p>
                ))
              ) : (
                <p className="mt-1 text-sm text-slate-400">—</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
