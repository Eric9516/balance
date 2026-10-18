/**
 * Armado del juego de estados contables impreso. Puro: recibe lo que ya calcularon
 * los servicios y devuelve qué se imprime, en qué orden, con qué textos y si va
 * en borrador. No recalcula importes.
 */

import { formatFecha } from '@/lib/utils/dates'
import { modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import {
  editarAnteriorManual,
  mostrarColumnaAnterior,
} from '@/modules/comparativo-manual/lib/politica'
import { armarCaratula } from '@/modules/sociedades/domain/caratula'
import { armarLineasEERR } from '@/modules/estados/domain/lineasEERR'
import { ANEXOS_CON_VISTA, type AnexoConVista } from '@/modules/documentos/domain/anexos'
import type { AuditorDTO } from '@/modules/auditores/domain/types'
import { TEXTOS_DOCUMENTO as T } from './textos'
import type {
  ColumnasDocumento,
  DocumentoBalance,
  EncabezadoDocumento,
  FirmasDocumento,
  InsumosDocumento,
  SeccionDocumento,
} from './types'

export function armarEncabezado(
  sociedad: { razonSocial: string; cuit: string },
  ejercicio: { fechaCierre: Date; numeroEjercicio: number | null },
): EncabezadoDocumento {
  const partes = [T.encabezado.estados(ejercicio.fechaCierre)]
  if (ejercicio.numeroEjercicio != null)
    partes.push(T.encabezado.ejercicio(ejercicio.numeroEjercicio))
  return {
    razonSocial: sociedad.razonSocial,
    cuit: sociedad.cuit,
    linea: partes.join(T.encabezado.separador),
    leyendaMoneda: T.encabezado.leyendaMoneda,
  }
}

/** Líneas de la firma del auditor: su texto de firma o, si no lo cargó, sus datos. */
export function lineasFirmaAuditor(auditor: AuditorDTO): string[] {
  const propias = (auditor.textoFirma ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (propias.length > 0) return propias
  const matricula = [
    auditor.consejoProfesional,
    auditor.matricula ? `Mat. ${auditor.matricula}` : null,
  ]
    .filter(Boolean)
    .join(' - ')
  return [`${auditor.nombre} ${auditor.apellido}`, auditor.tituloProfesional, matricula].filter(
    (l): l is string => !!l,
  )
}

export function armarFirmas(
  auditor: AuditorDTO | null,
  fechaInformeAuditor: Date | null,
): FirmasDocumento {
  return {
    representante: { rol: T.firmas.representante },
    auditor: auditor
      ? {
          lineas: lineasFirmaAuditor(auditor),
          leyenda: T.firmas.auditor(formatFecha(fechaInformeAuditor, T.firmas.sinFecha)),
        }
      : null,
  }
}

function seccionAnexo(
  anexo: AnexoConVista,
  insumos: InsumosDocumento,
  columnas: ColumnasDocumento,
): SeccionDocumento | null {
  const { fechaInicio, fechaCierre, fechaCierreAnterior } = columnas
  switch (anexo.clave) {
    case 'ANEXO_BIENES_USO': {
      const datos = insumos.anexos.bienesDeUso
      if (!datos || datos.bienes.length === 0) return null
      return {
        tipo: 'anexo-bienes-uso',
        titulo: anexo.titulo,
        subtitulo: T.subtitulos.al(fechaCierre, fechaCierreAnterior),
        anexo: datos,
      }
    }
    case 'ANEXO_COSTO_VENTAS': {
      const datos = insumos.anexos.costoVentas
      if (!datos || !datos.datos) return null
      return {
        tipo: 'anexo-costo-ventas',
        titulo: anexo.titulo,
        subtitulo: T.subtitulos.porElEjercicio(fechaInicio, fechaCierre, fechaCierreAnterior),
        anexo: datos,
      }
    }
    case 'ANEXO_GASTOS': {
      const datos = insumos.anexos.gastos
      if (!datos || datos.secciones.length === 0) return null
      return {
        tipo: 'anexo-gastos',
        titulo: anexo.titulo,
        subtitulo: T.subtitulos.porElEjercicio(fechaInicio, fechaCierre, fechaCierreAnterior),
        anexo: datos,
      }
    }
  }
}

export function armarDocumento(insumos: InsumosDocumento): DocumentoBalance {
  const { sociedad, ejercicio, evaluacion } = insumos
  const modo = modoEfectivo(ejercicio)
  const mostrarAnterior = mostrarColumnaAnterior(modo)
  const columnas: ColumnasDocumento = {
    fechaInicio: ejercicio.fechaInicio,
    fechaCierre: ejercicio.fechaCierre,
    fechaCierreAnterior: mostrarAnterior ? insumos.fechaCierreAnterior : null,
    mostrarAnterior,
    anteriorManual: editarAnteriorManual(modo),
  }
  const { fechaInicio, fechaCierre, fechaCierreAnterior } = columnas
  const porElEjercicio = T.subtitulos.porElEjercicio(fechaInicio, fechaCierre, fechaCierreAnterior)

  const advertencias: string[] = [
    ...evaluacion.advertencias.map((a) => a.mensaje),
    ...insumos.pn.advertencias,
    ...insumos.flujo.advertencias,
    ...(insumos.anexos.bienesDeUso?.advertencias ?? []),
    ...(insumos.anexos.costoVentas?.advertencias ?? []),
  ]
  const pendientes: string[] = []

  // ── Carátula ───────────────────────────────────────────────────────────────
  const caratula = armarCaratula(sociedad, ejercicio)
  if (caratula.camposFaltantes.length > 0) {
    advertencias.push(T.pendientes.caratula(caratula.camposFaltantes))
  }

  // ── Firmas ─────────────────────────────────────────────────────────────────
  const firmas = armarFirmas(insumos.auditor, ejercicio.fechaInformeAuditor)
  if (!insumos.auditor) advertencias.push(T.pendientes.sinAuditor)
  else if (!ejercicio.fechaInformeAuditor) advertencias.push(T.pendientes.sinFechaInforme)

  // ── Estados ────────────────────────────────────────────────────────────────
  // El PN del SSP sale del E.E.P.N., igual que en la pantalla de Estados.
  const estados = {
    ...insumos.estados,
    patrimonioNetoFinal: insumos.pn.totalActual,
    patrimonioNetoFinalAnt: insumos.pn.totalAnterior,
  }
  const secciones: SeccionDocumento[] = [
    { tipo: 'caratula', caratula },
    {
      tipo: 'ssp',
      titulo: T.titulos.ssp,
      subtitulo: T.subtitulos.al(fechaCierre, fechaCierreAnterior),
      estados,
    },
    {
      tipo: 'eerr',
      titulo: T.titulos.eerr,
      subtitulo: porElEjercicio,
      lineas: armarLineasEERR(estados.eerr),
    },
    { tipo: 'eepn', titulo: T.titulos.eepn, subtitulo: porElEjercicio, pn: insumos.pn },
    {
      tipo: 'flujo',
      titulo: T.titulos.flujo,
      subtitulo: porElEjercicio + T.subtitulos.flujoMetodo,
      flujo: insumos.flujo,
    },
  ]

  // ── Anexos aceptados, en el orden fijo del catálogo ────────────────────────
  const aceptados = insumos.documentos.filter((d) => d.tipo === 'ANEXO' && d.estado === 'ACEPTADO')
  for (const anexo of ANEXOS_CON_VISTA) {
    if (!aceptados.some((d) => d.clave === anexo.clave)) continue
    const seccion = seccionAnexo(anexo, insumos, columnas)
    if (seccion) secciones.push(seccion)
    else pendientes.push(T.pendientes.anexoSinDatos(anexo.titulo))
  }
  for (const d of aceptados) {
    if (!ANEXOS_CON_VISTA.some((a) => a.clave === d.clave)) {
      pendientes.push(T.pendientes.anexoSinVista(d.titulo))
    }
  }

  // ── Notas ──────────────────────────────────────────────────────────────────
  pendientes.push(T.pendientes.notaUnoDetalle)
  secciones.push({
    tipo: 'notas',
    titulo: T.titulos.notas,
    subtitulo: porElEjercicio,
    notaUno: { titulo: T.pendientes.notaUno, detalle: T.pendientes.notaUnoDetalle },
    transicion: insumos.notaTransicion
      ? { titulo: T.pendientes.transicion, nota: insumos.notaTransicion }
      : null,
    notas: [...insumos.notas].sort((a, b) => a.orden - b.orden),
  })

  // ── Informe y Memoria: lugar reservado ─────────────────────────────────────
  pendientes.push(T.pendientes.informeDetalle, T.pendientes.memoriaDetalle)
  secciones.push(
    {
      tipo: 'pendiente',
      clave: 'INFORME_AUDITOR',
      titulo: T.titulos.informe,
      detalle: T.pendientes.informeDetalle,
    },
    {
      tipo: 'pendiente',
      clave: 'MEMORIA',
      titulo: T.titulos.memoria,
      detalle: T.pendientes.memoriaDetalle,
    },
  )

  return {
    ejercicioId: ejercicio.id,
    sociedadId: sociedad.id,
    encabezado: armarEncabezado(sociedad, ejercicio),
    columnas,
    firmas,
    borrador: {
      es: evaluacion.bloqueantes.length > 0,
      motivos: evaluacion.bloqueantes.map((b) => b.mensaje),
    },
    advertencias,
    pendientes,
    secciones,
  }
}
