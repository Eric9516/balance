'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateRubroBaseSchema, type CreateRubroBaseInput } from '../schemas/rubro-base.schemas'
import { crearRubroBase, actualizarRubroBase, getSiguienteOrden } from '../actions/rubro-base.actions'
import type { RubroBaseDTO } from '../domain/types'
import type { RubroGrupoDTO } from '@/modules/rubros-grupo/domain/types'

const SECCIONES_SSP = [
  { value: 'ACTIVO_CORRIENTE', label: 'Activo Corriente' },
  { value: 'ACTIVO_NO_CORRIENTE', label: 'Activo No Corriente' },
  { value: 'PASIVO_CORRIENTE', label: 'Pasivo Corriente' },
  { value: 'PASIVO_NO_CORRIENTE', label: 'Pasivo No Corriente' },
  { value: 'PATRIMONIO_NETO', label: 'Patrimonio Neto' },
]

const SECCIONES_EERR = [
  { value: 'INGRESOS', label: 'Ingresos' },
  { value: 'COSTO_VENTAS', label: 'Costo de Ventas' },
  { value: 'GASTOS_ADM', label: 'Gastos de Administración' },
  { value: 'GASTOS_COM', label: 'Gastos de Comercialización' },
  { value: 'GASTOS_BANCARIOS', label: 'Gastos Bancarios' },
  { value: 'IMPUESTOS_CONTRIBUCIONES', label: 'Impuestos y Contribuciones' },
  { value: 'RESULTADOS_FINANCIEROS', label: 'Resultados Financieros' },
  { value: 'IMPUESTO_GANANCIAS', label: 'Impuesto a las Ganancias' },
]

interface Props {
  defaultValues?: RubroBaseDTO
  grupos?: RubroGrupoDTO[]
  redirectTo?: string
  defaultGrupoId?: string   // para pre-seleccionar grupo desde la tabla
}

