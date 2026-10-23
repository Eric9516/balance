import { describe, it, expect } from 'vitest'
import { netoAnteriorManualBDU, type BienDeUsoDTO } from './types'
import { aplicarArrastreBienesDeUso } from './saldosInicio'

const bien = (p: Partial<BienDeUsoDTO>): BienDeUsoDTO => ({
  id: 'b',
  ejercicioId: 'e',
  categoria: 'Rodados',
  orden: 1,
  costoInicioReexpresado: 0,
  costoAjusteInflacion: 0,
  altas: 0,
  bajas: 0,
  costoFinReexpresado: 0,
  depAcumInicio: 0,
  depAjusteInflacion: 0,
  depEjercicio: 0,
  depBajas: 0,
  depAcumFin: 0,
  netoResidualAnteriorManual: null,
  ...p,
})

describe('Anexo I: neto del año anterior en carga manual', () => {
  it('es el valor al comienzo menos la amortización al comienzo, con sus ajustes', () => {
    expect(
      netoAnteriorManualBDU(
        bien({
          costoInicioReexpresado: 6_000_000,
          costoAjusteInflacion: 0.5,
          depAcumInicio: 1_800_000,
          depAjusteInflacion: 0.25,
        }),
      ),
    ).toBe(4_200_000.25)
  })

  it('una categoría nueva del año no tuvo anterior', () => {
    expect(netoAnteriorManualBDU(bien({ altas: 300_000 }))).toBeNull()
  })

  it('lo escrito a mano se respeta y, si no coincide con el comienzo, avisa', () => {
    const b = bien({
      costoInicioReexpresado: 1_000,
      depAcumInicio: 100,
      netoResidualAnteriorManual: 950,
    })
    expect(netoAnteriorManualBDU(b)).toBe(950)
    const r = aplicarArrastreBienesDeUso([b], null, 'MANUAL')
    expect(r.netoAnteriorMap.get('Rodados')).toBe(950)
    expect(r.advertencias[0]).toMatch(/Rodados.*950,00.*900,00/)
  })
})
