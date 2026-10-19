'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Info, Link2, PenLine, Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import type { AppError } from '@/modules/errores/types'
import { CreateEjercicioSchema, type CreateEjercicioInput } from '../schemas/ejercicio.schemas'
import { crearEjercicio, actualizarEjercicio } from '../actions/ejercicio.actions'
import {
  CATEGORIA_ENTE_DESCRIPCIONES,
  CATEGORIA_ENTE_LABELS,
  CATEGORIA_ENTE_OPTIONS,
  type CategoriaEnteRT54,
  type EjercicioContableDTO,
  type ModoEjercicioAnterior,
} from '../domain/types'
import {
  candidatoAutomatico,
  efectosCambioModo,
  elegiblesComoAnterior,
  esConsecutivo,
  type EjercicioResumen,
} from '../domain/ejercicioAnterior'
import type { AuditorDTO } from '@/modules/auditores/domain/types'
import { formatFecha, toDateInputValue } from '@/lib/utils/dates'
import { dividir } from '@/lib/importe'

function buildAutoDenomin(fechaCierre: string): string {
  if (!fechaCierre) return ''
  const d = new Date(fechaCierre)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `Ejercicio al ${day}/${month}/${year}`
}

/** `<input type="date">` (yyyy-mm-dd) → Date a medianoche UTC, como se guardan las fechas contables. */
function fechaInputToUTC(valor: string | undefined): Date | null {
  if (!valor) return null
  const d = new Date(valor + 'T00:00:00.000Z')
  return isNaN(d.getTime()) ? null : d
}

/** Campos del formulario sobre los que el servidor puede devolver un error con `campo`. */
const CAMPOS_FORM: Record<keyof CreateEjercicioInput, true> = {
  fechaInicio: true,
  fechaCierre: true,
  denominacion: true,
  numeroEjercicio: true,
  auditorId: true,
  modoAnterior: true,
  ejercicioAnteriorId: true,
  categoriaEnte: true,
  fechaInformeAuditor: true,
  indiceInflacionAnterior: true,
  indiceInflacionActual: true,
}

function campoDelForm(campo: string | undefined): keyof CreateEjercicioInput | null {
  return campo && Object.hasOwn(CAMPOS_FORM, campo) ? (campo as keyof CreateEjercicioInput) : null
}

// ─── Tarjeta seleccionable (modo del ejercicio anterior) ──────────────────────

function TarjetaModo({
  valor,
  checked,
  disabled = false,
  icon: Icon,
  label,
  description,
  onSelect,
  children,
}: {
  valor: ModoEjercicioAnterior
  checked: boolean
  disabled?: boolean
  icon: LucideIcon
  label: string
  description: string
  onSelect: () => void
  children?: React.ReactNode
}) {
  return (
    <label
      className={cn(
        // relative: el radio sr-only (absolute) queda dentro de la tarjeta; sin esto, al
        // enfocarlo el navegador desplaza la ventana entera y descuadra el layout.
        'relative block rounded-xl border p-4 transition-all has-focus-visible:ring-2 has-focus-visible:ring-blue-200',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
          : checked
            ? 'cursor-pointer border-blue-500 bg-blue-50'
            : 'cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {/* El radio va primero para que sea el control asociado al label (no el select anidado). */}
      <input
        type="radio"
        name="modoAnterior"
        value={valor}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-colors',
            checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300',
          )}
        >
          {checked && <div className="h-full w-full scale-[0.4] rounded-full bg-white" />}
        </div>
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0',
            checked ? 'text-blue-600' : 'text-slate-400',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </label>
  )
}

// ─── Formulario ───────────────────────────────────────────────────────────────

interface EjercicioFormProps {
  sociedadId: string
  auditores: AuditorDTO[]
  /** Resúmenes de todos los ejercicios de la sociedad (el propio se excluye acá). */
  ejerciciosAnteriores: EjercicioResumen[]
  defaultValues?: EjercicioContableDTO
  /** Ejercicio que tiene a este como anterior (sucesor en la cadena). */
  sucedidoPor?: Pick<EjercicioResumen, 'denominacion'> | null
  /** Al editar: ya hay importes manuales del ejercicio anterior cargados. */
  tieneComparativos?: boolean
  /** Al crear: categoría del ente tomada de la sociedad. */
  categoriaEnteDefault?: CategoriaEnteRT54 | null
}

