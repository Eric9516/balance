import { parseImporte } from '@/lib/utils/parseImporte'
import { formatCurrency } from '@/lib/utils/currency'
import type { AppError } from '@/modules/errores/types'
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

/** Total debe = total haber, exactos: un centavo de diferencia ya no cuadra (ver @/lib/importe). */
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

// ─── Cambios de cuentas y el cuadre ──────────────────────────────────────────

/**
 * Qué le hace un cambio de cuentas al cuadre del balance de sumas y saldos, con la diferencia
 * debe − haber de antes y de después. Jamás se tolera nada: un centavo también descuadra.
 */
export type EfectoEnCuadre = {
  /** Debe − haber hoy. 0 = cuadra. */
  antes: number
  /** Debe − haber si se guarda el cambio. */
  despues: number
  /** Cuadraba y deja de cuadrar, o la diferencia crece: se pregunta antes de guardar. */
  descuadra: boolean
  /** No cuadraba y con el cambio cuadra. */
  arregla: boolean
}

export function efectoEnCuadre(antes: number, despues: number): EfectoEnCuadre {
  return {
    antes,
    despues,
    descuadra: despues !== 0 && Math.abs(despues) > Math.abs(antes),
    arregla: antes !== 0 && despues === 0,
  }
}

type CuentaDelCuadre = { id: string; saldoDeudor: number; saldoAcreedor: number }

export type CambioDeCuenta =
  | { tipo: 'EDITAR'; cuentaId: string; saldoDeudor: number; saldoAcreedor: number }
  | { tipo: 'BORRAR'; cuentaId: string }

/** El efecto de editar o borrar una cuenta, calculado con todas las cuentas del ejercicio. */
export function efectoDeCambio(cuentas: CuentaDelCuadre[], cambio: CambioDeCuenta): EfectoEnCuadre {
  const despues =
    cambio.tipo === 'BORRAR'
      ? cuentas.filter((c) => c.id !== cambio.cuentaId)
      : cuentas.map((c) =>
          c.id === cambio.cuentaId
            ? { ...c, saldoDeudor: cambio.saldoDeudor, saldoAcreedor: cambio.saldoAcreedor }
            : c,
        )
  return efectoEnCuadre(validarCuadre(cuentas).diferencia, validarCuadre(despues).diferencia)
}

const pesos = (n: number) => formatCurrency(n, { decimales: 'todos' })

/** "el debe supera al haber por 1.234,567": la diferencia completa, sin redondear. */
export function describirDiferencia(diferencia: number): string {
  if (diferencia === 0) return 'el debe y el haber son iguales'
  return diferencia > 0
    ? `el debe supera al haber por ${pesos(diferencia)}`
    : `el haber supera al debe por ${pesos(-diferencia)}`
}

/**
 * NEG-069: el servidor no guarda un cambio que descuadra el balance sin que alguien lo confirme en
 * el cartel. Lleva el efecto en el contexto para que la pantalla muestre el cartel con lo que
 * calculó el servidor (la pantalla pudo haber quedado vieja).
 */
export function errorDescuadre(efecto: EfectoEnCuadre): AppError {
  const hoy =
    efecto.antes === 0
      ? 'hoy el debe y el haber son iguales'
      : `hoy ${describirDiferencia(efecto.antes)}`
  return {
    tipo: 'NEGOCIO',
    severidad: 'ALTO',
    codigo: 'NEG-069',
    mensaje: `Este cambio descuadra el balance de sumas y saldos: ${hoy} y, con el cambio, ${describirDiferencia(efecto.despues)}. No se guardó. Si es lo que querés, confirmalo en el cartel.`,
    contexto: { antes: efecto.antes, despues: efecto.despues },
  }
}
