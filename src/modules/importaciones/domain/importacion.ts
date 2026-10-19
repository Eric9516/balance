import { parseImporte } from '@/lib/utils/parseImporte'
import { comparaImportes, restar, sumarPor } from '@/lib/importe'

// Reglas puras de la importación del balance de sumas y saldos (sin DB ni framework).

/** Fila tal como llega de la UI (carga manual o Excel editado). Importes como texto o número. */
export type FilaImportacion = {
  codigo: string
  nombre: string
  saldoDeudor: string | number
  saldoAcreedor: string | number
}

export type CuentaImportada = {
  codigo: string
  nombre: string
  saldoDeudor: number
  saldoAcreedor: number
  /** saldoDeudor - saldoAcreedor: positivo = deudor, negativo = acreedor. */
  saldoFinal: number
}

export type ResultadoProceso = {
  cuentas: CuentaImportada[]
  /** Filas descartadas por no tener código o nombre. */
  filasError: number
  /** Códigos que aparecen más de una vez (la DB exige código único por ejercicio). */
  codigosDuplicados: string[]
}

/** Importes de una fila cruda, parseados (formato AR) y con saldo calculado en Decimal. */
export function importesDeFila(
  fila: Pick<FilaImportacion, 'saldoDeudor' | 'saldoAcreedor'>,
): Pick<CuentaImportada, 'saldoDeudor' | 'saldoAcreedor' | 'saldoFinal'> {
  const saldoDeudor = parseImporte(fila.saldoDeudor)
  const saldoAcreedor = parseImporte(fila.saldoAcreedor)
  return {
    saldoDeudor,
    saldoAcreedor,
    saldoFinal: restar(saldoDeudor, saldoAcreedor),
  }
}

/** Normaliza filas crudas: parsea importes y descarta las filas sin código o nombre. */
export function procesarFilas(filas: FilaImportacion[]): ResultadoProceso {
  const cuentas: CuentaImportada[] = []
  const vistos = new Set<string>()
  const duplicados = new Set<string>()
  let filasError = 0

  for (const fila of filas) {
    const codigo = String(fila.codigo ?? '').trim()
    const nombre = String(fila.nombre ?? '').trim()
    if (!codigo || !nombre) {
      filasError++
      continue
    }
    if (vistos.has(codigo)) duplicados.add(codigo)
    vistos.add(codigo)
    cuentas.push({ codigo, nombre, ...importesDeFila(fila) })
  }

  return { cuentas, filasError, codigosDuplicados: [...duplicados] }
}

export type ResultadoCuadre = {
  totalDeudor: number
  totalAcreedor: number
  diferencia: number
  cuadrado: boolean
}

/** Total debe = total haber (con tolerancia de centavos). Suma exacta (ver @/lib/importe). */
export function validarCuadre(
  cuentas: Pick<CuentaImportada, 'saldoDeudor' | 'saldoAcreedor'>[],
): ResultadoCuadre {
  const totalDeudor = sumarPor(cuentas, (c) => c.saldoDeudor)
  const totalAcreedor = sumarPor(cuentas, (c) => c.saldoAcreedor)
  return {
    totalDeudor,
    totalAcreedor,
    diferencia: restar(totalDeudor, totalAcreedor),
    cuadrado: comparaImportes(totalDeudor, totalAcreedor),
  }
}
