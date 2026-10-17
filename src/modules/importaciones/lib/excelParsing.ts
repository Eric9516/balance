import * as XLSX from 'xlsx'
import { importeEditable, parseImporte } from '@/lib/utils/parseImporte'

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

/**
 * Lee las filas de la PRIMERA hoja de un libro Excel. Única lectura de Excel de la app
 * (cliente y servidor). `raw: true` devuelve números como number; `false`, como texto visible.
 */
export function leerFilasPrimeraHoja<T = unknown>(
  data: ArrayBuffer | Uint8Array,
  raw: boolean,
): { nombreHoja: string; filas: T[][] } {
  const wb = XLSX.read(data, { type: 'array', raw })
  const nombreHoja = wb.SheetNames[0]
  const hoja = nombreHoja ? wb.Sheets[nombreHoja] : undefined
  if (!nombreHoja || !hoja) throw new Error('El archivo Excel no contiene ninguna hoja.')
  const filas = XLSX.utils.sheet_to_json<T[]>(hoja, { header: 1, raw, defval: '' })
  return { nombreHoja, filas }
}

export async function parsePreview(file: File, filasOmitir: number): Promise<PreviewData> {
  const { nombreHoja, filas } = leerFilasPrimeraHoja<string>(await file.arrayBuffer(), false)
  if (filas.length === 0) throw new Error('El archivo está vacío')

  const headerRow = filas[Math.max(0, filasOmitir - 1)] ?? []
  const numCols = Math.max(...filas.slice(0, filasOmitir + 3).map((r) => r.length))

  const columns: ColumnInfo[] = Array.from({ length: numCols }, (_, i) => ({
    index: i,
    letter: colLetter(i),
    sample: String(headerRow[i] ?? '').trim() || colLetter(i),
  }))

  return {
    columns,
    rows: filas.slice(filasOmitir, filasOmitir + 6),
    totalRows: Math.max(0, filas.length - filasOmitir),
    sheetName: nombreHoja,
  }
}

export async function parseAllRows(
  file: File,
  filasOmitir: number,
  colCodigo: number,
  colNombre: number,
  colDeudor: number,
  colAcreedor: number,
): Promise<EditableRow[]> {
  const { filas } = leerFilasPrimeraHoja(await file.arrayBuffer(), true)
  const result: EditableRow[] = []

  for (const r of filas.slice(filasOmitir)) {
    const codigo = String(r[colCodigo] ?? '').trim()
    const nombre = String(r[colNombre] ?? '').trim()
    if (!codigo && !nombre) continue

    result.push({
      _key: String(result.length),
      codigo: codigo || '?',
      nombre: nombre || '?',
      saldoDeudor: importeEditable(parseImporte(r[colDeudor])),
      saldoAcreedor: importeEditable(parseImporte(r[colAcreedor])),
    })
  }

  return result
}
