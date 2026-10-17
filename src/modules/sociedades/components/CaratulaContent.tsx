import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SociedadDTO } from '../domain/types'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const MESES_MIN = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function fechaLarga(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function fechaLargaMinus(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} de ${MESES_MIN[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  sociedad: SociedadDTO
  ejercicio: EjercicioContableDTO
}

export function CaratulaContent({ sociedad, ejercicio }: Props) {
  const domicilioParts: string[] = []
  if (sociedad.domicilioLegal) domicilioParts.push(sociedad.domicilioLegal)
  if (sociedad.localidad) {
    const loc = sociedad.codigoPostal
      ? `${sociedad.localidad} (CP ${sociedad.codigoPostal})`
      : sociedad.localidad
    domicilioParts.push(loc)
  }
  const domicilio = domicilioParts.join(' - ')
  const provinciaLinea = [sociedad.provincia, 'Republica Argentina'].filter(Boolean).join(' - ')
  const numEj = ejercicio.numeroEjercicio != null ? `N°${ejercicio.numeroEjercicio}` : ''
  const parrafo = `Por el ejercicio económico ${numEj} iniciado el ${fechaLarga(ejercicio.fechaInicio)}, expresado en moneda homogénea (pesos) del ${fechaLarga(ejercicio.fechaCierre)}, fecha de cierre del mismo.-`
  const actPrincipales = sociedad.actividadPpal?.split('\n').filter(Boolean) ?? []
  const actSecundarias = sociedad.actividadSecundaria?.split('\n').filter(Boolean) ?? []

  const camposFaltantes: string[] = []
  if (!sociedad.domicilioLegal) camposFaltantes.push('domicilio legal')
  if (actPrincipales.length === 0) camposFaltantes.push('actividad principal')
  if (ejercicio.numeroEjercicio == null) camposFaltantes.push('número de ejercicio')
  if (!sociedad.fechaInscripcion) camposFaltantes.push('fecha de inscripción')
  if (!sociedad.matriculaPJ) camposFaltantes.push('matrícula PJ')
  if (!sociedad.plazoDuracion) camposFaltantes.push('plazo de duración')
  if (sociedad.tipoSocietario === 'S.A.S.' && !sociedad.composicionCapital)
    camposFaltantes.push('composición del capital')

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
      {camposFaltantes.length > 0 && (
        <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Datos sin completar: {camposFaltantes.join(', ')}.{' '}
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
            {sociedad.razonSocial}
          </p>
          {domicilio && <p className="mt-2 text-sm text-slate-700">{domicilio}</p>}
          {provinciaLinea && <p className="mt-0.5 text-sm text-slate-700">{provinciaLinea}</p>}

          {actPrincipales.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-slate-500 italic">Actividad Principal:</p>
              {actPrincipales.map((act, i) => (
                <p
                  key={i}
                  className="mt-0.5 text-sm leading-snug font-bold text-slate-900 uppercase"
                >
                  {act}
                </p>
              ))}
              {actSecundarias.length > 0 && (
                <div className="mt-3">
                  {actSecundarias.map((act, i) => (
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
              ESTADOS CONTABLES
            </p>
          </div>

          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-slate-700">{parrafo}</p>

          <div className="mt-10 border-t border-slate-200" />

          <div className="mt-8">
            <p className="text-sm text-slate-600">
              Fecha de Inscripción en el Registro Público de Comercio:
            </p>
            <p className="text-sm text-slate-600">
              Del Estatuto Social:{' '}
              <span className="font-bold text-slate-900">
                {sociedad.fechaInscripcion ? fechaLargaMinus(sociedad.fechaInscripcion) : '—'}
              </span>
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-600">
              Inscripción en la Dirección de Personas Jurídicas de Córdoba según
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              Matrícula N° {sociedad.matriculaPJ ?? '—'}
            </p>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-600">
              Fecha en que se cumple el plazo de duración de la Sociedad
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {sociedad.plazoDuracion ? fechaLargaMinus(sociedad.plazoDuracion) : '—'}
            </p>
          </div>

          {sociedad.tipoSocietario === 'S.A.S.' && (
            <div className="mt-8 pb-2">
              <p className="text-sm text-slate-600">Composición del Capital</p>
              <p className="text-xs text-slate-500">(en pesos)</p>
              {sociedad.composicionCapital ? (
                sociedad.composicionCapital.split('\n').map((linea, i) => (
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
