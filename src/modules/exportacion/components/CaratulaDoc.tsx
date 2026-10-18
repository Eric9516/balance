import type { CaratulaModelo } from '@/modules/sociedades/domain/caratula'
import { TEXTOS_CARATULA } from '@/modules/sociedades/domain/caratula'

/** Carátula: mismos textos que la pantalla (domain/caratula.ts), sin controles. */
export function CaratulaDoc({ caratula: c }: { caratula: CaratulaModelo }) {
  return (
    <div className="flex min-h-[240mm] flex-col justify-between py-10 text-center">
      <div>
        <p className="font-serif text-[18pt] font-bold tracking-tight text-tinta uppercase">
          {c.razonSocial}
        </p>
        {c.domicilio && <p className="mt-2 text-[10pt]">{c.domicilio}</p>}
        {c.provinciaLinea && <p className="text-[10pt]">{c.provinciaLinea}</p>}

        {c.actividadesPrincipales.length > 0 && (
          <div className="mt-8">
            <p className="text-[9pt] text-tinta-suave italic">
              {TEXTOS_CARATULA.actividadPrincipal}
            </p>
            {c.actividadesPrincipales.map((act, i) => (
              <p key={i} className="text-[10pt] font-bold uppercase">
                {act}
              </p>
            ))}
            {c.actividadesSecundarias.length > 0 && (
              <div className="mt-3">
                {c.actividadesSecundarias.map((act, i) => (
                  <p key={i} className="text-[10pt] font-bold uppercase">
                    {act}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="font-serif text-[24pt] font-bold tracking-widest text-tinta uppercase">
          {TEXTOS_CARATULA.titulo}
        </p>
        <p className="mx-auto mt-5 max-w-[120mm] text-[10pt] leading-relaxed">{c.parrafo}</p>
      </div>

      <div className="space-y-6 border-t border-linea pt-8 text-[9.5pt]">
        <div>
          <p className="text-tinta-suave">{TEXTOS_CARATULA.inscripcionTitulo}</p>
          <p className="text-tinta-suave">
            {TEXTOS_CARATULA.inscripcionEstatuto}{' '}
            <span className="font-bold text-tinta">{c.inscripcion ?? '—'}</span>
          </p>
        </div>
        <div>
          <p className="text-tinta-suave">{TEXTOS_CARATULA.matriculaTitulo}</p>
          <p className="font-bold">{TEXTOS_CARATULA.matricula(c.matriculaPJ)}</p>
        </div>
        <div>
          <p className="text-tinta-suave">{TEXTOS_CARATULA.plazoTitulo}</p>
          <p className="font-bold">{c.plazoDuracion ?? '—'}</p>
        </div>
        {c.composicionCapital && (
          <div>
            <p className="text-tinta-suave">{TEXTOS_CARATULA.composicionTitulo}</p>
            <p className="text-[8.5pt] text-tinta-suave">{TEXTOS_CARATULA.composicionSubtitulo}</p>
            {c.composicionCapital.length > 0 ? (
              c.composicionCapital.map((linea, i) => (
                <p key={i} className="font-bold">
                  {linea}
                </p>
              ))
            ) : (
              <p>—</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
