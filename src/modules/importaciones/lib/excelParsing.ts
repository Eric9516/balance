import * as XLSX from 'xlsx'
import { parseImporte } from '@/lib/utils/parseImporte'

export type ColumnInfo = { index: number; letter: string; sample: string }
export type PreviewData = {
  columns: ColumnInfo[]
  rows: string[][]
  totalRows: number
  sheetName: string
}

export type EditableRow = {
  _key: string
  codigo: string
  nombre: string
  saldoDeudor: string
  saldoAcreedor: string
}

export function colLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

export function parsePreview(file: File, filasOmitir: number): Promise<PreviewData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', raw: false })
        const sheetName = wb.SheetNames[0]
        const allRows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
          header: 1, raw: false, defval: '',
        }) as string[][]

        if (allRows.length === 0) { reject(new Error('El archivo está vacío')); return }

        const headerRow = allRows[Math.max(0, filasOmitir - 1)] ?? []
        const dataRows = allRows.slice(filasOmitir, filasOmitir + 6)
        const totalRows = allRows.slice(filasOmitir).length
        const numCols = Math.max(...allRows.slice(0, filasOmitir + 3).map((r) => r.length))

        const columns: ColumnInfo[] = Array.from({ length: numCols }, (_, i) => ({
          index: i,
          letter: colLetter(i),
          sample: String(headerRow[i] ?? '').trim() || colLetter(i),
        }))

        resolve({ columns, rows: dataRows, totalRows, sheetName })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

export function parseAllRows(
  file: File,
  filasOmitir: number,
  colCodigo: number,
  colNombre: number,
  colDeudor: number,
  colAcreedor: number,
): Promise<EditableRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', raw: true })
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          header: 1, raw: true, defval: '',
        }) as unknown[][]

        const result: EditableRow[] = []
        let keyIdx = 0

        for (const row of allRows.slice(filasOmitir)) {
          const r = row as unknown[]
          const codigo = String(r[colCodigo] ?? '').trim()
          const nombre = String(r[colNombre] ?? '').trim()
          if (!codigo && !nombre) continue

          result.push({
            _key: String(keyIdx++),
            codigo: codigo || '?',
            nombre: nombre || '?',
            saldoDeudor: String(parseImporte(r[colDeudor])),
            saldoAcreedor: String(parseImporte(r[colAcreedor])),
          })
        }

        resolve(result)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
