/**
 * Catálogo de reglas de anexos / notas — definido EN CÓDIGO (no en DB).
 *
 * Cada regla describe un documento sugerible y la condición que lo dispara,
 * expresada contra los CÓDIGOS de rubro del catálogo (RubroBase.codigo).
 * El motor (lib/evaluar.ts) evalúa estas reglas contra los saldos reales del
 * ejercicio y produce sugerencias. La app SOLO sugiere; el contador decide.
 *
 * Para agregar/editar un documento sugerible, se toca SOLO este archivo.
 */

export type TipoDoc = 'ANEXO' | 'NOTA'

/** Contexto que recibe la condición extra de una regla. */
export type EvalCtx = {
  /** Saldo neto por código de rubro (sólo rubros con cuentas). */
  saldos: Map<string, number>
  /** Helper: ¿el rubro `cod` tiene saldo distinto de cero? */
  tiene: (cod: string) => boolean
  /** ¿El ejercicio tiene un Costo de Ventas (Anexo II) cargado? */
  costoVentasCargado: boolean
  /**
   * ¿Hay cuentas en moneda extranjera?
   * PREPARADO pero no implementado: hoy CuentaContable no tiene el dato.
   * El día que exista (esMonedaExtranjera / monedaId), este flag se llena solo
   * desde el repository y la regla NOTA_MONEDA_EXTRANJERA se activa sin tocar nada más.
   */
  hayMonedaExtranjera: boolean
}

export type ReglaDoc = {
  /** ID estable y único. Se usa como clave de persistencia. */
  clave: string
  tipo: TipoDoc
  titulo: string
  /** Códigos de rubro que disparan la sugerencia si ALGUNO tiene saldo ≠ 0. */
  rubros: string[]
  /** Condición adicional opcional (se suma con OR a los rubros). */
  cuando?: (ctx: EvalCtx) => boolean
}

/**
 * Catálogo. Los códigos son los reales del catálogo de la app (RubroBase.codigo).
 */
export const REGLAS: ReglaDoc[] = [
  {
    clave: 'ANEXO_BIENES_USO',
    tipo: 'ANEXO',
    titulo: 'Anexo de Bienes de Uso',
    rubros: ['ACT-NCTE-09'],
  },
  {
    // Para este estudio los intangibles van como NOTA de composición (no anexo).
    // La nota se autogenera en el paso "Notas" desde el rubro ACT-NCTE-12.
    clave: 'NOTA_INTANGIBLES',
    tipo: 'NOTA',
    titulo: 'Nota de Activos Intangibles',
    rubros: ['ACT-NCTE-12'],
  },
  {
    clave: 'NOTA_INVERSIONES',
    tipo: 'NOTA',
    titulo: 'Nota de Inversiones',
    // Inversiones financieras (cte/no cte), otras inversiones y propiedades de inversión
    rubros: ['ACT-CTE-02', 'ACT-NCTE-01', 'ACT-CTE-10', 'ACT-NCTE-11', 'ACT-NCTE-10'],
  },
  {
    clave: 'NOTA_BIENES_CAMBIO',
    tipo: 'NOTA',
    titulo: 'Nota de Bienes de Cambio',
    rubros: ['ACT-CTE-09', 'ACT-NCTE-08'],
  },
  {
    clave: 'ANEXO_COSTO_VENTAS',
    tipo: 'ANEXO',
    titulo: 'Anexo de Costo de Ventas',
    rubros: ['EERR-CST-01'],
    cuando: (c) => c.costoVentasCargado,
  },
  {
    clave: 'ANEXO_GASTOS',
    tipo: 'ANEXO',
    titulo: 'Anexo de Gastos',
    rubros: ['EERR-GADM-01', 'EERR-GCOM-01', 'EERR-GBAN-01', 'EERR-IICC-01', 'EERR-GOP-01', 'EERR-GVC-01'],
  },
  {
    // Previsiones también va como NOTA en este estudio (autogenerada en "Notas").
    clave: 'NOTA_PREVISIONES',
    tipo: 'NOTA',
    titulo: 'Nota de Previsiones',
    rubros: ['PAS-CTE-09', 'PAS-NCTE-10'],
  },
  {
    clave: 'NOTA_DEUDAS_FISCALES',
    tipo: 'NOTA',
    titulo: 'Nota de Deudas Fiscales',
    rubros: ['PAS-CTE-03', 'PAS-NCTE-03'],
  },
  {
    clave: 'NOTA_DEUDAS_LABORALES',
    tipo: 'NOTA',
    titulo: 'Nota de Deudas Laborales y Previsionales',
    rubros: ['PAS-CTE-04', 'PAS-NCTE-04'],
  },
  {
    clave: 'NOTA_PARTES_RELACIONADAS',
    tipo: 'NOTA',
    titulo: 'Nota de Partes Relacionadas',
    rubros: ['ACT-CTE-06', 'ACT-NCTE-05', 'PAS-CTE-06', 'PAS-NCTE-06'],
  },
  {
    clave: 'NOTA_MONEDA_EXTRANJERA',
    tipo: 'NOTA',
    titulo: 'Nota de Moneda Extranjera',
    // PREPARADO: sin rubro propio. Se dispara sólo por el flag de contexto, que
    // hoy siempre es false hasta que CuentaContable tenga el dato de moneda.
    rubros: [],
    cuando: (c) => c.hayMonedaExtranjera,
  },
]

/** Lookup rápido por clave. */
export const REGLA_POR_CLAVE = new Map(REGLAS.map((r) => [r.clave, r]))
