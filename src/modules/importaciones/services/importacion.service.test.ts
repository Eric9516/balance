import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarImportacion } from './importacion.service'
import {
  agregarCuentas,
  countCuentasByEjercicio,
  replaceCuentas,
} from '../repository/cuentas.repository'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'

vi.mock('../repository/cuentas.repository', () => ({
  agregarCuentas: vi.fn(),
  countCuentasByEjercicio: vi.fn(),
  replaceCuentas: vi.fn(),
}))
vi.mock('../repository/importacion.repository', () => ({
  createImportacion: vi.fn(async () => ({ id: 'importacion' })),
  updateImportacion: vi.fn(),
}))
vi.mock('@/modules/ejercicios/repository/ejercicio.repository', () => ({
  resetEstadosConfirmado: vi.fn(),
}))

const params = {
  ejercicioId: 'ejercicio',
  nombreArchivo: 'Carga manual',
  hashArchivo: 'hash',
  mapeoSnapshot: { tipo: 'manual' },
  filas: [{ codigo: 'NUEVA', nombre: 'Caja', saldoDeudor: '100', saldoAcreedor: '0' }],
}

describe('Carga manual adicional', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(countCuentasByEjercicio).mockResolvedValue(2)
    vi.mocked(agregarCuentas).mockResolvedValue(1)
  })

  it('agrega una cuenta sin contrapartida sin reemplazar las existentes', async () => {
    const resultado = await registrarImportacion({ ...params, modo: 'AGREGAR' })
    expect(resultado.ok).toBe(true)
    expect(agregarCuentas).toHaveBeenCalledWith('ejercicio', 'importacion', [
      { codigo: 'NUEVA', nombre: 'Caja', saldoDeudor: 100, saldoAcreedor: 0, saldoFinal: 100 },
    ])
    expect(replaceCuentas).not.toHaveBeenCalled()
    // La revocación de la confirmación es atómica dentro de agregarCuentas.
    expect(resetEstadosConfirmado).not.toHaveBeenCalled()
  })

  it('mantiene el cuadre obligatorio en la primera carga', async () => {
    vi.mocked(countCuentasByEjercicio).mockResolvedValue(0)
    const resultado = await registrarImportacion({ ...params, modo: 'AGREGAR' })
    expect(resultado).toMatchObject({ ok: false, error: { codigo: 'NEG-011' } })
    expect(agregarCuentas).not.toHaveBeenCalled()
    expect(replaceCuentas).not.toHaveBeenCalled()
  })

  it('también inserta sin borrar cuando la primera carga está cuadrada', async () => {
    vi.mocked(countCuentasByEjercicio).mockResolvedValue(0)
    const resultado = await registrarImportacion({
      ...params,
      modo: 'AGREGAR',
      filas: [
        ...params.filas,
        { codigo: 'CAPITAL', nombre: 'Capital', saldoDeudor: '0', saldoAcreedor: '100' },
      ],
    })
    expect(resultado.ok).toBe(true)
    expect(agregarCuentas).toHaveBeenCalledOnce()
    expect(replaceCuentas).not.toHaveBeenCalled()
  })

  it('mantiene el control de cuadre de Excel aunque ya haya cuentas', async () => {
    const resultado = await registrarImportacion(params)
    expect(resultado).toMatchObject({ ok: false, error: { codigo: 'NEG-011' } })
    expect(agregarCuentas).not.toHaveBeenCalled()
    expect(replaceCuentas).not.toHaveBeenCalled()
  })

  it('rechaza códigos repetidos dentro de la carga antes de escribir', async () => {
    const resultado = await registrarImportacion({
      ...params,
      modo: 'AGREGAR',
      filas: [...params.filas, ...params.filas],
    })
    expect(resultado).toMatchObject({ ok: false, error: { codigo: 'NEG-012' } })
    expect(agregarCuentas).not.toHaveBeenCalled()
  })
})
