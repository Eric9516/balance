/**
 * Ejercicio anterior VINCULADO: la columna "Ejercicio anterior" de las notas con detalle sale de las
 * cuentas del ejercicio anterior (ya reexpresadas con el coeficiente, como en el estado), no se
 * carga a mano. Puro.
 *
 * Cada fila toma el saldo de las cuentas del anterior con el mismo nombre dentro del rubro de la
 * nota (mismo criterio que la generación: concepto = nombre de la cuenta, importe sin signo). Las
 * cuentas del anterior que ya no están en la nota se agregan como filas "solo anterior": no están en
 * la base y no se editan.
 */

import { sumar } from '@/lib/importe'
import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import { claveConcepto, notaPorRubro, type DetalleNotaDTO, type NotaDTO } from './types'

const PREFIJO_SOLO_ANTERIOR = 'anterior:'

/** ¿Es una fila que solo existe en el ejercicio anterior? (no está en la base) */
export function esFilaSoloAnterior(d: Pick<DetalleNotaDTO, 'id'>): boolean {
  return d.id.startsWith(PREFIJO_SOLO_ANTERIOR)
}

export function derivarAnteriorDeNotas(
  notas: NotaDTO[],
  cuentas: CuentaContableDTO[],
  cuentasAnt: CuentaContableDTO[],
): NotaDTO[] {
  const rubroDeNota = new Map([...notaPorRubro(cuentas, notas)].map(([rubro, n]) => [n.id, rubro]))
  const antPorRubro = new Map<string, CuentaContableDTO[]>()
  for (const c of cuentasAnt) {
    if (!c.rubroBaseId) continue
    const lista = antPorRubro.get(c.rubroBaseId) ?? []
    lista.push(c)
    antPorRubro.set(c.rubroBaseId, lista)
  }

  return notas.map((nota) => {
    if (nota.tipo !== 'CUANTITATIVA') return nota
    const rubroId = rubroDeNota.get(nota.id)
    const anteriores = (rubroId ? antPorRubro.get(rubroId) : undefined) ?? []

    // Saldo anterior por nombre de cuenta (sumado si se repite), en el orden de los códigos.
    const porConcepto = new Map<string, { concepto: string; importe: number; id: string }>()
    for (const c of [...anteriores].sort((a, b) => a.codigo.localeCompare(b.codigo))) {
      const clave = claveConcepto(c.nombre)
      const previo = porConcepto.get(clave)
      porConcepto.set(clave, {
        concepto: previo?.concepto ?? c.nombre,
        importe: sumar(previo?.importe, Math.abs(c.saldoFinal)),
        id: previo?.id ?? c.id,
      })
    }

    const usados = new Set<string>()
    const filas = nota.detalles.map((d) => {
      if (d.esTotal) return d
      const clave = claveConcepto(d.concepto)
      usados.add(clave)
      return { ...d, importeAnterior: porConcepto.get(clave)?.importe ?? 0 }
    })
    const maxOrden = Math.max(0, ...nota.detalles.map((d) => d.orden))
    const soloAnterior: DetalleNotaDTO[] = [...porConcepto]
      .filter(([clave]) => !usados.has(clave))
      .map(([, c], i) => ({
        id: `${PREFIJO_SOLO_ANTERIOR}${c.id}`,
        notaEjercicioId: nota.id,
        orden: maxOrden + i + 1,
        concepto: c.concepto,
        importeActual: 0,
        importeAnterior: c.importe,
        esTotal: false,
      }))
    return { ...nota, detalles: [...filas, ...soloAnterior] }
  })
}
