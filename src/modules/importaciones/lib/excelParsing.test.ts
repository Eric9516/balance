import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { colLetter, leerFilasPrimeraHoja, parseAllRows, parsePreview } from './excelParsing'

/**
 * Lectura real de Excel con SheetJS: arma un libro en memoria y lo lee con las mismas
 * funciones que usa la importación. Cubre el cambio de versión de la librería (vendor/).
 */
function libro(filas: unknown[][], nombreHoja = 'Balance'): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombreHoja)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

function archivo(datos: ArrayBuffer): File {
  return new File([datos], 'balance.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

const BALANCE = [
  ['Código', 'Cuenta', 'Debe', 'Haber'],
  ['1.1.01', 'Caja', 1234.56, 0],
  ['2.1.01', 'Proveedores', '', '1.500,25'],
  ['', '', '', ''],
  ['5.1.01', 'Ventas', '', '(300)'],
]

describe('colLetter', () => {
  it('convierte índices a letras de columna de Excel', () => {
    expect(colLetter(0)).toBe('A')
    expect(colLetter(25)).toBe('Z')
    expect(colLetter(26)).toBe('AA')
    expect(colLetter(701)).toBe('ZZ')
  })
})

describe('leerFilasPrimeraHoja', () => {
  it('con raw devuelve los números como number', () => {
    const { nombreHoja, filas } = leerFilasPrimeraHoja(libro(BALANCE), true)
    expect(nombreHoja).toBe('Balance')
    expect(filas[1]).toEqual(['1.1.01', 'Caja', 1234.56, 0])
  })

  it('sin raw devuelve el texto visible', () => {
    const { filas } = leerFilasPrimeraHoja<string>(libro(BALANCE), false)
    expect(filas[1]?.[2]).toBe('1234.56')
    expect(filas[2]?.[3]).toBe('1.500,25')
  })

  it('lee solo la primera hoja', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['primera']]), 'Uno')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['segunda']]), 'Dos')
    const datos = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
    const { nombreHoja, filas } = leerFilasPrimeraHoja(datos, true)
    expect(nombreHoja).toBe('Uno')
    expect(filas).toEqual([['primera']])
  })
})

describe('parsePreview', () => {
  it('arma columnas con el encabezado y cuenta las filas de datos', async () => {
    const preview = await parsePreview(archivo(libro(BALANCE)), 1)
    expect(preview.sheetName).toBe('Balance')
    expect(preview.columns.map((c) => [c.letter, c.sample])).toEqual([
      ['A', 'Código'],
      ['B', 'Cuenta'],
      ['C', 'Debe'],
      ['D', 'Haber'],
    ])
    expect(preview.totalRows).toBe(4)
    expect(preview.rows[0]?.[1]).toBe('Caja')
  })

  it('rechaza una hoja vacía con un mensaje claro', async () => {
    await expect(parsePreview(archivo(libro([])), 0)).rejects.toThrow('El archivo está vacío')
  })
})

describe('parseAllRows', () => {
  it('lee cuentas e importes en formato argentino, con paréntesis negativos, y saltea filas vacías', async () => {
    const filas = await parseAllRows(archivo(libro(BALANCE)), 1, 0, 1, 2, 3)
    expect(filas).toEqual([
      { _key: '0', codigo: '1.1.01', nombre: 'Caja', saldoDeudor: '1234,56', saldoAcreedor: '' },
      {
        _key: '1',
        codigo: '2.1.01',
        nombre: 'Proveedores',
        saldoDeudor: '',
        saldoAcreedor: '1500,25',
      },
      { _key: '2', codigo: '5.1.01', nombre: 'Ventas', saldoDeudor: '', saldoAcreedor: '-300' },
    ])
  })
})