export function EjercicioForm({
  sociedadId,
  auditores,
  ejerciciosAnteriores,
  defaultValues,
  sucedidoPor,
  tieneComparativos = false,
  categoriaEnteDefault = null,
}: EjercicioFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingValues, setPendingValues] = useState<CreateEjercicioInput | null>(null)
  // Al crear, el modo sigue al candidato automático hasta que el usuario elige a mano.
  const [modoElegido, setModoElegido] = useState(false)
  const isEdit = Boolean(defaultValues?.id)
  const ejercicioId = defaultValues?.id ?? null

  const auditorDefault = auditores.find((a) => a.esDefault)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateEjercicioInput>({
    resolver: zodResolver(CreateEjercicioSchema),
    defaultValues: defaultValues
      ? {
          fechaInicio: toDateInputValue(defaultValues.fechaInicio),
          fechaCierre: toDateInputValue(defaultValues.fechaCierre),
          denominacion: defaultValues.denominacion,
          numeroEjercicio:
            defaultValues.numeroEjercicio != null ? String(defaultValues.numeroEjercicio) : '',
          auditorId: defaultValues.auditorId ?? '',
          modoAnterior: defaultValues.modoAnterior ?? undefined,
          ejercicioAnteriorId: defaultValues.ejercicioAnteriorId ?? '',
          categoriaEnte: defaultValues.categoriaEnte ?? undefined,
          fechaInformeAuditor: toDateInputValue(defaultValues.fechaInformeAuditor),
          indiceInflacionAnterior:
            defaultValues.indiceInflacionAnterior != null
              ? String(defaultValues.indiceInflacionAnterior)
              : '',
          indiceInflacionActual:
            defaultValues.indiceInflacionActual != null
              ? String(defaultValues.indiceInflacionActual)
              : '',
        }
      : {
          auditorId: auditorDefault?.id ?? '',
          // Sin fecha de inicio todavía no hay candidato: arranca en MANUAL y, si al
          // cargar la fecha aparece un candidato, pasa a VINCULADO (ver efecto más abajo).
          modoAnterior: 'MANUAL',
          ejercicioAnteriorId: '',
          categoriaEnte: categoriaEnteDefault ?? undefined,
        },
  })

  const fechaInicio = useWatch({ control, name: 'fechaInicio' })
  const fechaCierre = useWatch({ control, name: 'fechaCierre' })
  const denominacion = useWatch({ control, name: 'denominacion' })
  const indAnterior = useWatch({ control, name: 'indiceInflacionAnterior' })
  const indActual = useWatch({ control, name: 'indiceInflacionActual' })
  const modoAnterior = useWatch({ control, name: 'modoAnterior' })
  const ejercicioAnteriorId = useWatch({ control, name: 'ejercicioAnteriorId' }) ?? ''
  const categoriaEnte = useWatch({ control, name: 'categoriaEnte' })

  const autoDenominacion = buildAutoDenomin(fechaCierre ?? '')
  const showDenomPreview = !denominacion && autoDenominacion

  const coefAnual = (() => {
    const ant = parseFloat(indAnterior ?? '')
    const act = parseFloat(indActual ?? '')
    if (isNaN(ant) || isNaN(act) || ant === 0) return null
    return dividir(act, ant).toFixed(4)
  })()

  // ── Ejercicio anterior: elegibles y candidato (dominio puro) ────────────────
  // Cálculo liviano por render (pocos ejercicios por sociedad). El efecto de abajo
  // solo depende de primitivos (ids y booleanos), no de la identidad del array.
  const fechaInicioUTC = fechaInputToUTC(fechaInicio)
  const elegibles = elegiblesComoAnterior(ejerciciosAnteriores, {
    id: ejercicioId,
    fechaInicio: fechaInicioUTC,
  })
  const candidato = candidatoAutomatico(elegibles, fechaInicioUTC)
  const candidatoId = candidato?.id ?? null
  const sinElegibles = elegibles.length === 0
  const anteriorSeleccionado = elegibles.find((e) => e.id === ejercicioAnteriorId) ?? null
  const seleccionElegible = !ejercicioAnteriorId || anteriorSeleccionado != null
  const esCandidato = candidatoId != null && ejercicioAnteriorId === candidatoId
  const noConsecutivo =
    anteriorSeleccionado != null &&
    fechaInicioUTC != null &&
    !esConsecutivo(anteriorSeleccionado.fechaCierre, fechaInicioUTC)

  useEffect(() => {
    // 1. El vínculo dejó de ser elegible (cambió la fecha de inicio): se limpia.
    if (!seleccionElegible) {
      setValue('ejercicioAnteriorId', '', { shouldDirty: true })
      return
    }
    // 2. Alta: hasta que el usuario elija, el modo sigue al candidato automático.
    if (!isEdit && !modoElegido) {
      if (candidatoId) {
        if (modoAnterior !== 'VINCULADO') {
          setValue('modoAnterior', 'VINCULADO', { shouldDirty: true })
        }
        if (ejercicioAnteriorId !== candidatoId) {
          setValue('ejercicioAnteriorId', candidatoId, { shouldDirty: true })
        }
      } else if (modoAnterior === 'VINCULADO') {
        setValue('modoAnterior', 'MANUAL', { shouldDirty: true })
        setValue('ejercicioAnteriorId', '', { shouldDirty: true })
      }
      return
    }
    // 3. Vincular sin elección: se preselecciona el candidato.
    if (modoAnterior === 'VINCULADO' && !ejercicioAnteriorId && candidatoId) {
      setValue('ejercicioAnteriorId', candidatoId, { shouldDirty: true })
    }
  }, [
    isEdit,
    modoElegido,
    modoAnterior,
    ejercicioAnteriorId,
    candidatoId,
    seleccionElegible,
    setValue,
  ])

  function elegirModo(modo: ModoEjercicioAnterior) {
    setModoElegido(true)
    setValue('modoAnterior', modo, {
      shouldDirty: true,
      shouldValidate: Boolean(errors.modoAnterior),
    })
    if (modo !== 'VINCULADO') {
      setValue('ejercicioAnteriorId', '', { shouldDirty: true })
    }
  }

  // ── Confirmación al editar: cambiar modo/vínculo borra los importes manuales ─
  const efectos = efectosCambioModo(
    {
      modoAnterior: defaultValues?.modoAnterior ?? null,
      ejercicioAnteriorId: defaultValues?.ejercicioAnteriorId ?? null,
    },
    {
      modoAnterior: modoAnterior ?? null,
      ejercicioAnteriorId: modoAnterior === 'VINCULADO' ? ejercicioAnteriorId || null : null,
    },
  )
  const pedirConfirmacion = isEdit && tieneComparativos && efectos.anularAutorizacion

  function onSubmit(values: CreateEjercicioInput) {
    if (pedirConfirmacion) {
      setPendingValues(values)
      return
    }
    guardar(values)
  }

  function mostrarErrorServidor(error: AppError) {
    const campo = campoDelForm(error.campo)
    if (campo) {
      setError(campo, { type: 'server', message: error.detalle ?? error.mensaje })
    }
    toastError(error)
  }

  function guardar(values: CreateEjercicioInput) {
    startTransition(async () => {
      // El borrado de comparativos y la anulación de la autorización los aplica el servidor.
      const result =
        isEdit && ejercicioId
          ? await actualizarEjercicio(ejercicioId, sociedadId, values)
          : await crearEjercicio(sociedadId, values)

      if (!result.ok) {
        mostrarErrorServidor(result.error)
        return
      }

      toastSuccess(isEdit ? 'Ejercicio actualizado' : 'Ejercicio creado correctamente')
      router.push(`/sociedades/${sociedadId}/ejercicios`)
    })
  }

  return (
    <>
      {/* Modal de confirmación: cambiar modo/vínculo borra los importes manuales */}
      {pendingValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPendingValues(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Cambiar cómo se resuelve el ejercicio anterior
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Al cambiar cómo se resuelve el ejercicio anterior se borran los importes manuales
                  del ejercicio anterior y se anula su autorización. Los estados y el E.E.P.N.
                  vuelven a estado sin confirmar.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingValues(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const v = pendingValues
                  setPendingValues(null)
                  guardar(v)
                }}
                disabled={isPending}
              >
                Sí, cambiar y guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{isEdit ? 'Editar ejercicio' : 'Nuevo ejercicio'}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Definí el período contable y los datos del ejercicio para generar los estados contables
            bajo RT 54.
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Banner: este ejercicio es el anterior de otro */}
            {sucedidoPor && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                <p className="text-sm text-blue-700">
                  <strong>{sucedidoPor.denominacion}</strong> usa este ejercicio como ejercicio
                  anterior. Modificar las fechas o los índices de inflación puede afectar los
                  estados y anexos de ese ejercicio.
                </p>
              </div>
            )}

            {/* Período contable */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Período contable
              </p>
              <p className="-mt-2 text-xs text-slate-500">
                Estas fechas aparecen en la carátula del balance.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fechaInicio">Fecha de inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    error={Boolean(errors.fechaInicio)}
                    {...register('fechaInicio')}
                  />
                  {errors.fechaInicio && (
                    <p className="text-xs text-red-600">{errors.fechaInicio.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fechaCierre">Fecha de cierre</Label>
                  <Input
                    id="fechaCierre"
                    type="date"
                    error={Boolean(errors.fechaCierre)}
                    {...register('fechaCierre')}
                  />
                  {errors.fechaCierre && (
                    <p className="text-xs text-red-600">{errors.fechaCierre.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numeroEjercicio">N° de ejercicio</Label>
                <Input
                  id="numeroEjercicio"
                  type="number"
                  min="1"
                  placeholder="Ej: 5"
                  className="max-w-[160px]"
                  error={Boolean(errors.numeroEjercicio)}
                  {...register('numeroEjercicio')}
                />
                {errors.numeroEjercicio && (
                  <p className="text-xs text-red-600">{errors.numeroEjercicio.message}</p>
                )}
              </div>
            </div>

            {/* Denominación */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Denominación
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="denominacion">
                  Denominación <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  id="denominacion"
                  placeholder={autoDenominacion || 'Ej: Ejercicio al 31/12/2025'}
                  {...register('denominacion')}
                />
                {showDenomPreview && (
                  <p className="text-xs text-slate-400">
                    Se usará: <span className="font-mono text-slate-600">{autoDenominacion}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Auditor firmante */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Auditor firmante
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="auditorId">Auditor firmante</Label>
                <Select id="auditorId" error={Boolean(errors.auditorId)} {...register('auditorId')}>
                  <option value="">— Seleccionar —</option>
                  {auditores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombreCompleto}
                      {a.esDefault ? ' (por defecto)' : ''}
                    </option>
                  ))}
                </Select>
                {errors.auditorId && (
                  <p className="text-xs text-red-600">{errors.auditorId.message}</p>
                )}
              </div>
            </div>

            {/* Ejercicio anterior */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Ejercicio anterior — requisito comparativo RT 54
              </p>
              <p className="-mt-2 text-xs text-slate-500">
                Define de dónde salen los saldos de inicio y la columna &quot;Ejercicio
                anterior&quot; de los estados contables.
              </p>

              <div className="space-y-3">
                <TarjetaModo
                  valor="VINCULADO"
                  checked={modoAnterior === 'VINCULADO'}
                  disabled={sinElegibles}
                  icon={Link2}
                  label="Vincular ejercicio cargado en el sistema"
                  description={
                    sinElegibles
                      ? 'No hay ejercicios cargados de esta sociedad que cierren antes del inicio'
                      : 'Los saldos de inicio y la columna comparativa se derivan del ejercicio vinculado y quedan bloqueados.'
                  }
                  onSelect={() => elegirModo('VINCULADO')}
                >
                  {modoAnterior === 'VINCULADO' && !sinElegibles && (
                    <div className="space-y-1.5">
                      <Select
                        id="ejercicioAnteriorId"
                        aria-label="Ejercicio anterior"
                        error={Boolean(errors.ejercicioAnteriorId)}
                        {...register('ejercicioAnteriorId', {
                          onChange: () => setModoElegido(true),
                        })}
                      >
                        <option value="">— Seleccionar ejercicio —</option>
                        {elegibles.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.denominacion} · cierre {formatFecha(e.fechaCierre)}
                          </option>
                        ))}
                      </Select>
                      {esCandidato && (
                        <p className="text-xs text-blue-600">
                          Detectado automáticamente: cierra el día anterior al inicio
                        </p>
                      )}
                      {noConsecutivo && anteriorSeleccionado && (
                        <p className="text-xs text-amber-600">
                          Los ejercicios no son consecutivos: el anterior cierra el{' '}
                          {formatFecha(anteriorSeleccionado.fechaCierre)} y este empieza el{' '}
                          {formatFecha(fechaInicioUTC)}. Verificá que no falte un ejercicio
                          intermedio.
                        </p>
                      )}
                      {errors.ejercicioAnteriorId && (
                        <p className="text-xs text-red-600">{errors.ejercicioAnteriorId.message}</p>
                      )}
                    </div>
                  )}
                </TarjetaModo>

                <TarjetaModo
                  valor="MANUAL"
                  checked={modoAnterior === 'MANUAL'}
                  icon={PenLine}
                  label="Cargar saldos del ejercicio anterior manualmente"
                  description="No hay historial en el sistema: cargás a mano los saldos del ejercicio anterior y los autorizás antes de cerrar."
                  onSelect={() => elegirModo('MANUAL')}
                />

                <TarjetaModo
                  valor="SIN_ANTERIOR"
                  checked={modoAnterior === 'SIN_ANTERIOR'}
                  icon={Sparkles}
                  label="Primer ejercicio de la sociedad, sin comparativo"
                  description="Es el primer ejercicio de la sociedad: los estados se presentan sin columna comparativa."
                  onSelect={() => elegirModo('SIN_ANTERIOR')}
                />
              </div>

              {errors.modoAnterior && (
                <p className="text-xs text-red-600">{errors.modoAnterior.message}</p>
              )}
              {/* Error de vínculo cuando el select no está visible: modo MANUAL con id residual,
                  o Vincular elegido pero sin ejercicios elegibles (cambió la fecha de inicio). */}
              {errors.ejercicioAnteriorId && (modoAnterior !== 'VINCULADO' || sinElegibles) && (
                <p className="text-xs text-red-600">{errors.ejercicioAnteriorId.message}</p>
              )}
            </div>

            {/* Ajuste por inflación */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Ajuste por inflación (RT 6)
              </p>
              <p className="-mt-2 text-xs text-slate-500">
                Índice de Precios al Consumidor (IPC) — FACPCE Res. JG N° 539/2018.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="indiceInflacionAnterior">Índice inicio del ejercicio</Label>
                  <Input
                    id="indiceInflacionAnterior"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Ej: 1250.50"
                    error={Boolean(errors.indiceInflacionAnterior)}
                    {...register('indiceInflacionAnterior')}
                  />
                  {errors.indiceInflacionAnterior && (
                    <p className="text-xs text-red-600">{errors.indiceInflacionAnterior.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="indiceInflacionActual">Índice cierre del ejercicio</Label>
                  <Input
                    id="indiceInflacionActual"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Ej: 2180.75"
                    error={Boolean(errors.indiceInflacionActual)}
                    {...register('indiceInflacionActual')}
                  />
                  {errors.indiceInflacionActual && (
                    <p className="text-xs text-red-600">{errors.indiceInflacionActual.message}</p>
                  )}
                </div>
              </div>

              {coefAnual && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <span className="text-xs text-slate-500">Coeficiente anual</span>
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    {coefAnual}
                  </span>
                </div>
              )}
            </div>

            {/* Categoría del ente y cierre */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Categoría del ente y cierre
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="categoriaEnte">Categoría del ente (RT 54)</Label>
                <Select
                  id="categoriaEnte"
                  error={Boolean(errors.categoriaEnte)}
                  {...register('categoriaEnte')}
                >
                  <option value="">— Seleccionar —</option>
                  {CATEGORIA_ENTE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {CATEGORIA_ENTE_LABELS[o]}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-400">
                  {categoriaEnte
                    ? CATEGORIA_ENTE_DESCRIPCIONES[categoriaEnte]
                    : 'Determina las simplificaciones de medición y exposición que aplica el ejercicio. Puede diferir de la categoría de la sociedad.'}
                </p>
                {errors.categoriaEnte && (
                  <p className="text-xs text-red-600">{errors.categoriaEnte.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fechaInformeAuditor">Fecha del informe de auditor</Label>
                <Input
                  id="fechaInformeAuditor"
                  type="date"
                  className="max-w-[200px]"
                  error={Boolean(errors.fechaInformeAuditor)}
                  {...register('fechaInformeAuditor')}
                />
                {errors.fechaInformeAuditor && (
                  <p className="text-xs text-red-600">{errors.fechaInformeAuditor.message}</p>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/sociedades/${sociedadId}/ejercicios`)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear ejercicio'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}
