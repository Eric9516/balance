'use server'

import crypto from 'crypto'
import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { resetEstadosConfirmado } from '@/modules/ejercicios/repository/ejercicio.repository'
import { MapeoSchema } from '../schemas/importacion.schemas'
import { createImportacion, updateImportacion } from '../repository/importacion.repository'
import { replaceCuentas } from '../repository/cuentas.repository'
import type { ResultadoImportacion } from '../domain/types'

// ─── Tipo de fila editada ─────────────────────────────────────────────────────

type FilaEditada = {
  codigo: string
  nombre: string
  saldoDeudor: string
  saldoAcreedor: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  const original = String(raw ?? '').trim()
  const negativoPorParentesis = /^\(.*\)$/.test(original)
  let s = original.replace(/[$\s()]/g, '')
  if (!s || s === '-' || s === '—') return 0
  // Detectar formato argentino (último separador es coma) vs anglosajón (último es punto)
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return negativoPorParentesis ? -Math.abs(n) : n
}

function validarCuadre(cuentas: { saldoDeudor: number; saldoAcreedor: number }[]) {
  const totalDeudor = cuentas.reduce((acc, c) => acc + c.saldoDeudor, 0)
  const totalAcreedor = cuentas.reduce((acc, c) => acc + c.saldoAcreedor, 0)
  const diferencia = totalDeudor - totalAcreedor
  return { totalDeudor, totalAcreedor, diferencia, cuadrado: Math.abs(diferencia) < 0.01 }
}

function errorBalanceDescuadrado(diferencia: number) {
  return actionError({
    tipo: 'NEGOCIO',
    severidad: 'ALTO',
    codigo: 'NEG-011',
    mensaje: 'El balance no cuadra: el total debe no coincide con el total haber. Revisá los importes antes de confirmar.',
    detalle: `Diferencia: ${diferencia.toFixed(2)}`,
  })
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function importarExcel(
  ejercicioId: string,
  sociedadId: string,
  formData: FormData,
): Promise<ActionResult<ResultadoImportacion>> {
  let importacionId: string | null = null

  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)

    // 1. Leer archivo
    const archivo = formData.get('archivo') as File | null
    if (!archivo || archivo.size === 0) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-002',
        mensaje: 'No se recibió ningún archivo',
      })
    }

    // 2. Validar mapeo
    const mapeoRaw = {
      columnaCodigo: formData.get('columnaCodigo'),
      columnaNombre: formData.get('columnaNombre'),
      columnaDeudor: formData.get('columnaDeudor'),
      columnaAcreedor: formData.get('columnaAcreedor'),
      filasOmitir: formData.get('filasOmitir'),
    }
    const parsed = MapeoSchema.safeParse(mapeoRaw)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Configuración de columnas inválida',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const mapeo = parsed.data

    const colCodigo = parseInt(mapeo.columnaCodigo, 10)
    const colNombre = parseInt(mapeo.columnaNombre, 10)
    const colDeudor = parseInt(mapeo.columnaDeudor, 10)
    const colAcreedor = parseInt(mapeo.columnaAcreedor, 10)
    const filasOmitir = parseInt(mapeo.filasOmitir ?? '1', 10) || 1

    // 3. Parsear el Excel en el servidor
    const arrayBuffer = await archivo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = crypto.createHash('md5').update(buffer).digest('hex')

    const wb = XLSX.read(buffer, { type: 'buffer', raw: true })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: '',
    })

    const dataRows = allRows.slice(filasOmitir)
    const totalFilas = dataRows.length

    // 4. Crear registro de importación
    const importacion = await createImportacion({
      ejercicioId,
      nombreArchivo: archivo.name,
      hashArchivo: hash,
      mapeoSnapshot: { ...mapeo, archivoNombre: archivo.name },
    })
    importacionId = importacion.id

    // 5. Procesar filas
    const cuentas: { codigo: string; nombre: string; saldoDeudor: number; saldoAcreedor: number; saldoFinal: number }[] = []
    let filasError = 0

    for (const row of dataRows) {
      const codigo = String((row as unknown[])[colCodigo] ?? '').trim()
      const nombre = String((row as unknown[])[colNombre] ?? '').trim()

      // Saltar filas vacías
      if (!codigo && !nombre) continue

      if (!codigo || !nombre) {
        filasError++
        continue
      }

      const saldoDeudor = parseImporte((row as unknown[])[colDeudor])
      const saldoAcreedor = parseImporte((row as unknown[])[colAcreedor])
      const saldoFinal = saldoDeudor - saldoAcreedor

      cuentas.push({ codigo, nombre, saldoDeudor, saldoAcreedor, saldoFinal })
    }

    if (cuentas.length === 0) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas,
        filasImportadas: 0,
        filasError: totalFilas,
        erroresDetalle: { mensaje: 'No se encontraron filas válidas con código y nombre' },
      })
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No se encontraron cuentas válidas en el archivo. Verificá el mapeo de columnas y la cantidad de filas de encabezado.',
      })
    }

    const cuadre = validarCuadre(cuentas)
    if (!cuadre.cuadrado) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas,
        filasImportadas: 0,
        filasError,
        erroresDetalle: {
          mensaje: 'El balance de sumas y saldos no cuadra',
          totalDeudor: cuadre.totalDeudor,
          totalAcreedor: cuadre.totalAcreedor,
          diferencia: cuadre.diferencia,
        },
      })
      return errorBalanceDescuadrado(cuadre.diferencia)
    }

    // 6. Guardar en la base de datos
    const importadas = await replaceCuentas(ejercicioId, importacionId, cuentas)

    // 7. Marcar importación como completada
    await updateImportacion(importacionId, {
      estado: 'COMPLETADA',
      totalFilas,
      filasImportadas: importadas,
      filasError,
    })

    await resetEstadosConfirmado(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)

    return actionOk({ importacionId, importadas, errores: filasError, total: totalFilas })
  } catch (error) {
    // Marcar importación como fallida si ya fue creada
    if (importacionId) {
      await updateImportacion(importacionId, { estado: 'CON_ERRORES' }).catch(() => {})
    }
    return actionError(errorHandler(error, { modulo: 'importaciones', operacion: 'importar_excel' }))
  }
}

