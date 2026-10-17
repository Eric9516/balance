'use client'

import Link from 'next/link'
import { Upload, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'
import { comparaImportes } from '@/lib/utils/decimal'
import type { CuentaContableDTO } from '../domain/types'

interface CuentasTableProps {
  cuentas: CuentaContableDTO[]
  sociedadId: string
  ejercicioId: string
}

export function CuentasTable({ cuentas, sociedadId, ejercicioId }: CuentasTableProps) {
  const importarHref = `/sociedades/${sociedadId}/ejercicios/${ejercicioId}/importar`
  const manualHref = `/sociedades/${sociedadId}/ejercicios/${ejercicioId}/importar-manual`

  if (cuentas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Upload className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">Sin cuentas importadas</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Importá el balance desde Excel o ingresá las cuentas manualmente.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button asChild>
            <Link href={importarHref}>
              <Upload className="h-4 w-4" />
              Importar Excel
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={manualHref}>
              <Keyboard className="h-4 w-4" />
              Carga manual
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const totalDebe = cuentas.reduce((acc, c) => acc + c.saldoDeudor, 0)
  const totalHaber = cuentas.reduce((acc, c) => acc + c.saldoAcreedor, 0)
  const diferencia = totalDebe - totalHaber
  const cuadra = comparaImportes(totalDebe, totalHaber)

  const clasificadas = cuentas.filter((c) => c.rubroBaseId !== null).length
  const sinClasificar = cuentas.length - clasificadas

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Total cuentas</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{cuentas.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Total debe</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
            {formatCurrency(totalDebe, { decimales: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Total haber</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
            {formatCurrency(totalHaber, { decimales: 2 })}
          </p>
        </div>
        <div
          className={`rounded-lg border px-4 py-3 ${cuadra ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
        >
          <p className={`text-xs ${cuadra ? 'text-emerald-600' : 'text-red-600'}`}>
            {cuadra ? 'Balance cuadrado ✓' : '⚠ No cuadra'}
          </p>
          <p
            className={`mt-0.5 font-mono text-sm font-semibold ${cuadra ? 'text-emerald-800' : 'text-red-800'}`}
          >
            {cuadra ? formatCurrency(0) : formatCurrency(diferencia, { decimales: 2 })}
          </p>
        </div>
      </div>

      {/* Barra de clasificación + botón reimportar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {sinClasificar > 0 ? (
            <span className="font-medium text-amber-600">{sinClasificar} sin clasificar</span>
          ) : (
            <span className="font-medium text-emerald-600">Todas clasificadas ✓</span>
          )}
          {clasificadas > 0 && <span>{clasificadas} clasificadas</span>}
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href={importarHref}>
            <Upload className="mr-1 h-3.5 w-3.5" />
            Re-importar
          </Link>
        </Button>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-28 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Nombre
                </th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Debe
                </th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Haber
                </th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Saldo
                </th>
                <th className="w-40 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Rubro
                </th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{c.codigo}</td>
                  <td className="px-4 py-2.5 text-slate-900">{c.nombre}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                    {c.saldoDeudor > 0 ? (
                      formatCurrency(c.saldoDeudor, { decimales: 2 })
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                    {c.saldoAcreedor > 0 ? (
                      formatCurrency(c.saldoAcreedor, { decimales: 2 })
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    <span className={c.saldoFinal >= 0 ? 'text-slate-800' : 'text-red-600'}>
                      {formatCurrency(c.saldoFinal, { decimales: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {c.rubroNombre ? (
                      <span className="text-xs text-slate-600">{c.rubroNombre}</span>
                    ) : (
                      <Badge variant="borrador">Sin clasificar</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-600" colSpan={2}>
                  TOTAL ({cuentas.length} cuentas)
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-800">
                  {formatCurrency(totalDebe, { decimales: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-800">
                  {formatCurrency(totalHaber, { decimales: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                  <span className={cuadra ? 'text-emerald-700' : 'text-red-600'}>
                    {formatCurrency(diferencia, { decimales: 2 })}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
