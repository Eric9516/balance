/**
 * Carátula de los estados contables: arma los textos a partir de la sociedad y el
 * ejercicio. Fuente única para la pantalla (CaratulaContent) y el documento. Puro.
 */

import { formatCuit } from '@/lib/utils/cuit'
import { formatFechaLarga } from '@/lib/utils/dates'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import type { SociedadDTO } from './types'

export const TEXTOS_CARATULA = {
  titulo: 'ESTADOS CONTABLES',
  inscripcionTitulo: 'Fecha de Inscripción en el Registro Público de Comercio:',
  inscripcionEstatuto: 'Del Estatuto Social:',
  matriculaTitulo: 'Inscripción en la Dirección de Personas Jurídicas de Córdoba según',
  matricula: (n: string | null) => `Matrícula N° ${n ?? '—'}`,
  plazoTitulo: 'Fecha en que se cumple el plazo de duración de la Sociedad',
  composicionTitulo: 'Composición del Capital',
  composicionSubtitulo: '(en pesos)',
  actividadPrincipal: 'Actividad Principal:',
  pais: 'Republica Argentina',
} as const

export type CaratulaModelo = {
  razonSocial: string
  /** "Domicilio - Localidad (CP ...)"; vacío si no hay datos. */
  domicilio: string
  /** "Provincia - Republica Argentina". */
  provinciaLinea: string
  /** CUIT de la sociedad con guiones (30-71823319-2): va debajo del domicilio. */
  cuit: string
  actividadesPrincipales: string[]
  actividadesSecundarias: string[]
  /** "Por el ejercicio económico N° X iniciado el ..., expresado en moneda homogénea ..." */
  parrafo: string
  /** Fecha larga de inscripción o null. */
  inscripcion: string | null
  matriculaPJ: string | null
  /** Fecha larga en que se cumple el plazo de duración o null. */
  plazoDuracion: string | null
  /** Solo S.A.S.: líneas de la composición del capital (null si no corresponde mostrarla). */
  composicionCapital: string[] | null
  /** Datos que faltan para que la carátula esté completa. */
  camposFaltantes: string[]
}

export function armarCaratula(
  sociedad: SociedadDTO,
  ejercicio: EjercicioContableDTO,
): CaratulaModelo {
  const domicilioParts: string[] = []
  if (sociedad.domicilioLegal) domicilioParts.push(sociedad.domicilioLegal)
  if (sociedad.localidad) {
    domicilioParts.push(
      sociedad.codigoPostal
        ? `${sociedad.localidad} (CP ${sociedad.codigoPostal})`
        : sociedad.localidad,
    )
  }
  const numEj = ejercicio.numeroEjercicio != null ? `N°${ejercicio.numeroEjercicio}` : ''
  const parrafo = `Por el ejercicio económico ${numEj} iniciado el ${formatFechaLarga(ejercicio.fechaInicio, { mesMayuscula: true })}, expresado en moneda homogénea (pesos) del ${formatFechaLarga(ejercicio.fechaCierre, { mesMayuscula: true })}, fecha de cierre del mismo.-`
  const actividadesPrincipales = sociedad.actividadPpal?.split('\n').filter(Boolean) ?? []
  const actividadesSecundarias = sociedad.actividadSecundaria?.split('\n').filter(Boolean) ?? []
  const esSAS = sociedad.tipoSocietario === 'S.A.S.'

  const camposFaltantes: string[] = []
  if (!sociedad.domicilioLegal) camposFaltantes.push('domicilio legal')
  if (actividadesPrincipales.length === 0) camposFaltantes.push('actividad principal')
  if (ejercicio.numeroEjercicio == null) camposFaltantes.push('número de ejercicio')
  if (!sociedad.fechaInscripcion) camposFaltantes.push('fecha de inscripción')
  if (!sociedad.matriculaPJ) camposFaltantes.push('matrícula PJ')
  if (!sociedad.plazoDuracion) camposFaltantes.push('plazo de duración')
  if (esSAS && !sociedad.composicionCapital) camposFaltantes.push('composición del capital')

  return {
    razonSocial: sociedad.razonSocial,
    domicilio: domicilioParts.join(' - '),
    provinciaLinea: [sociedad.provincia, TEXTOS_CARATULA.pais].filter(Boolean).join(' - '),
    cuit: formatCuit(sociedad.cuit),
    actividadesPrincipales,
    actividadesSecundarias,
    parrafo,
    inscripcion: sociedad.fechaInscripcion ? formatFechaLarga(sociedad.fechaInscripcion) : null,
    matriculaPJ: sociedad.matriculaPJ,
    plazoDuracion: sociedad.plazoDuracion ? formatFechaLarga(sociedad.plazoDuracion) : null,
    composicionCapital: esSAS
      ? (sociedad.composicionCapital?.split('\n').filter(Boolean) ?? [])
      : null,
    camposFaltantes,
  }
}
