import type { AjusteTransicionRT54, ComponentePN, TipoAjusteTransicion } from '@prisma/client'
import { importe, sumarPor } from '@/lib/importe'

export type { ComponentePN, TipoAjusteTransicion }

export type AjusteTransicionDTO = {
  id: string
  ejercicioId: string
  orden: number
  tipo: TipoAjusteTransicion
  concepto: string
  descripcion: string | null
  componentePN: ComponentePN | null
  importePN: number
  importeResultadoAnterior: number
  rubroOrigen: string | null
  rubroDestino: string | null
  importeReclasificado: number
}

export type AjusteTransicionInput = Omit<AjusteTransicionDTO, 'id' | 'ejercicioId'>

export function toAjusteTransicionDTO(a: AjusteTransicionRT54): AjusteTransicionDTO {
  return {
    id: a.id,
    ejercicioId: a.ejercicioId,
    orden: a.orden,
    tipo: a.tipo,
    concepto: a.concepto,
    descripcion: a.descripcion,
    componentePN: a.componentePN,
    importePN: importe(a.importePN),
    importeResultadoAnterior: importe(a.importeResultadoAnterior),
    rubroOrigen: a.rubroOrigen,
    rubroDestino: a.rubroDestino,
    importeReclasificado: importe(a.importeReclasificado),
  }
}

export const TIPO_AJUSTE_LABELS: Record<TipoAjusteTransicion, string> = {
  AJUSTE_MEDICION: 'Ajuste de medición',
  RECLASIFICACION: 'Reclasificación de exposición',
}

export const COMPONENTE_PN_LABELS: Record<ComponentePN, string> = {
  CAPITAL_SUSCRIPTO: 'Capital suscripto',
  AJUSTE_CAPITAL: 'Ajuste del capital',
  APORTES_IRREVOCABLES: 'Aportes irrevocables',
  RESERVA_LEGAL: 'Reserva legal',
  OTRAS_RESERVAS: 'Otras reservas',
  RDOS_NO_ASIGNADOS: 'Resultados no asignados',
}

/**
 * Plantillas de partidas habituales de primera aplicación. Son sugerencias
 * editables: el contador decide cuáles corresponden y con qué importes.
 */
export const PLANTILLAS_AJUSTE_TRANSICION: ReadonlyArray<Omit<AjusteTransicionInput, 'orden'>> = [
  {
    tipo: 'RECLASIFICACION',
    concepto: 'Apertura de créditos en moneda y en especie',
    descripcion:
      'Los créditos que al cierre anterior se exponían en un único rubro se desagregan según sean en moneda o en especie.',
    componentePN: null,
    importePN: 0,
    importeResultadoAnterior: 0,
    rubroOrigen: 'Créditos',
    rubroDestino: 'Créditos en especie',
    importeReclasificado: 0,
  },
  {
    tipo: 'RECLASIFICACION',
    concepto: 'Eliminación de resultados extraordinarios',
    descripcion:
      'Las partidas expuestas como resultados extraordinarios en el ejercicio anterior se reclasifican dentro de los resultados ordinarios.',
    componentePN: null,
    importePN: 0,
    importeResultadoAnterior: 0,
    rubroOrigen: 'Resultados extraordinarios',
    rubroDestino: 'Otros ingresos y egresos',
    importeReclasificado: 0,
  },
  {
    tipo: 'AJUSTE_MEDICION',
    concepto: 'Ajuste de medición por cambio de criterio',
    descripcion: 'Efecto sobre el patrimonio neto al inicio por el nuevo criterio de medición.',
    componentePN: 'RDOS_NO_ASIGNADOS',
    importePN: 0,
    importeResultadoAnterior: 0,
    rubroOrigen: null,
    rubroDestino: null,
    importeReclasificado: 0,
  },
]

export function sumaAjustesMedicionPN(ajustes: AjusteTransicionDTO[]): number {
  return sumarPor(
    ajustes.filter((a) => a.tipo === 'AJUSTE_MEDICION'),
    (a) => a.importePN,
  )
}