export function RubroBaseForm({
  defaultValues,
  grupos = [],
  redirectTo = '/configuracion/rubros',
  defaultGrupoId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(defaultValues?.id)

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<CreateRubroBaseInput>({
    resolver: zodResolver(CreateRubroBaseSchema),
    defaultValues: defaultValues ? {
      rubroGrupoId: defaultValues.rubroGrupoId ?? '',
      codigo: defaultValues.codigo,
      nombre: defaultValues.nombre,
      estadoDestino: defaultValues.estadoDestino,
      seccionSSP: defaultValues.seccionSSP ?? '',
      seccionEERR: defaultValues.seccionEERR ?? '',
      naturalezaEsperada: defaultValues.naturalezaEsperada,
      orden: String(defaultValues.orden),
    } : {
      rubroGrupoId: defaultGrupoId ?? '',
    },
  })

  const rubroGrupoId = useWatch({ control, name: 'rubroGrupoId' })
  const estadoDestino = useWatch({ control, name: 'estadoDestino' })
  const seccionSSP = useWatch({ control, name: 'seccionSSP' })
  const seccionEERR = useWatch({ control, name: 'seccionEERR' })

  const grupoSeleccionado = grupos.find(g => g.id === rubroGrupoId)
  // Si hay grupo, RT 54 se hereda del grupo → no mostrar esos campos
  const usaGrupo = Boolean(grupoSeleccionado)
  const usaSSP = !usaGrupo && (estadoDestino === 'SSP' || estadoDestino === 'PN')
  const usaEERR = !usaGrupo && estadoDestino === 'EERR'

  // Cuando se selecciona un grupo, auto-setear estadoDestino/secciones del grupo
  useEffect(() => {
    if (!grupoSeleccionado) return
    // Si el grupo no tiene posición RT 54, usar 'SSP' como valor placeholder válido
    // (el rubro no aparecerá en estados porque seccionSSP y seccionEERR serán null)
    setValue('estadoDestino', (grupoSeleccionado.estadoDestino as 'SSP' | 'EERR' | 'PN') ?? 'SSP')
    setValue('seccionSSP', grupoSeleccionado.seccionSSP ?? '')
    setValue('seccionEERR', grupoSeleccionado.seccionEERR ?? '')
  }, [rubroGrupoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sugerir orden en modo creación
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isEdit) return
    if (isFirstRender.current) { isFirstRender.current = false; return }
    const seccion = usaSSP ? seccionSSP : usaEERR ? seccionEERR : undefined
    if (!seccion && !grupoSeleccionado) return
    getSiguienteOrden(
      usaSSP ? seccion : grupoSeleccionado?.seccionSSP ?? undefined,
      usaEERR ? seccion : grupoSeleccionado?.seccionEERR ?? undefined,
    ).then(n => setValue('orden', String(n)))
  }, [seccionSSP, seccionEERR, rubroGrupoId]) // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: CreateRubroBaseInput) {
    startTransition(async () => {
      // Copiar RT 54 del grupo al rubro para que la lógica contable funcione
      if (grupoSeleccionado) {
        // Si el grupo tiene posición RT 54, heredarla. Si no, usar SSP como placeholder
        // (el rubro no aparecerá en los estados porque seccionSSP/seccionEERR serán null)
        values.estadoDestino = (grupoSeleccionado.estadoDestino as 'SSP' | 'EERR' | 'PN') ?? 'SSP'
        values.seccionSSP = grupoSeleccionado.seccionSSP ?? ''
        values.seccionEERR = grupoSeleccionado.seccionEERR ?? ''
      }
      const result = isEdit && defaultValues?.id
        ? await actualizarRubroBase(defaultValues.id, values)
        : await crearRubroBase(values)

      if (!result.ok) { toastError(result.error); return }
      toastSuccess(isEdit ? 'Clasificación actualizada' : 'Clasificación creada')
      router.push(redirectTo)
    })
  }

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar clasificación' : 'Nueva clasificación'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">

          {/* Selector de sección (grupo) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rubroGrupoId">Sección</Label>
              <a
                href="/configuracion/rubros/nueva-seccion"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                + Crear nueva sección
              </a>
            </div>
            <Select id="rubroGrupoId" {...register('rubroGrupoId')}>
              <option value="">— Sin sección (manual) —</option>
              {grupos.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </Select>
            <p className="text-xs text-slate-400">
              {grupos.length === 0
                ? 'No hay secciones creadas aún. Usá el link de arriba para crear una.'
                : 'Seleccioná una sección para heredar su posición en el balance RT 54.'}
            </p>
          </div>

          {grupoSeleccionado && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700">
              Esta clasificación quedará bajo la sección <strong>{grupoSeleccionado.nombre}</strong>.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" placeholder="Ej: ACT-CTE-01" error={Boolean(errors.codigo)} {...register('codigo')} />
            {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej: Caja y Bancos" error={Boolean(errors.nombre)} {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>

          {/* estadoDestino/seccionSSP/seccionEERR — siempre registrados.
              En modo manual: visibles. Con grupo: ocultos (valor viene del useEffect). */}
          <div className={usaGrupo ? 'hidden' : undefined}>
            <div className="space-y-1.5">
              <Label htmlFor="estadoDestino">Estado destino</Label>
              <Select id="estadoDestino" error={Boolean(errors.estadoDestino)} {...register('estadoDestino')}>
                <option value="">— Seleccionar —</option>
                <option value="SSP">SSP — Situación Patrimonial</option>
                <option value="EERR">EERR — Estado de Resultados</option>
                <option value="PN">PN — Patrimonio Neto</option>
              </Select>
              {errors.estadoDestino && <p className="text-xs text-red-600">{errors.estadoDestino.message}</p>}
            </div>
          </div>
          {/* seccionSSP/seccionEERR siempre registrados (hidden) — solo visibles en modo manual */}
          <div className={usaGrupo ? 'hidden' : undefined}>
            {usaSSP && (
              <div className="space-y-1.5">
                <Label htmlFor="seccionSSP">Sección SSP</Label>
                <Select id="seccionSSP" error={Boolean(errors.seccionSSP)} {...register('seccionSSP')}>
                  <option value="">— Seleccionar —</option>
                  {SECCIONES_SSP.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
                {errors.seccionSSP && <p className="text-xs text-red-600">{errors.seccionSSP.message}</p>}
              </div>
            )}
            {usaEERR && (
              <div className="space-y-1.5">
                <Label htmlFor="seccionEERR">Sección EERR</Label>
                <Select id="seccionEERR" error={Boolean(errors.seccionEERR)} {...register('seccionEERR')}>
                  <option value="">— Seleccionar —</option>
                  {SECCIONES_EERR.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
                {errors.seccionEERR && <p className="text-xs text-red-600">{errors.seccionEERR.message}</p>}
              </div>
            )}
          </div>
          {/* Cuando hay grupo: seccionSSP/seccionEERR registrados pero completamente ocultos */}
          {usaGrupo && (
            <div className="hidden">
              <select {...register('seccionSSP')} />
              <select {...register('seccionEERR')} />
            </div>
          )}

          {/* Naturaleza — siempre visible */}
          <div className="space-y-1.5">
            <Label htmlFor="naturalezaEsperada">Naturaleza</Label>
            <Select id="naturalezaEsperada" error={Boolean(errors.naturalezaEsperada)} {...register('naturalezaEsperada')}>
              <option value="">— Seleccionar —</option>
              <option value="DEUDORA">Deudora</option>
              <option value="ACREEDORA">Acreedora</option>
            </Select>
            {errors.naturalezaEsperada && <p className="text-xs text-red-600">{errors.naturalezaEsperada.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="orden">Orden de presentación</Label>
            <Input id="orden" type="number" min="0" placeholder="—" error={Boolean(errors.orden)} {...register('orden')} />
            {errors.orden
              ? <p className="text-xs text-red-600">{errors.orden.message}</p>
              : <p className="text-xs text-slate-400">
                  {isEdit
                    ? 'Determina el orden de aparición dentro de la sección.'
                    : 'Se completa automáticamente al elegir sección.'}
                </p>
            }
          </div>

        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear clasificación'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
