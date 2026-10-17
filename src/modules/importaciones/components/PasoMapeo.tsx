import type { RefObject, ChangeEvent } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import type { PreviewData } from '../lib/excelParsing'

export function PasoMapeo({
  denominacion,
  tieneCuentas,
  fileRef,
  archivo,
  preview,
  parseError,
  loadingPreview,
  loadingRevision,
  filasOmitir,
  columnaCodigo,
  columnaNombre,
  columnaDeudor,
  columnaAcreedor,
  canVerDatos,
  onFileChange,
  onFilasChange,
  onColumnaCodigoChange,
  onColumnaNombreChange,
  onColumnaDeudorChange,
  onColumnaAcreedorChange,
  onCancelar,
  onVerDatos,
}: {
  denominacion: string
  tieneCuentas: boolean
  fileRef: RefObject<HTMLInputElement | null>
  archivo: File | null
  preview: PreviewData | null
  parseError: string | null
  loadingPreview: boolean
  loadingRevision: boolean
  filasOmitir: number
  columnaCodigo: string
  columnaNombre: string
  columnaDeudor: string
  columnaAcreedor: string
  canVerDatos: boolean
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFilasChange: (n: number) => void
  onColumnaCodigoChange: (v: string) => void
  onColumnaNombreChange: (v: string) => void
  onColumnaDeudorChange: (v: string) => void
  onColumnaAcreedorChange: (v: string) => void
  onCancelar: () => void
  onVerDatos: () => void
}) {
  return (
    <Card className="max-w-3xl w-full">
      <CardHeader>
        <CardTitle>Importar balance de sumas y saldos</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          {denominacion} — Subí el archivo Excel exportado desde tu sistema contable.
        </p>
        {tieneCuentas && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 mt-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Este ejercicio ya tiene cuentas importadas. Al importar nuevamente se reemplazarán
              todas las cuentas actuales y se perderá la clasificación existente.
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">

        {/* Paso 1: Archivo */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            1. Seleccionar archivo
          </p>
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {archivo ? (
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{archivo.name}</p>
                  <p className="text-xs text-slate-500">
                    {(archivo.size / 1024).toFixed(0)} KB
                    {preview && ` · ${preview.totalRows} filas de datos · hoja: ${preview.sheetName}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Hacé clic para seleccionar el archivo</p>
                <p className="text-xs text-slate-400 mt-1">.xlsx · .xls · .csv</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
          {parseError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {parseError}
            </p>
          )}
        </div>

        {/* Paso 2: Filas a omitir */}
        {archivo && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              2. Filas de encabezado
            </p>
            <div className="flex items-center gap-4">
              <div className="space-y-1.5 w-40">
                <Label htmlFor="filasOmitir">Filas a omitir</Label>
                <Input
                  id="filasOmitir"
                  type="number"
                  min="0"
                  max="20"
                  value={filasOmitir}
                  onChange={(e) => onFilasChange(parseInt(e.target.value) || 0)}
                />
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Cuántas filas del inicio ignorar antes de que comiencen los datos
                <br />
                (encabezados, títulos, etc.)
              </p>
            </div>
          </div>
        )}

        {/* Vista previa */}
        {loadingPreview && <p className="text-xs text-slate-500">Procesando archivo...</p>}

        {preview && !loadingPreview && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vista previa (primeras filas de datos)
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {preview.columns.map((col) => (
                      <th key={col.index} className="px-3 py-2 text-left font-mono whitespace-nowrap">
                        {col.letter}
                        {col.sample !== col.letter && (
                          <span className="ml-1 text-slate-400 font-normal truncate max-w-[80px] inline-block align-bottom">
                            {col.sample}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {preview.columns.map((col) => (
                        <td key={col.index} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                          {row[col.index] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paso 3: Mapeo de columnas */}
        {preview && !loadingPreview && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              3. Mapear columnas
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'colCodigo', label: 'Código de cuenta', value: columnaCodigo, set: onColumnaCodigoChange },
                { id: 'colNombre', label: 'Nombre / descripción', value: columnaNombre, set: onColumnaNombreChange },
                { id: 'colDeudor', label: 'Saldo debe (deudor)', value: columnaDeudor, set: onColumnaDeudorChange },
                { id: 'colAcreedor', label: 'Saldo haber (acreedor)', value: columnaAcreedor, set: onColumnaAcreedorChange },
              ].map(({ id, label, value, set }) => (
                <div key={id} className="space-y-1.5">
                  <Label htmlFor={id}>{label}</Label>
                  <Select
                    id={id}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    error={!value}
                  >
                    <option value="">— Seleccionar columna —</option>
                    {preview.columns.map((col) => (
                      <option key={col.index} value={String(col.index)}>
                        {col.letter}{col.sample !== col.letter ? ` — ${col.sample}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            {canVerDatos && (
              <p className="text-xs text-slate-500">
                Se cargarán{' '}
                <span className="font-semibold text-slate-700">{preview.totalRows}</span> filas
                desde la hoja <span className="font-mono">{preview.sheetName}</span> para revisión.
              </p>
            )}
          </div>
        )}

      </CardContent>

      <CardFooter className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancelar}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!canVerDatos || loadingRevision}
          onClick={onVerDatos}
        >
          {loadingRevision
            ? 'Cargando datos...'
            : preview
              ? `Ver y editar datos (${preview.totalRows} filas)`
              : 'Ver y editar datos'}
        </Button>
      </CardFooter>
    </Card>
  )
}
