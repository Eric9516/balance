import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn con las utilidades del sistema visual', () => {
  it('conserva el tamaño de tabla junto a un color de texto', () => {
    const a = cn('text-tabla-sm text-slate-600').split(' ')
    expect(a).toEqual(expect.arrayContaining(['text-tabla-sm', 'text-slate-600']))
    const b = cn('text-right text-tabla text-slate-800').split(' ')
    expect(b).toEqual(expect.arrayContaining(['text-tabla', 'text-right', 'text-slate-800']))
  })
  it('un tamaño posterior reemplaza al de tabla', () => {
    expect(cn('text-tabla', 'text-xs')).toBe('text-xs')
  })
  it('los colores semánticos se resuelven como colores', () => {
    expect(cn('text-slate-500', 'text-tinta')).toBe('text-tinta')
    expect(cn('bg-white', 'bg-superficie')).toBe('bg-superficie')
    expect(cn('border-slate-200', 'border-linea')).toBe('border-linea')
  })
})
