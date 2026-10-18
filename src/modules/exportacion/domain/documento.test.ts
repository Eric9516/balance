import { describe, expect, it } from 'vitest'
import {
  auditorPrueba,
  ejercicioPrueba,
  insumosPrueba,
  sociedadPrueba,
} from '@/test/fixtures/documento'
import { armarDocumento, armarEncabezado, armarFirmas, lineasFirmaAuditor } from './documento'

const tipos = (doc: ReturnType<typeof armarDocumento>) => doc.secciones.map((s) => s.tipo)

describe('armarDocumento', () => {
  it('arma el juego en el orden fijo: carátula, estados, notas e informe y memoria pendientes', () => {
    const doc = armarDocumento(insumosPrueba())
    expect(tipos(doc)).toEqual([
      'caratula',
      'ssp',
      'eerr',
      'eepn',
      'flujo',
      'notas',
      'pendiente',
      'pendiente',
    ])
    expect(doc.encabezado.linea).toBe('Estados contables al 31/12/2025 · Ejercicio económico N° 5')
    expect(doc.borrador).toEqual({ es: false, motivos: [] })
    expect(doc.pendientes).toContain(
      'Pendiente: el texto de la Nota 1 se genera y edita en un paso posterior.',
    )
  })

  it('sin ejercicio anterior no hay columna comparativa', () => {
    const doc = armarDocumento(insumosPrueba())
    expect(doc.columnas.mostrarAnterior).toBe(false)
    expect(doc.columnas.fechaCierreAnterior).toBeNull()
    const ssp = doc.secciones.find((s) => s.tipo === 'ssp')
    expect(ssp?.subtitulo).toBe('Al 31/12/2025')
  })

  it('vinculado: columna comparativa con la fecha de cierre del anterior', () => {
    const doc = armarDocumento(
      insumosPrueba({
        ejercicio: ejercicioPrueba({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'ej-0' }),
      }),
    )
    expect(doc.columnas).toMatchObject({ mostrarAnterior: true, anteriorManual: false })
    expect(doc.columnas.fechaCierreAnterior?.toISOString()).toBe('2024-12-31T00:00:00.000Z')
    const eerr = doc.secciones.find((s) => s.tipo === 'eerr')
    expect(eerr?.subtitulo).toBe(
      'Por el ejercicio iniciado el 01/01/2025 y finalizado el 31/12/2025, comparativo con el ejercicio anterior finalizado el 31/12/2024',
    )
  })

  it('el PN del SSP sale del E.E.P.N. y el EERR usa las líneas del dominio', () => {
    const doc = armarDocumento(insumosPrueba())
    const ssp = doc.secciones.find((s) => s.tipo === 'ssp')
    expect(ssp?.tipo === 'ssp' && ssp.estados.patrimonioNetoFinal).toBe(600)
    const eerr = doc.secciones.find((s) => s.tipo === 'eerr')
    expect(eerr?.tipo === 'eerr' && eerr.lineas.at(-1)?.etiqueta).toBe('GANANCIA DEL PERÍODO')
  })

  it('incluye solo los anexos aceptados que tienen datos, en orden I, II, III', () => {
    const insumos = insumosPrueba({
      documentos: [
        { clave: 'ANEXO_GASTOS', tipo: 'ANEXO', titulo: 'Anexo de Gastos', estado: 'ACEPTADO' },
        {
          clave: 'ANEXO_COSTO_VENTAS',
          tipo: 'ANEXO',
          titulo: 'Anexo de Costo de Ventas',
          estado: 'ACEPTADO',
        },
        {
          clave: 'ANEXO_BIENES_USO',
          tipo: 'ANEXO',
          titulo: 'Anexo de Bienes de Uso',
          estado: 'DESCARTADO',
        },
        { clave: 'manual-1', tipo: 'ANEXO', titulo: 'Anexo de Inversiones', estado: 'ACEPTADO' },
      ],
      anexos: {
        bienesDeUso: null,
        costoVentas: {
          datos: {
            id: 'cv-1',
            ejercicioId: 'ej-1',
            existenciaInicial: 100,
            compras: 600,
            gastosFabricacion: 0,
            existenciaFinal: 100,
          },
          datosAnteriores: null,
          existenciaInicialBloqueada: false,
          existenciaInicialDerivada: null,
          advertencias: [],
          conceptosExtra: [],
        },
        gastos: { secciones: [], todasSecciones: [] },
      },
    })
    const doc = armarDocumento(insumos)
    expect(tipos(doc)).toEqual([
      'caratula',
      'ssp',
      'eerr',
      'eepn',
      'flujo',
      'anexo-costo-ventas',
      'notas',
      'pendiente',
      'pendiente',
    ])
    expect(doc.pendientes).toContain(
      'Anexo III — Gastos: aceptado en "Anexos y notas" pero sin datos cargados, por eso no se imprime.',
    )
    expect(doc.pendientes).toContain(
      'Anexo de Inversiones: aceptado en "Anexos y notas" pero todavía no tiene pantalla de carga, por eso no se imprime.',
    )
  })

  it('con bloqueantes en la compuerta sale en borrador y lista los motivos', () => {
    const doc = armarDocumento(
      insumosPrueba({
        evaluacion: {
          bloqueantes: [
            {
              codigo: 'AUT-002',
              tipo: 'CONSISTENCIA_EJERCICIO',
              severidad: 'ERROR',
              mensaje: 'Falta la categoría del ente.',
            },
          ],
          advertencias: [
            {
              codigo: 'AUT-052',
              tipo: 'CONSISTENCIA_EJERCICIO',
              severidad: 'ADVERTENCIA',
              mensaje: 'No hay flujo cargado.',
            },
          ],
          puedeAutorizar: false,
        },
      }),
    )
    expect(doc.borrador).toEqual({ es: true, motivos: ['Falta la categoría del ente.'] })
    expect(doc.advertencias).toContain('No hay flujo cargado.')
  })

  it('avisa cuando faltan datos de la carátula, el auditor o la fecha del informe', () => {
    const sinAuditor = armarDocumento(
      insumosPrueba({
        auditor: null,
        sociedad: { ...sociedadPrueba, matriculaPJ: null },
      }),
    )
    expect(sinAuditor.firmas.auditor).toBeNull()
    expect(sinAuditor.advertencias).toContain(
      'El ejercicio no tiene auditor asignado: el pie de firmas queda sin sus datos.',
    )
    expect(sinAuditor.advertencias).toContain('Carátula: faltan matrícula PJ.')

    const sinFecha = armarDocumento(
      insumosPrueba({ ejercicio: ejercicioPrueba({ fechaInformeAuditor: null }) }),
    )
    expect(sinFecha.firmas.auditor?.leyenda).toBe(
      'Firmado a los efectos de su identificación con mi informe de fecha ....../....../......',
    )
    expect(sinFecha.advertencias.some((a) => a.startsWith('Falta la fecha del informe'))).toBe(true)
  })

  it('incluye la nota de transición y ordena las notas por orden', () => {
    const doc = armarDocumento(
      insumosPrueba({
        notas: [
          {
            id: 'n3',
            ejercicioId: 'ej-1',
            numero: 3,
            titulo: 'CRÉDITOS',
            tipo: 'CUANTITATIVA',
            orden: 2,
            criterioMedicion: null,
            textoApertura: null,
            detalles: [],
          },
          {
            id: 'n2',
            ejercicioId: 'ej-1',
            numero: 2,
            titulo: 'CAJA',
            tipo: 'CUANTITATIVA',
            orden: 1,
            criterioMedicion: null,
            textoApertura: null,
            detalles: [],
          },
        ],
        notaTransicion: {
          titulo: 'Primera aplicación de la Resolución Técnica N° 54',
          parrafos: ['Texto.'],
          conciliacionPN: [],
          conciliacionResultado: [],
          reclasificaciones: [],
          advertencias: [],
        },
      }),
    )
    const notas = doc.secciones.find((s) => s.tipo === 'notas')
    expect(notas?.tipo === 'notas' && notas.notas.map((n) => n.numero)).toEqual([2, 3])
    expect(notas?.tipo === 'notas' && notas.transicion?.titulo).toBe(
      'Nota de primera aplicación de la Resolución Técnica N° 54',
    )
  })
})

