'use client'

import { useState, useTransition, useRef, useMemo, useCallback, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { confirmarImportacionEditada } from '../actions/importacion.actions'
import { parsePreview, parseAllRows, type PreviewData, type EditableRow } from '../lib/excelParsing'
import { importesDeFila, validarCuadre } from '../domain/importacion'
import { PasoMapeo } from './PasoMapeo'
import { PasoRevision } from './PasoRevision'

// ─── Componente principal ─────────────────────────────────────────────────────

interface ImportarExcelFormProps {
  ejercicioId: string
  sociedadId: string
  denominacion: string
  tieneCuentas: boolean
}

export function ImportarExcelForm({
  ejercicioId,
  sociedadId,
  denominacion,
  tieneCuentas,
}: ImportarExcelFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Paso 1: mapeo ──────────────────────────────────────────────────────────
  const [archivo, setArchivo] = useState<File | null>(null)
  const [filasOmitir, setFilasOmitir] = useState(1)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [columnaCodigo, setColumnaCodigo] = useState('')
  const [columnaNombre, setColumnaNombre] = useState('')
  const [columnaDeudor, setColumnaDeudor] = useState('')
  const [columnaAcreedor, setColumnaAcreedor] = useState('')

  // ── Paso 2: revisión ───────────────────────────────────────────────────────
  const [paso, setPaso] = useState<'mapeo' | 'revision'>('mapeo')
  const [filasEditadas, setFilasEditadas] = useState<EditableRow[]>([])
  const [filasDescartadas, setFilasDescartadas] = useState<EditableRow[]>([])
  const [seleccionDescartadas, setSeleccionDescartadas] = useState<Set<string>>(new Set())
  const [mostrarDescartadas, setMostrarDescartadas] = useState(false)
  const [loadingRevision, setLoadingRevision] = useState(false)

  // ── Derivados para revisión ────────────────────────────────────────────────
  // Mismo cálculo de cuadre que valida el servidor (Decimal, tolerancia de centavos).
  const { totalDeudor, totalAcreedor, cuadrado } = useMemo(
    () => validarCuadre(filasEditadas.map(importesDeFila)),
    [filasEditadas],
  )

  // ── Handlers mapeo ─────────────────────────────────────────────────────────

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setArchivo(f)
    setPreview(null)
    setParseError(null)
    setColumnaCodigo('')
    setColumnaNombre('')
    setColumnaDeudor('')
    setColumnaAcreedor('')

    if (!f) return
    setLoadingPreview(true)
    try {
      const p = await parsePreview(f, filasOmitir)
      setPreview(p)
      if (p.columns.length >= 4) {
        setColumnaCodigo('0')
        setColumnaNombre('1')
        setColumnaDeudor('2')
        setColumnaAcreedor('3')
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleFilasChange(val: number) {
    const n = Math.max(0, val)
    setFilasOmitir(n)
    if (archivo) {
      setLoadingPreview(true)
      setParseError(null)
      try {
        const p = await parsePreview(archivo, n)
        setPreview(p)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Error al procesar el archivo')
      } finally {
        setLoadingPreview(false)
      }
    }
  }

  async function handleVerDatos() {
    if (!archivo || !columnaCodigo || !columnaNombre || !columnaDeudor || !columnaAcreedor) return
    setLoadingRevision(true)
    setParseError(null)
    try {
      const filas = await parseAllRows(
        archivo,
        filasOmitir,
        parseInt(columnaCodigo),
        parseInt(columnaNombre),
        parseInt(columnaDeudor),
        parseInt(columnaAcreedor),
      )
      if (filas.length === 0) {
        setParseError(
          'No se encontraron filas con datos. Verificá el mapeo y las filas de encabezado.',
        )
        return
      }
      // Cuentas con saldo 0 se proponen como descartadas (el usuario puede recuperarlas).
      const activas: EditableRow[] = []
      const descartadas: EditableRow[] = []
      for (const f of filas) (importesDeFila(f).saldoFinal !== 0 ? activas : descartadas).push(f)
      setFilasEditadas(activas)
      setFilasDescartadas(descartadas)
      setSeleccionDescartadas(new Set())
      setMostrarDescartadas(false)
      setPaso('revision')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoadingRevision(false)
    }
  }

  // ── Handlers revisión ──────────────────────────────────────────────────────

  const handleUpdate = useCallback(
    (key: string, field: keyof Omit<EditableRow, '_key'>, value: string) => {
      setFilasEditadas((rows) => rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
    },
    [],
  )

  const handleDelete = useCallback((key: string) => {
    setFilasEditadas((rows) => rows.filter((r) => r._key !== key))
  }, [])

  function handleIncluirDescartadas() {
    const aIncluir = filasDescartadas.filter((f) => seleccionDescartadas.has(f._key))
    setFilasEditadas((prev) => [...prev, ...aIncluir])
    setFilasDescartadas((prev) => prev.filter((f) => !seleccionDescartadas.has(f._key)))
    setSeleccionDescartadas(new Set())
  }

  function toggleSeleccionDescartada(key: string) {
    setSeleccionDescartadas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleTodasDescartadas() {
    if (seleccionDescartadas.size === filasDescartadas.length) {
      setSeleccionDescartadas(new Set())
    } else {
      setSeleccionDescartadas(new Set(filasDescartadas.map((f) => f._key)))
    }
  }

  function handleAgregarFila() {
    const newKey = `new-${Date.now()}`
    setFilasEditadas((rows) => [
      ...rows,
      { _key: newKey, codigo: '', nombre: '', saldoDeudor: '0', saldoAcreedor: '0' },
    ])
  }

  function handleConfirmar() {
    if (!archivo || filasEditadas.length === 0) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append(
        'rowsJson',
        JSON.stringify(
          filasEditadas.map(({ codigo, nombre, saldoDeudor, saldoAcreedor }) => ({
            codigo,
            nombre,
            saldoDeudor,
            saldoAcreedor,
          })),
        ),
      )

      const result = await confirmarImportacionEditada(ejercicioId, sociedadId, fd)

      if (!result.ok) {
        toastError(result.error)
        return
      }

      const { importadas, errores } = result.data
      toastSuccess(
        errores > 0
          ? `${importadas} cuentas importadas (${errores} filas inválidas omitidas)`
          : `${importadas} cuentas importadas correctamente`,
      )
      router.push(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    })
  }

  const canVerDatos =
    !!archivo &&
    !!preview &&
    !!columnaCodigo &&
    !!columnaNombre &&
    !!columnaDeudor &&
    !!columnaAcreedor

  if (paso === 'revision') {
    return (
      <PasoRevision
        denominacion={denominacion}
        filasEditadas={filasEditadas}
        filasDescartadas={filasDescartadas}
        seleccionDescartadas={seleccionDescartadas}
        mostrarDescartadas={mostrarDescartadas}
        totalDeudor={totalDeudor}
        totalAcreedor={totalAcreedor}
        cuadrado={cuadrado}
        isPending={isPending}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onIncluirDescartadas={handleIncluirDescartadas}
        onToggleSeleccionDescartada={toggleSeleccionDescartada}
        onToggleTodasDescartadas={toggleTodasDescartadas}
        onToggleMostrarDescartadas={() => setMostrarDescartadas((v) => !v)}
        onAgregarFila={handleAgregarFila}
        onVolverMapeo={() => setPaso('mapeo')}
        onConfirmar={handleConfirmar}
      />
    )
  }

  return (
    <PasoMapeo
      denominacion={denominacion}
      tieneCuentas={tieneCuentas}
      fileRef={fileRef}
      archivo={archivo}
      preview={preview}
      parseError={parseError}
      loadingPreview={loadingPreview}
      loadingRevision={loadingRevision}
      filasOmitir={filasOmitir}
      columnaCodigo={columnaCodigo}
      columnaNombre={columnaNombre}
      columnaDeudor={columnaDeudor}
      columnaAcreedor={columnaAcreedor}
      canVerDatos={canVerDatos}
      onFileChange={handleFileChange}
      onFilasChange={handleFilasChange}
      onColumnaCodigoChange={setColumnaCodigo}
      onColumnaNombreChange={setColumnaNombre}
      onColumnaDeudorChange={setColumnaDeudor}
      onColumnaAcreedorChange={setColumnaAcreedor}
      onCancelar={() => router.push(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)}
      onVerDatos={handleVerDatos}
    />
  )
}