// ─── Confirmar importación manual (sin archivo Excel) ────────────────────────
// El usuario tipea las cuentas directamente en la UI, sin subir ningún Excel.

export async function confirmarImportacionManual(
  ejercicioId: string,
  sociedadId: string,
  filas: FilaEditada[],
): Promise<ActionResult<ResultadoImportacion>> {
  let importacionId: string | null = null

  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)

    if (!Array.isArray(filas) || filas.length === 0) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No hay filas para importar. Agregá al menos una cuenta.',
      })
    }

    // Hash derivado del contenido (no hay archivo)
    const hash = crypto.createHash('md5').update(JSON.stringify(filas)).digest('hex')

    const importacion = await createImportacion({
      ejercicioId,
      nombreArchivo: 'Carga manual',
      hashArchivo: hash,
      mapeoSnapshot: { tipo: 'manual' },
    })
    importacionId = importacion.id

    const cuentas: { codigo: string; nombre: string; saldoDeudor: number; saldoAcreedor: number; saldoFinal: number }[] = []
    let filasError = 0

    for (const fila of filas) {
      const codigo = String(fila.codigo ?? '').trim()
      const nombre = String(fila.nombre ?? '').trim()
      if (!codigo || !nombre) { filasError++; continue }
      const saldoDeudor = parseImporte(fila.saldoDeudor)
      const saldoAcreedor = parseImporte(fila.saldoAcreedor)
      cuentas.push({ codigo, nombre, saldoDeudor, saldoAcreedor, saldoFinal: saldoDeudor - saldoAcreedor })
    }

    if (cuentas.length === 0) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas: filas.length,
        filasImportadas: 0,
        filasError: filas.length,
        erroresDetalle: { mensaje: 'No se encontraron filas válidas' },
      })
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No hay cuentas válidas. Verificá que todas tengan código y nombre.',
      })
    }

    const cuadre = validarCuadre(cuentas)
    if (!cuadre.cuadrado) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas: filas.length,
        filasImportadas: 0,
        filasError,
        erroresDetalle: {
          mensaje: 'El balance de sumas y saldos no cuadra',
          totalDeudor: cuadre.totalDeudor,
          totalAcreedor: cuadre.totalAcreedor,
          diferencia: cuadre.diferencia,
        },
      })
      return errorBalanceDescuadrado(cuadre.diferencia)
    }

    const importadas = await replaceCuentas(ejercicioId, importacionId, cuentas)

    await updateImportacion(importacionId, {
      estado: 'COMPLETADA',
      totalFilas: filas.length,
      filasImportadas: importadas,
      filasError,
    })

    await resetEstadosConfirmado(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/clasificar`)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/estados`)

    return actionOk({ importacionId, importadas, errores: filasError, total: filas.length })
  } catch (error) {
    if (importacionId) {
      await updateImportacion(importacionId, { estado: 'CON_ERRORES' }).catch(() => {})
    }
    return actionError(errorHandler(error, { modulo: 'importaciones', operacion: 'confirmar_manual' }))
  }
}

