import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agregarCuentas } from './cuentas.repository'

const tx = vi.hoisted(() => ({
  cuentaContable: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  ejercicioContable: { update: vi.fn() },
}))
vi.mock('@/lib/db', () => ({
  db: { $transaction: async (fn: (cliente: typeof tx) => unknown) => fn(tx) },
}))

const cuenta = {
  codigo: 'NUEVA',
  nombre: 'Caja',
  saldoDeudor: 100,
  saldoAcreedor: 0,
  saldoFinal: 100,
}

describe('Agregar cuentas conservando las existentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.cuentaContable.findMany.mockResolvedValue([])
    tx.cuentaContable.createMany.mockResolvedValue({ count: 1 })
    tx.ejercicioContable.update.mockResolvedValue({})
  })

  it('solo inserta las cuentas nuevas y revoca la confirmación en la transacción', async () => {
    await expect(agregarCuentas('ejercicio', 'importacion', [cuenta])).resolves.toBe(1)
    expect(tx.cuentaContable.createMany).toHaveBeenCalledWith({
      data: [{ ...cuenta, ejercicioId: 'ejercicio', importacionExcelId: 'importacion' }],
    })
    expect(tx.cuentaContable.deleteMany).not.toHaveBeenCalled()
    expect(tx.cuentaContable.updateMany).not.toHaveBeenCalled()
    expect(tx.ejercicioContable.update).toHaveBeenCalledWith({
      where: { id: 'ejercicio' },
      data: { estadosConfirmado: false },
    })
  })

  it('rechaza un código existente en ese ejercicio sin escribir nada', async () => {
    tx.cuentaContable.findMany.mockResolvedValue([{ codigo: 'NUEVA' }])
    await expect(agregarCuentas('ejercicio', 'importacion', [cuenta])).rejects.toMatchObject({
      codigo: 'NEG-012',
    })
    expect(tx.cuentaContable.findMany).toHaveBeenCalledWith({
      where: { ejercicioId: 'ejercicio', codigo: { in: ['NUEVA'] } },
      select: { codigo: true },
    })
    expect(tx.cuentaContable.createMany).not.toHaveBeenCalled()
    expect(tx.ejercicioContable.update).not.toHaveBeenCalled()
  })

  it('no ignora un conflicto concurrente ni confirma un lote parcial', async () => {
    tx.cuentaContable.createMany.mockRejectedValue({ code: 'P2002' })
    await expect(agregarCuentas('ejercicio', 'importacion', [cuenta])).rejects.toMatchObject({
      code: 'P2002',
    })
    expect(tx.ejercicioContable.update).not.toHaveBeenCalled()
  })
})
