/**
 * Servicio: arma el juego completo de estados contables de un ejercicio para
 * imprimir. Junta lo que ya calculan los servicios de cada módulo (estados,
 * E.E.P.N., flujo, anexos, notas, compuerta) y se lo pasa al dominio puro.
 * Nada se recalcula acá: el documento muestra lo mismo que las pantallas.
 */

import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  diaAnteriorUTC,
  idAnteriorDerivable,
  modoEfectivo,
} from '@/modules/ejercicios/domain/ejercicioAnterior'
import { evaluarAutorizacionSinPersistir } from '@/modules/ejercicios/services/autorizacion.service'
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findAuditorById } from '@/modules/auditores/repository/auditor.repository'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import { cargarNotas } from '@/modules/notas/services/notas.service'
import { findAjustesByEjercicio } from '@/modules/transicion-rt54/repository/ajustes.repository'
import { previsualizarNotaTransicion } from '@/modules/transicion-rt54/services/nota-transicion.service'
import { inclusionNotaTransicion } from '@/modules/transicion-rt54/domain/inclusion'
import { mostrarColumnaAnterior } from '@/modules/comparativo-manual/lib/politica'
import { armarDocumento } from '../domain/documento'
import type { DocumentoBalance } from '../domain/types'

/** null si el ejercicio o su sociedad no existen. */
export async function cargarDocumentoBalance(
  ejercicioId: string,
): Promise<DocumentoBalance | null> {
  const ejercicio = await findEjercicioById(ejercicioId)
  if (!ejercicio) return null

  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const esPrimeraAdopcion = ejercicio.adopcionRT54 === 'PRIMERA_ADOPCION'

  const [sociedad, auditor, cuentas, documentos, notas, ajustes, ejercicioAnterior] =
    await Promise.all([
      findSociedadById(ejercicio.sociedadId),
      ejercicio.auditorId ? findAuditorById(ejercicio.auditorId) : Promise.resolve(null),
      findCuentasByEjercicio(ejercicioId),
      evaluarDocumentos(ejercicioId),
      cargarNotas(ejercicio),
      esPrimeraAdopcion ? findAjustesByEjercicio(ejercicioId) : Promise.resolve([]),
      anteriorId ? findEjercicioById(anteriorId) : Promise.resolve(null),
    ])
  if (!sociedad) return null

  // Estados y E.E.P.N. solo por el servicio único; el flujo, ídem (efectivo desde el SSP).
  const estados = await cargarEstadosConPN(ejercicio, cuentas)
  const flujo = await cargarFlujo(ejercicio, estados.estadosData)

  const aceptados = new Set(
    documentos.filter((d) => d.tipo === 'ANEXO' && d.estado === 'ACEPTADO').map((d) => d.clave),
  )
  const [evaluacion, bienesDeUso, costoVentas, gastos, notaTransicion] = await Promise.all([
    evaluarAutorizacionSinPersistir(ejercicio, { estados, flujo }),
    aceptados.has('ANEXO_BIENES_USO') ? cargarBienesDeUso(ejercicio) : Promise.resolve(null),
    aceptados.has('ANEXO_COSTO_VENTAS') ? cargarCostoVentas(ejercicio) : Promise.resolve(null),
    aceptados.has('ANEXO_GASTOS') ? cargarGastos(ejercicio) : Promise.resolve(null),
    // Misma regla que la pantalla de Notas: va solo si el contador la incluyó.
    inclusionNotaTransicion(esPrimeraAdopcion, documentos).incluir
      ? previsualizarNotaTransicion(ejercicio, { estados, ajustes })
      : Promise.resolve(null),
  ])

  // En carga manual, el cierre del anterior es por definición el día previo al inicio.
  const fechaCierreAnterior =
    ejercicioAnterior?.fechaCierre ??
    (mostrarColumnaAnterior(modo) ? diaAnteriorUTC(ejercicio.fechaInicio) : null)

  return armarDocumento({
    sociedad,
    ejercicio,
    auditor,
    fechaCierreAnterior,
    estados: estados.estadosData,
    pn: estados.pnData,
    flujo,
    anexos: { bienesDeUso, costoVentas, gastos },
    documentos,
    notas,
    notaTransicion,
    evaluacion,
  })
}