// ─── Confirmar importación con filas editadas ─────────────────────────────────
// El cliente parsea el Excel, el usuario edita/elimina filas, y envía el array
// final. El archivo se adjunta solo para generar el hash de auditoría.

export async function confirmarImportacionEditada(
  ejercicioId: string,
  sociedadId: string,
  formData: FormData,
): Promise<ActionResult<ResultadoImportacion>> {
  let importacionId: string | null = null

  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)

    // 1. Leer archivo (solo para hash y registro de auditoría)
    const archivo = formData.get('archivo') as File | null
    if (!archivo || archivo.size === 0) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-002',
        mensaje: 'No se recibió el archivo original',
      })
    }

    // 2. Leer filas editadas
    const rowsJson = formData.get('rowsJson') as string | null
    if (!rowsJson) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-002',
        mensaje: 'No se recibieron los datos editados',
      })
    }

    let filas: FilaEditada[]
    try {
      filas = JSON.parse(rowsJson) as FilaEditada[]
    } catch {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Formato de datos inválido',
      })
    }

    if (!Array.isArray(filas) || filas.length === 0) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No hay filas para importar. Agregá al menos una cuenta.',
      })
    }

    // 3. Hash del archivo original
    const arrayBuffer = await archivo.arrayBuffer()
    const hash = crypto.createHash('md5').update(Buffer.from(arrayBuffer)).digest('hex')

    // 4. Crear registro de importación
    const importacion = await createImportacion({
      ejercicioId,
      nombreArchivo: archivo.name,
      hashArchivo: hash,
      mapeoSnapshot: { tipo: 'editada_manualmente', archivoNombre: archivo.name },
    })
    importacionId = importacion.id

    // 5. Procesar filas
    const cuentas: {
      codigo: string
      nombre: string
      saldoDeudor: number
      saldoAcreedor: number
      saldoFinal: number
    }[] = []
    let filasError = 0

    for (const fila of filas) {
      const codigo = String(fila.codigo ?? '').trim()
      const nombre = String(fila.nombre ?? '').trim()

      if (!codigo || !nombre) {
        filasError++
        continue
      }

      const saldoDeudor = parseImporte(fila.saldoDeudor)
      const saldoAcreedor = parseImporte(fila.saldoAcreedor)
      const saldoFinal = saldoDeudor - saldoAcreedor

      cuentas.push({ codigo, nombre, saldoDeudor, saldoAcreedor, saldoFinal })
    }

    if (cuentas.length === 0) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas: filas.length,
        filasImportadas: 0,
        filasError: filas.length,
        erroresDetalle: { mensaje: 'No se encontraron filas válidas con código y nombre' },
      })
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-010',
        mensaje: 'No hay cuentas válidas. Verificá que todas tengan código y nombre.',
      })
    }

    const cuadre = validarCuadre(cuentas)
    if (!cuadre.cuadrado) {
      await updateImportacion(importacionId, {
        estado: 'CON_ERRORES',
        totalFilas: filas.length,
        filasImportadas: 0,
        filasError,
        erroresDetalle: {
          mensaje: 'El balance de sumas y saldos no cuadra',
          totalDeudor: cuadre.totalDeudor,
          totalAcreedor: cuadre.totalAcreedor,
          diferencia: cuadre.diferencia,
        },
      })
      return errorBalanceDescuadrado(cuadre.diferencia)
    }

    // 6. Guardar en la base de datos
    const importadas = await replaceCuentas(ejercicioId, importacionId, cuentas)

    // 7. Marcar como completada
    await updateImportacion(importacionId, {
      estado: 'COMPLETADA',
      totalFilas: filas.length,
      filasImportadas: importadas,
      filasError,
    })

    await resetEstadosConfirmado(ejercicioId)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/clasificar`)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/estados`)

    return actionOk({ importacionId, importadas, errores: filasError, total: filas.length })
  } catch (error) {
    if (importacionId) {
      await updateImportacion(importacionId, { estado: 'CON_ERRORES' }).catch(() => {})
    }
    return actionError(
      errorHandler(error, { modulo: 'importaciones', operacion: 'confirmar_editada' }),
    )
  }
}
