'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { Info, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateEjercicioSchema, type CreateEjercicioInput } from '../schemas/ejercicio.schemas'
import { crearEjercicio, actualizarEjercicio } from '../actions/ejercicio.actions'
import { limpiarComparativosAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import { CLASIFICACION_ENTIDAD_OPTIONS, type EjercicioContableDTO } from '../domain/types'
import type { AuditorDTO } from '@/modules/auditores/domain/types'

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function buildAutoDenomin(fechaCierre: string): string {
  if (!fechaCierre) return ''
  const d = new Date(fechaCierre)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `Ejercicio al ${day}/${month}/${year}`
}

interface EjercicioFormProps {
  sociedadId: string
  auditores: AuditorDTO[]
  ejerciciosAnteriores: EjercicioContableDTO[]
  defaultValues?: EjercicioContableDTO
  sucedidoPor?: EjercicioContableDTO | null
  tieneComparativos?: boolean
}

export function EjercicioForm({
  sociedadId,
  auditores,
  ejerciciosAnteriores,
  defaultValues,
  sucedidoPor,
  tieneComparativos = false,
}: EjercicioFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingValues, setPendingValues] = useState<CreateEjercicioInput | null>(null)
  const isEdit = Boolean(defaultValues?.id)

  const auditorDefault = auditores.find((a) => a.esDefault)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateEjercicioInput>({
    resolver: zodResolver(CreateEjercicioSchema),
    defaultValues: defaultValues
      ? {
          fechaInicio: toDateInputValue(defaultValues.fechaInicio),
          fechaCierre: toDateInputValue(defaultValues.fechaCierre),
          denominacion: defaultValues.denominacion,
          numeroEjercicio: defaultValues.numeroEjercicio != null ? String(defaultValues.numeroEjercicio) : '',
          auditorId: defaultValues.auditorId ?? '',
          ejercicioAnteriorId: defaultValues.ejercicioAnteriorId ?? '',
          fechaInformeAuditor: toDateInputValue(defaultValues.fechaInformeAuditor),
          clasificacionEntidad: defaultValues.clasificacionEntidad ?? '',
          indiceInflacionAnterior: defaultValues.indiceInflacionAnterior != null ? String(defaultValues.indiceInflacionAnterior) : '',
          indiceInflacionActual: defaultValues.indiceInflacionActual != null ? String(defaultValues.indiceInflacionActual) : '',
          balanceAnteriorDisponible: defaultValues.balanceAnteriorDisponible,
          nivelComparativoSSP: defaultValues.nivelComparativoSSP ?? undefined,
        }
      : {
          auditorId: auditorDefault?.id ?? '',
          clasificacionEntidad: '',
          ejercicioAnteriorId: '',
          balanceAnteriorDisponible: true,
          nivelComparativoSSP: 'SECCION' as const,
        },
  })

  const fechaCierre = useWatch({ control, name: 'fechaCierre' })
  const denominacion = useWatch({ control, name: 'denominacion' })
  const indAnterior = useWatch({ control, name: 'indiceInflacionAnterior' })
  const indActual = useWatch({ control, name: 'indiceInflacionActual' })
  const ejercicioAnteriorId = useWatch({ control, name: 'ejercicioAnteriorId' })
  const balanceDisponible = useWatch({ control, name: 'balanceAnteriorDisponible' })
  const nivelSSP = useWatch({ control, name: 'nivelComparativoSSP' }) ?? 'SECCION'

  const autoDenominacion = buildAutoDenomin(fechaCierre ?? '')
  const showDenomPreview = !denominacion && autoDenominacion

  const coefAnual = (() => {
    const ant = parseFloat(indAnterior ?? '')
    const act = parseFloat(indActual ?? '')
    if (isNaN(ant) || isNaN(act) || ant === 0) return null
    return (act / ant).toFixed(4)
  })()

  // Si al editar cambia el modo de balance y hay comparativos cargados, pide confirmación
  const modoBalanceCambio =
    isEdit &&
    tieneComparativos &&
    defaultValues?.balanceAnteriorDisponible !== undefined &&
    balanceDisponible !== defaultValues.balanceAnteriorDisponible

  function onSubmit(values: CreateEjercicioInput) {
    if (modoBalanceCambio) {
      setPendingValues(values)
      return
    }
    guardar(values)
  }

  function guardar(values: CreateEjercicioInput) {
    startTransition(async () => {
      // Si cambió el modo, limpiar comparativos existentes primero
      if (isEdit && defaultValues?.id && tieneComparativos && modoBalanceCambio) {
        await limpiarComparativosAction(defaultValues.id, sociedadId)
      }

      const result =
        isEdit && defaultValues?.id
          ? await actualizarEjercicio(defaultValues.id, sociedadId, values)
          : await crearEjercicio(sociedadId, values)

      if (!result.ok) {
        toastError(result.error)
        return
      }

      toastSuccess(isEdit ? 'Ejercicio actualizado' : 'Ejercicio creado correctamente')
      router.push(`/sociedades/${sociedadId}/ejercicios`)
    })
  }

  const tieneAnteriorSeleccionado = Boolean(ejercicioAnteriorId && ejercicioAnteriorId !== '')
  // La sección de comparativos siempre aparece — tanto si hay anterior vinculado
  // como si no (primer ejercicio que se carga sin balance anterior disponible)
  const mostrarSeccionComparativos = true

  return (
    <>
    {/* Modal de confirmación de borrado de comparativos */}
    {pendingValues && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={() => setPendingValues(null)} />
        <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cambiar configuración de comparativos</h3>
              <p className="mt-1 text-sm text-slate-600">
                Al cambiar esta opción se van a borrar todos los comparativos manuales que ya ingresaste. Esta acción no se puede deshacer.
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
              Sí, cambiar y borrar datos
            </Button>
          </div>
        </div>
      </div>
    )}

    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar ejercicio' : 'Nuevo ejercicio'}</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Definí el período contable y los datos del ejercicio para generar los estados contables bajo RT 54.
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">

          {/* Banner: este ejercicio es comparativo de otro */}
          {sucedidoPor && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                <strong>{sucedidoPor.denominacion}</strong> usa este ejercicio como
                comparativo. Modificar las fechas o los índices de inflación puede
                afectar los estados y anexos de ese ejercicio.
              </p>
            </div>
          )}

          {/* Período contable */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Período contable
            </p>
            <p className="text-xs text-slate-500 -mt-2">
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Denominación
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="denominacion">
                Denominación <span className="text-slate-400 font-normal">(opcional)</span>
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

          {/* Auditor y ejercicio anterior */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Auditor y comparativo
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="auditorId">Auditor firmante</Label>
              <Select
                id="auditorId"
                error={Boolean(errors.auditorId)}
                {...register('auditorId')}
              >
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

            {ejerciciosAnteriores.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ejercicioAnteriorId">
                  Ejercicio anterior / comparativo{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Select id="ejercicioAnteriorId" {...register('ejercicioAnteriorId')}>
                  <option value="">— Sin comparativo —</option>
                  {ejerciciosAnteriores.map((ej) => (
                    <option key={ej.id} value={ej.id}>
                      {ej.denominacion}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-400">
                  Se usa para la columna del año anterior en los estados contables.
                </p>
              </div>
            )}

            {/* Pregunta 1: comparativos — aparece siempre */}
            {mostrarSeccionComparativos && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  {tieneAnteriorSeleccionado
                    ? '¿Tenés el balance de sumas y saldos de ese ejercicio disponible?'
                    : '¿Contás con datos del período anterior para mostrar como columna comparativa?'}
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={balanceDisponible !== false}
                      onChange={() => setValue('balanceAnteriorDisponible', true)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="text-sm text-slate-800">
                      {tieneAnteriorSeleccionado
                        ? 'Sí — los comparativos se calculan automáticamente'
                        : 'Sí, tengo el balance — lo voy a importar como ejercicio anterior'}
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={balanceDisponible === false}
                      onChange={() => setValue('balanceAnteriorDisponible', false)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="text-sm text-slate-800">No — los comparativos se ingresan manualmente</span>
                  </label>
                </div>

                {/* Pregunta 2: nivel SSP — solo cuando balance no disponible */}
                {balanceDisponible === false && (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                    <p className="text-sm font-medium text-slate-700">
                      ¿A qué nivel querés ingresar los comparativos del SSP?
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={nivelSSP === 'SECCION'}
                          onChange={() => setValue('nivelComparativoSSP', 'SECCION')}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <span className="text-sm text-slate-800">Por sección</span>
                          <p className="text-xs text-slate-500">5 totales fijos: Activo Corriente, Activo No Corriente, Pasivo Corriente, Pasivo No Corriente, Patrimonio Neto</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={nivelSSP === 'RUBRO'}
                          onChange={() => setValue('nivelComparativoSSP', 'RUBRO')}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <span className="text-sm text-slate-800">Por rubro</span>
                          <p className="text-xs text-slate-500">Un valor por cada clasificación usada en este ejercicio (Caja y Bancos, Créditos, Bienes de Uso, etc.) más la opción de agregar los que existían solo en el período anterior</p>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      El EERR y los Gastos siempre se ingresan por sección — son pocas líneas fijas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ajuste por inflación */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ajuste por inflación (RT 6)
            </p>
            <p className="text-xs text-slate-500 -mt-2">
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
                <span className="font-mono text-sm font-semibold text-slate-800">{coefAnual}</span>
              </div>
            )}
          </div>

          {/* Clasificación y datos adicionales */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Clasificación y cierre
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="clasificacionEntidad">Clasificación de la entidad</Label>
              <Select
                id="clasificacionEntidad"
                error={Boolean(errors.clasificacionEntidad)}
                {...register('clasificacionEntidad')}
              >
                <option value="">— Seleccionar —</option>
                {CLASIFICACION_ENTIDAD_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
              <p className="text-xs text-slate-400">
                Determina el modelo de presentación por ejercicio. Puede diferir de la clasificación del cliente.
              </p>
              {errors.clasificacionEntidad && (
                <p className="text-xs text-red-600">{errors.clasificacionEntidad.message}</p>
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
