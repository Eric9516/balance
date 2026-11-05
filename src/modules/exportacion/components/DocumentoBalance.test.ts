/**
 * Renderiza el documento a HTML estático (sin navegador) y verifica contenido,
 * orden de secciones, formato de importes, columna comparativa y marca de agua.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ejercicioPrueba, insumosPrueba } from '@/test/fixtures/documento'
import { armarDocumento } from '../domain/documento'
import type { InsumosDocumento } from '../domain/types'
import { DocumentoBalance } from './DocumentoBalance'

function render(overrides: Partial<InsumosDocumento> = {}): string {
  const doc = armarDocumento(insumosPrueba(overrides))
  return renderToStaticMarkup(createElement(DocumentoBalance, { doc, volverHref: '/volver' }))
}

const posicion = (html: string, texto: string) => {
  const i = html.indexOf(texto)
  if (i < 0) throw new Error(`No se encontró "${texto}" en el HTML`)
  return i
}

describe('DocumentoBalance (HTML)', () => {
  it('imprime las secciones en orden con los títulos del juego', () => {
    // Solo las hojas: el panel de pantalla también menciona "Memoria".
    const html = render().slice(render().indexOf('</aside>'))
    const orden = [
      'ESTADOS CONTABLES',
      'Estado de Situación Patrimonial',
      'Estado de Resultados',
      'Estado de Evolución del Patrimonio Neto',
      'Estado de Flujo de Efectivo',
      'Notas a los estados contables',
      'Informe del Auditor Independiente',
      'Memoria',
    ].map((t) => posicion(html, t))
    expect([...orden].sort((a, b) => a - b)).toEqual(orden)
  })

  it('usa formato argentino, paréntesis para deducciones y guion para cero', () => {
    const html = render()
    expect(html).toContain('1.000,00') // ingresos y total activo
    expect(html).toContain('(600,00)') // costo de ventas, deducción
    expect(html).toContain('(50,00)') // resultados financieros negativos
    expect(html).toContain('GANANCIA DEL PERÍODO')
    expect(html).toContain('220,00')
    expect(html).toContain('TOTAL PASIVO + PATRIMONIO NETO')
    expect(html).toContain('(Nota 5)')
    expect(html).toContain('>—<') // importes en cero
  })

  it('lleva encabezado, leyenda de moneda y pie de firmas', () => {
    const html = render()
    expect(html).toContain('La Esperanza S.R.L.')
    expect(html).toContain('CUIT 30-12345678-9')
    expect(html).toContain('Estados contables al 31/12/2025 · Ejercicio económico N° 5')
    expect(html).toContain('Cifras expresadas en pesos, en moneda homogénea')
    expect(html).toContain('Representante legal')
    expect(html).toContain('Mat. 10.1234.5 - CPCE Córdoba')
    expect(html).toContain(
      'Firmado a los efectos de su identificación con mi informe de fecha 15/03/2026',
    )
  })

  it('sin ejercicio anterior no muestra la columna comparativa', () => {
    const html = render()
    expect(html).toContain('Ejercicio actual')
    expect(html).not.toContain('Ejercicio anterior')
    expect(html).not.toContain('BORRADOR')
  })

  it('vinculado: columna comparativa con la fecha del anterior', () => {
    const html = render({
      ejercicio: ejercicioPrueba({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'ej-0' }),
    })
    expect(html).toContain('Ejercicio anterior')
    expect(html).toContain('31/12/2024')
    expect(html).toContain('(40,00)') // pérdida del anterior entre paréntesis
  })

  it('con bloqueantes imprime la marca de agua BORRADOR y los motivos', () => {
    const html = render({
      evaluacion: {
        bloqueantes: [
          {
            codigo: 'AUT-050',
            tipo: 'CUADRE_BALANCE',
            severidad: 'ERROR',
            mensaje: 'El Estado de Flujo de Efectivo no cuadra.',
          },
        ],
        advertencias: [],
        puedeAutorizar: false,
      },
    })
    expect(html).toContain('class="marca-agua"')
    expect(html).toContain('BORRADOR')
    expect(html).toContain('El Estado de Flujo de Efectivo no cuadra.')
  })

  // Las dos vistas del Anexo I (elegidas en cada balance), con los mismos números.
  const conAnexoI = (formatoAnexoBienesUso: 'UN_CUADRO' | 'DOS_CUADROS') => {
    const html = render({
      documentos: [
        {
          clave: 'ANEXO_BIENES_USO',
          tipo: 'ANEXO',
          titulo: 'Anexo de Bienes de Uso',
          estado: 'ACEPTADO',
        },
      ],
      anexos: {
        bienesDeUso: {
          bienes: [
            {
              id: 'bdu-1',
              ejercicioId: 'ej-1',
              categoria: 'Rodados',
              orden: 1,
              costoInicioReexpresado: 3900000,
              costoAjusteInflacion: 500000,
              altas: 900000,
              bajas: 0,
              costoFinReexpresado: 5300000,
              depAcumInicio: 0,
              depAjusteInflacion: 0,
              depEjercicio: 800000,
              depBajas: 0,
              depAcumFin: 800000,
              netoResidualAnteriorManual: null,
            },
          ],
          bloqueadas: new Set(),
          sinDato: [],
          netoAnteriorMap: new Map(),
          advertencias: [],
        },
        costoVentas: null,
        gastos: null,
      },
      ejercicio: ejercicioPrueba({ anexoBienesUso: formatoAnexoBienesUso }),
    })
    return html.slice(html.indexOf('Anexo I — Bienes de uso'))
  }

  it('imprime el Anexo I en un solo cuadro: origen, amortizaciones y neto en la misma fila', () => {
    const anexo = conAnexoI('UN_CUADRO')
    expect(anexo).toContain('Valor de origen')
    expect(anexo).toContain('Amortizaciones acumuladas')
    expect(anexo).toContain('Neto residual')
    expect(anexo.match(/<table class="doc-tabla ancha/g)).toHaveLength(1)
    expect(anexo.match(/>Rubros</g)).toHaveLength(1)
    expect(anexo.match(/>Totales</g)).toHaveLength(1)
    // La fila de Rodados lleva juntos el valor de origen al cierre y el neto residual
    const desdeFila = anexo.indexOf('>Rodados<')
    const fila = anexo.slice(desdeFila, anexo.indexOf('</tr>', desdeFila))
    expect(fila).toContain('5.300.000,00')
    expect(fila).toContain('4.500.000,00')
  })

  it('imprime el Anexo I en dos cuadros: valor de origen y amortizaciones con neto residual', () => {
    const anexo = conAnexoI('DOS_CUADROS')
    expect(anexo).toContain('Valor de origen')
    expect(anexo).toContain('Amortizaciones acumuladas')
    expect(anexo).toContain('Neto residual')
    // Dos tablas, cada una con su columna de rubros y su fila de totales.
    expect(anexo.match(/<table class="doc-tabla ancha/g)).toHaveLength(2)
    expect(anexo.match(/>Rubros</g)).toHaveLength(2)
    expect(anexo.match(/>Totales</g)).toHaveLength(2)
    expect(anexo).toContain('5.300.000,00') // valor de origen al cierre
    expect(anexo).toContain('4.500.000,00') // neto residual
  })

  it('el panel de pantalla no se imprime y enlaza al ejercicio', () => {
    const html = render()
    expect(html).toContain('no-imprimir')
    expect(html).toContain('href="/volver"')
    expect(html).toContain('Imprimir / Guardar PDF')
  })
})
