'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateRubroGrupoSchema, type CreateRubroGrupoInput } from '../schemas/rubro-grupo.schemas'
import {
  crearRubroGrupo,
  actualizarRubroGrupo,
  getSiguienteOrdenGrupo,
} from '../actions/rubro-grupo.actions'
import type { RubroGrupoDTO } from '../domain/types'

interface Props {
  defaultValues?: RubroGrupoDTO
  redirectTo?: string
}

export function RubroGrupoForm({ defaultValues, redirectTo = '/configuracion/rubros' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(defaultValues?.id)

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateRubroGrupoInput>({
    resolver: zodResolver(CreateRubroGrupoSchema),
    defaultValues: defaultValues
      ? {
          nombre: defaultValues.nombre,
          sigla: defaultValues.sigla ?? '',
          esGasto: defaultValues.esGasto,
          orden: String(defaultValues.orden),
        }
      : { esGasto: false, nombre: '', sigla: '', orden: '' },
  })

  const esGasto = useWatch({ control, name: 'esGasto' })

  useEffect(() => {
    if (isEdit) return
    getSiguienteOrdenGrupo().then((n) => setValue('orden', String(n)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: CreateRubroGrupoInput) {
    startTransition(async () => {
      const result =
        isEdit && defaultValues?.id
          ? await actualizarRubroGrupo(defaultValues.id, values)
          : await crearRubroGrupo(values)

      if (!result.ok) {
        toastError(result.error)
        return
      }
      toastSuccess(isEdit ? 'Sección actualizada' : 'Sección creada')
      router.push(redirectTo)
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar sección' : 'Nueva sección'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Ej: Activo Corriente, Gastos Operativos..."
              error={Boolean(errors.nombre)}
              {...register('nombre')}
            />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sigla">
              Sigla <span className="font-normal text-slate-400">(opcional)</span>
            </Label>
            <Input
              id="sigla"
              placeholder="Ej: GTO, GAST, ACT"
              maxLength={10}
              {...register('sigla')}
            />
            <p className="text-xs text-slate-400">
              Abreviatura definida por el contador. Aparece junto al nombre en las tablas.
            </p>
          </div>

          {/* Checkbox: es gasto */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
                {...register('esGasto')}
              />
              <div>
                <span className="text-sm font-medium text-slate-800">¿Es un gasto?</span>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Si está activado, esta sección aparece en el{' '}
                  <strong>Estado de Resultados (EERR)</strong> como línea de gasto y en el{' '}
                  <strong>Anexo III</strong> como columna con el detalle de clasificaciones.
                </p>
              </div>
            </label>
            {esGasto && (
              <p className="mt-2 pl-7 text-xs font-medium text-blue-600">
                ✓ Los importes se calcularán automáticamente desde las cuentas clasificadas.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="orden">Orden de aparición</Label>
            <Input
              id="orden"
              type="number"
              min="0"
              placeholder="—"
              error={Boolean(errors.orden)}
              {...register('orden')}
            />
            {errors.orden ? (
              <p className="text-xs text-red-600">{errors.orden.message}</p>
            ) : (
              <p className="text-xs text-slate-400">Determina el orden entre secciones.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear sección'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
