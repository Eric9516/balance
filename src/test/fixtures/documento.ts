/**
 * Insumos de prueba para el documento imprimible: un ejercicio chico con estados,
 * E.E.P.N. y flujo armados con las mismas funciones puras que usa la app.
 */

import type { AuditorDTO } from '@/modules/auditores/domain/types'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import type { SociedadDTO } from '@/modules/sociedades/domain/types'
import type { EstadosData, RubroFila } from '@/modules/estados/domain/types'
import { armarEvolucionPN } from '@/modules/patrimonio-neto/domain/evolucion'
import { armarFlujo } from '@/modules/flujo-efectivo/domain/calculo'
import type { InsumosDocumento } from '@/modules/exportacion/domain/types'

export const sociedadPrueba: SociedadDTO = {
  id: 'soc-1',
  estudioId: 'est-1',
  razonSocial: 'La Esperanza S.R.L.',
  cuit: '30-12345678-9',
  tipoPersona: 'JURIDICA',
  tipoSocietario: 'S.R.L.',
  condicionFiscal: null,
  domicilioLegal: 'San Martín 123',
  localidad: 'Leones',
  provincia: 'Córdoba',
  codigoPostal: '2594',
  actividadPpal: 'Venta de cereales',
  actividadSecundaria: null,
  clasificacionRT54: null,
  categoriaEnte: 'PEQUENA',
  fechaInscripcion: new Date('2015-04-10T00:00:00.000Z'),
  matriculaPJ: '12345-A',
  plazoDuracion: new Date('2114-04-10T00:00:00.000Z'),
  composicionCapital: null,
  activo: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
}

export const auditorPrueba: AuditorDTO = {
  id: 'aud-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  nombreCompleto: 'Pérez, Ana',
  tituloProfesional: 'Contadora Pública',
  matricula: '10.1234.5',
  consejoProfesional: 'CPCE Córdoba',
  universidad: null,
  localidadInforme: 'Leones',
  textoFirma: 'Ana Pérez\nContadora Pública (UNC)\nMat. 10.1234.5 - CPCE Córdoba',
  esDefault: true,
  activo: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
}

