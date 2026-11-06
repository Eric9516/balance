/**
 * Servicio: lo que la propuesta del flujo necesita del balance (ver domain/propuesta). Se arma
 * cuando el contador abre "Proponer desde el balance", no al abrir el paso: así el paso Estados no
 * suma consultas.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import { sumar, sumarPor } from '@/lib/importe'
import {
  CODIGOS_PRESTAMOS,
  motivoExclusion,
  type InsumosPropuesta,
  type RubroVariacion,
} from '../domain/propuesta'

const LADO: Record<string, RubroVariacion['lado']> = {
  ACTIVO_CORRIENTE: 'ACTIVO',
  PASIVO_CORRIENTE: 'PASIVO',
}

export async function cargarInsumosPropuesta(
  ejercicio: EjercicioContableDTO,
): Promise<InsumosPropuesta> {
  const cuentas = await findCuentasByEjercicio(ejercicio.id)
  const [{ estadosData, pnData }, gastos, costo, bienes, rubrosBase] = await Promise.all([
    cargarEstadosConPN(ejercicio, cuentas),
    cargarGastos(ejercicio),
    findCostoVentas(ejercicio.id),
    findBienesDeUso(ejercicio.id),
    findRubrosBase(ejercicio.estudioId),
  ])
  const efectivo = new Set(rubrosBase.filter((r) => r.esEfectivo).map((r) => r.id))

  const rubros: RubroVariacion[] = estadosData.sspRubros.flatMap((r) => {
    const lado = r.seccionSSP ? LADO[r.seccionSSP] : undefined
    if (!lado) return []
    return [
      {
        id: r.id,
        nombre: r.nombre,
        lado,
        actual: r.displayValue,
        anterior: r.displayValueAnt,
        motivoExcluido: motivoExclusion(r.codigo, efectivo.has(r.id)),
      },
    ]
  })
  const prestamos = estadosData.sspRubros.filter((r) => CODIGOS_PRESTAMOS.includes(r.codigo))
  const saldoInicio = pnData.movimientos.find((m) => m.tipo === 'SALDO_INICIO')

  return {
    ingresos: estadosData.eerr.ingresos,
    compras: costo ? costo.compras : null,
    gastos: gastos.secciones.flatMap((s) =>
      s.filas.map((f) => ({
        cuentaId: f.cuentaId,
        nombre: f.cuentaNombre,
        seccion: s.grupoNombre,
        importe: f.importe,
      })),
    ),
    rubros,
    bienesDeUso:
      bienes.length > 0
        ? { altas: sumarPor(bienes, (b) => b.altas), bajas: sumarPor(bienes, (b) => b.bajas) }
        : null,
    // Solo en el primer ejercicio de la sociedad el capital del saldo al inicio entró en el año.
    aportes:
      ejercicio.numeroEjercicio === 1 && saldoInicio
        ? sumar(saldoInicio.capitalSuscripto, saldoInicio.aportesIrrevocables)
        : null,
    referencias: {
      prestamos: {
        actual: sumarPor(prestamos, (r) => r.displayValue),
        anterior: sumarPor(prestamos, (r) => r.displayValueAnt),
      },
      impuestoGanancias: estadosData.eerr.impuestoGanancias,
    },
  }
}
