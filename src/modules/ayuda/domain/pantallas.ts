/**
 * Resumen de cada pantalla fuera de los pasos del ejercicio (lo que muestra su botón (i)) y el
 * artículo de la ayuda que la explica en detalle. Los pasos del ejercicio están en ./pasos.
 * ayuda.test.ts exige que cada pantalla de la app tenga su botón y que el artículo exista.
 */
import { INFO_EJERCICIOS } from './pasos'
import type { InfoPaso } from './tipos'

const SIN_CALCULOS = 'No aplica: es una pantalla de gestión, no hace cálculos contables.'

export const INFO_PANTALLAS = {
  sociedades: {
    articulo: 'sociedades',
    info: {
      title: 'Sociedades',
      purpose:
        'Los clientes del estudio. Desde acá se da de alta una sociedad o persona física y se entra a sus ejercicios.',
      sources: ['Sociedades cargadas en el estudio.'],
      formulas: [SIN_CALCULOS],
      notes: [
        'Una sociedad desactivada no aparece en las listas pero conserva todos sus ejercicios.',
      ],
    },
  },
  sociedad: {
    articulo: 'sociedades',
    info: {
      title: 'Datos de la sociedad',
      purpose:
        'Los datos legales del cliente. Van a la carátula, al encabezado del balance y a la Nota 1.',
      sources: [
        'Razón social, CUIT, tipo de persona y tipo societario.',
        'Domicilio legal, localidad, provincia y código postal. La provincia define cómo la Nota 1 cita la aprobación de la RT 54.',
        'Actividad principal, categoría del ente según la RT 54, fecha de inscripción, matrícula y plazo de duración. Las S.A.S. también la composición del capital.',
      ],
      formulas: ['El CUIT se controla con su dígito verificador: si no es válido, no se acepta.'],
      notes: [
        'La fecha de inscripción se usa para controlar el "primer ejercicio": si la sociedad se inscribió más de un año antes, la app avisa (AUT-030).',
      ],
    },
  },
  auditores: {
    articulo: 'auditores',
    info: {
      title: 'Auditores',
      purpose: 'Los contadores que firman los estados contables del estudio.',
      sources: ['Auditores cargados en el estudio.'],
      formulas: [SIN_CALCULOS],
      notes: ['El auditor marcado como predeterminado se propone al crear cada ejercicio.'],
    },
  },
  auditor: {
    articulo: 'auditores',
    info: {
      title: 'Datos del auditor',
      purpose: 'Los datos del pie de firma de los estados contables.',
      sources: [
        'Nombre y apellido, título profesional, matrícula, consejo profesional y universidad.',
        'Localidad del informe y texto de firma.',
      ],
      formulas: [SIN_CALCULOS],
      notes: ['Marcalo como predeterminado si firma la mayoría de los balances.'],
    },
  },
  estudio: {
    articulo: 'estudio',
    info: {
      title: 'Configuración del estudio',
      purpose: 'Los datos del estudio contable y la apariencia de la app.',
      sources: ['Nombre comercial, CUIT y tipo de estudio.', 'Color principal de la app.'],
      formulas: [
        'El color tiene que tener contraste suficiente con el texto blanco: si es muy claro, la app lo rechaza y dice el contraste.',
      ],
    },
  },
  clasificaciones: {
    articulo: 'clasificaciones',
    info: {
      title: 'Clasificaciones RT 54',
      purpose:
        'El catálogo de rubros (clasificaciones) donde se asignan las cuentas del balance, y las secciones que los agrupan.',
      sources: [
        'Los rubros de la RT 54 que trae la app.',
        'Las clasificaciones y secciones propias del estudio (nombre y sigla libres).',
      ],
      formulas: [
        'Una sección marcada como gasto es una columna del Anexo III y, si está configurada para mostrarse, una línea del Estado de Resultados con su total.',
      ],
      notes: [
        'Ejemplo: la sección "Gastos operativos / GTO", marcada como gasto, con las clasificaciones Sueldos y Alquileres, da una línea "Gastos operativos" en el Estado de Resultados y una columna GTO en el Anexo III.',
        'Las secciones de gastos que no van al Estado de Resultados (por ejemplo, gastos vinculados al costo) se configuran en el Anexo III.',
        'Algunos rubros disparan anexos y notas: por ejemplo, Bienes de uso sugiere el Anexo I.',
      ],
    },
  },
  clasificacion: {
    articulo: 'clasificaciones',
    info: {
      title: 'Clasificación (rubro)',
      purpose: 'Dónde va una cuenta: a qué estado, en qué sección y con qué saldo normal.',
      sources: [
        'Nombre, sección y estado al que va (Situación patrimonial, Resultados o Patrimonio neto).',
        'Naturaleza esperada del saldo (deudora o acreedora) y orden.',
      ],
      formulas: [
        'Valor presentado = saldo de la cuenta con el signo según la naturaleza del rubro.',
      ],
      notes: [
        'El catálogo es del estudio: un cambio se ve en todos los ejercicios que usan esa clasificación.',
      ],
    },
  },
  seccion: {
    articulo: 'clasificaciones',
    info: {
      title: 'Sección',
      purpose:
        'Agrupa clasificaciones. Si es de gastos, arma una columna del Anexo III y una línea del Estado de Resultados.',
      sources: ['Nombre y sigla libres.', 'Si es o no una sección de gastos.'],
      formulas: ['Total de la sección = suma de sus clasificaciones.'],
      notes: [
        'Para que una sección de gastos no salga en el Estado de Resultados (por ejemplo, gastos vinculados al costo), configuralo en el Anexo III.',
      ],
    },
  },
  ejercicios: { articulo: 'paso-ejercicios', info: INFO_EJERCICIOS },
  ejercicio: {
    articulo: 'crear-ejercicio',
    info: {
      title: 'Datos del ejercicio',
      purpose:
        'Período, auditor, categoría del ente, índices de inflación y cómo se resuelve el ejercicio anterior.',
      sources: [
        'Fechas de inicio y cierre, número de ejercicio y fecha del informe del auditor.',
        'Índices de inflación al cierre del ejercicio anterior y al cierre de este.',
        'Ejercicio anterior: vinculado a uno cargado, carga manual o primer ejercicio.',
      ],
      formulas: [
        'Coeficiente = índice actual ÷ índice anterior. Se muestra con 2 decimales y se calcula siempre completo.',
      ],
      notes: [
        'Cambiar cómo se resuelve el ejercicio anterior anula la autorización y las confirmaciones; si se deja la carga manual, sus importes se borran (la app pide confirmación).',
        'La categoría del ente y los índices también arman la Nota 1.',
      ],
    },
  },
  importar: {
    articulo: 'importar-excel',
    info: {
      title: 'Importar el balance desde Excel',
      purpose: 'Carga las cuentas del balance de sumas y saldos desde un archivo .xlsx.',
      sources: ['El archivo del sistema contable del cliente (Tango, Bejerman…).'],
      formulas: [
        'Saldo final = Saldo deudor - Saldo acreedor',
        'Control: total del debe = total del haber, exacto (sin tolerancia de centavos)',
      ],
      notes: ['Reimportar reemplaza todas las cuentas: se pierde la clasificación.'],
    },
  },
  'importar-manual': {
    articulo: 'paso-balance',
    info: {
      title: 'Carga manual de cuentas',
      purpose: 'Para escribir las cuentas del balance de sumas y saldos sin archivo.',
      sources: ['Código, nombre, saldo deudor y saldo acreedor de cada cuenta.'],
      formulas: [
        'Saldo final = Saldo deudor - Saldo acreedor',
        'Control: total del debe = total del haber, exacto (sin tolerancia de centavos)',
      ],
      notes: ['Cada cuenta necesita un código único y un nombre.'],
    },
  },
} satisfies Record<string, { articulo: string; info: InfoPaso }>

export type ClavePantalla = keyof typeof INFO_PANTALLAS