export function ejercicioPrueba(
  overrides: Partial<EjercicioContableDTO> = {},
): EjercicioContableDTO {
  return {
    id: 'ej-1',
    estudioId: 'est-1',
    sociedadId: 'soc-1',
    auditorId: 'aud-1',
    auditorNombre: 'Pérez, Ana',
    ejercicioAnteriorId: null,
    modoAnterior: 'SIN_ANTERIOR',
    comparativoAutorizadoEn: null,
    comparativoAutorizadoPor: null,
    anteriorAjustadoEn: null,
    categoriaEnte: 'PEQUENA',
    numeroEjercicio: 5,
    fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
    fechaCierre: new Date('2025-12-31T00:00:00.000Z'),
    fechaInformeAuditor: new Date('2026-03-15T00:00:00.000Z'),
    denominacion: 'Ejercicio al 31/12/2025',
    estado: 'EN_PROCESO',
    clasificacionEntidad: null,
    indiceInflacionAnterior: 100,
    indiceInflacionActual: 125,
    adopcionRT54: 'APLICACION_CONTINUADA',
    criteriosBienesCambio: null,
    hechosPosterioress: false,
    hechosPosterioressTexto: null,
    notaUnoTexto: null,
    notaUnoEditadaEn: null,
    pnConfirmado: false,
    estadosConfirmado: false,
    balanceAnteriorDisponible: true,
    nivelComparativoSSP: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function rubro(
  id: string,
  nombre: string,
  seccionSSP: string,
  displayValue: number,
  displayValueAnt = 0,
  notaNumero: number | null = null,
): RubroFila {
  return {
    id,
    codigo: id.toUpperCase(),
    nombre,
    estadoDestino: seccionSSP === 'PATRIMONIO_NETO' ? 'PN' : 'SSP',
    seccionSSP,
    seccionEERR: null,
    naturalezaEsperada: seccionSSP.startsWith('ACTIVO') ? 'DEUDORA' : 'ACREEDORA',
    orden: 1,
    displayValue,
    displayValueAnt,
    notaNumero,
    cuentas: [],
  }
}

/** Activo 1.000 = Pasivo 400 + PN 600 (capital 380 + resultado 220). */
export function estadosPrueba(conAnterior = false): EstadosData {
  const ant = (v: number) => (conAnterior ? v : 0)
  return {
    sspRubros: [
      rubro('caja', 'Caja y bancos', 'ACTIVO_CORRIENTE', 300, ant(250), 2),
      rubro('creditos', 'Créditos por ventas', 'ACTIVO_CORRIENTE', 200, ant(150), 3),
      rubro('bienes-uso', 'Bienes de uso', 'ACTIVO_NO_CORRIENTE', 500, ant(400)),
      rubro('deudas-com', 'Deudas comerciales', 'PASIVO_CORRIENTE', 400, ant(300), 4),
      rubro('capital', 'Capital', 'PATRIMONIO_NETO', 380, ant(380)),
    ],
    eerrRubros: [],
    eerr: {
      ingresos: 1000,
      ingresosAnt: ant(800),
      notaIngresosNum: 5,
      costoVentas: 600,
      costoVentasAnt: ant(500),
      notaCostoVentasNum: null,
      usaAnexoCosto: true,
      seccionesGasto: [
        { key: 'grupo:adm', nombre: 'Gastos de administración', total: 100, totalAnt: ant(90) },
      ],
      usaAnexoGastos: true,
      resultadosFinancieros: -50,
      resultadosFinancierosAnt: ant(20),
      rfCuentas: [],
      impuestoGanancias: 30,
      impuestoGananciasAnt: ant(25),
      igCuentas: [],
      utilidadBruta: 400,
      utilidadBrutaAnt: ant(300),
      resultadoAntesIG: 250,
      resultadoAntesIGAnt: ant(230),
      utilidadEjercicio: 220,
      utilidadEjercicioAnt: ant(-40),
    },
    patrimonioNetoFinal: null,
    patrimonioNetoFinalAnt: null,
    sinClasificar: 0,
    totalCuentas: 5,
    hayEjercicioAnterior: conAnterior,
  }
}

export function insumosPrueba(overrides: Partial<InsumosDocumento> = {}): InsumosDocumento {
  const ejercicio = overrides.ejercicio ?? ejercicioPrueba()
  const modo = ejercicio.modoAnterior ?? 'PENDIENTE'
  const conAnterior = modo === 'VINCULADO' || modo === 'MANUAL'
  const estados = overrides.estados ?? estadosPrueba(conAnterior)
  const pn = armarEvolucionPN({
    ejercicioId: ejercicio.id,
    guardados: [
      {
        id: 'mov-1',
        ejercicioId: ejercicio.id,
        tipo: 'SALDO_INICIO',
        orden: 10,
        capitalSuscripto: 380,
        ajusteCapital: 0,
        aportesIrrevocables: 0,
        reservaLegal: 0,
        otrasReservas: 0,
        rdosNoAsignados: 0,
        totalAnterior: conAnterior ? 420 : 0,
      },
    ],
    resultadoEjercicio: estados.eerr.utilidadEjercicio,
    modo,
  })
  const flujo = armarFlujo({
    guardado: {
      id: 'flujo-1',
      saldoInicial: 250,
      modificacionesEjAnt: 0,
      saldoFinal: 300,
      saldoInicialAnterior: 0,
      modificacionesEjAntAnt: 0,
      saldoFinalAnterior: 0,
      items: [
        {
          id: 'it-1',
          seccion: 'ACTIVIDADES_OPERATIVAS',
          concepto: 'Cobros por ventas de bienes y servicios',
          importe: 50,
          importeAnterior: 0,
          orden: 1,
        },
      ],
    },
    efectivo: { actual: 300, anterior: conAnterior ? 250 : 0 },
    modo,
    flujoAnterior: null,
    indices: { actual: 1, anterior: 1 },
  })
  return {
    sociedad: sociedadPrueba,
    ejercicio,
    auditor: auditorPrueba,
    fechaCierreAnterior: conAnterior ? new Date('2024-12-31T00:00:00.000Z') : null,
    estados,
    pn,
    flujo,
    anexos: { bienesDeUso: null, costoVentas: null, gastos: null },
    documentos: [],
    notas: [],
    notaTransicion: null,
    evaluacion: { bloqueantes: [], advertencias: [], puedeAutorizar: true },
    ...overrides,
  }
}