describe('encabezado y firmas', () => {
  it('omite el número de ejercicio si no está cargado', () => {
    const enc = armarEncabezado(sociedadPrueba, {
      fechaCierre: new Date('2025-12-31T00:00:00.000Z'),
      numeroEjercicio: null,
    })
    expect(enc.linea).toBe('Estados contables al 31/12/2025')
    expect(enc.leyendaMoneda).toBe('Cifras expresadas en pesos, en moneda homogénea')
  })

  it('usa el texto de firma del auditor línea por línea', () => {
    expect(lineasFirmaAuditor(auditorPrueba)).toEqual([
      'Ana Pérez',
      'Contadora Pública (UNC)',
      'Mat. 10.1234.5 - CPCE Córdoba',
    ])
  })

  it('sin texto de firma arma las líneas con nombre, título y matrícula', () => {
    expect(lineasFirmaAuditor({ ...auditorPrueba, textoFirma: null })).toEqual([
      'Ana Pérez',
      'Contadora Pública',
      'CPCE Córdoba - Mat. 10.1234.5',
    ])
  })

  it('la leyenda lleva la fecha del informe en dd/mm/aaaa', () => {
    const firmas = armarFirmas(auditorPrueba, new Date('2026-03-15T00:00:00.000Z'))
    expect(firmas.representante.rol).toBe('Representante legal')
    expect(firmas.auditor?.leyenda).toBe(
      'Firmado a los efectos de su identificación con mi informe de fecha 15/03/2026',
    )
  })
})
