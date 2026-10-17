'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { TipoPersona } from '@prisma/client'
import { Building2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateEstudioSchema, type CreateEstudioInput } from '../schemas/estudio.schemas'
import { crearEstudio, actualizarEstudio } from '../actions/estudio.actions'
import type { EstudioDTO } from '../domain/types'

interface EstudioFormProps {
  defaultValues?: EstudioDTO
  redirectTo?: string
}

export function EstudioForm({ defaultValues, redirectTo = '/sociedades' }: EstudioFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(defaultValues?.id)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateEstudioInput>({
    resolver: zodResolver(CreateEstudioSchema),
    defaultValues: defaultValues
      ? {
          tipoPersona: defaultValues.tipoPersona,
          nombre: defaultValues.nombre,
          cuit: defaultValues.cuit,
          razonSocial: defaultValues.razonSocial,
          domicilio: defaultValues.domicilio ?? '',
          localidad: defaultValues.localidad ?? '',
          provincia: defaultValues.provincia ?? '',
          telefono: defaultValues.telefono ?? '',
          email: defaultValues.email ?? '',
        }
      : { tipoPersona: TipoPersona.JURIDICA },
  })

  const tipoPersona = useWatch({ control, name: 'tipoPersona' })
  const esFisica = tipoPersona === TipoPersona.FISICA

  function onSubmit(values: CreateEstudioInput) {
    startTransition(async () => {
      const result =
        isEdit && defaultValues?.id
          ? await actualizarEstudio(defaultValues.id, values)
          : await crearEstudio(values)

      if (!result.ok) {
        toastError(result.error)
        return
      }

      toastSuccess(isEdit ? 'Configuración actualizada' : 'Estudio creado correctamente')
      router.push(redirectTo)
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle>{isEdit ? 'Configuración del estudio' : 'Datos del estudio contable'}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit
            ? 'Actualizá los datos de tu estudio o firma profesional.'
            : 'Estos datos identifican al estudio o profesional que usa BalanceRT. Se usarán como configuración general del espacio de trabajo.'}
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Tipo de estudio — radio cards */}
          <div className="space-y-2">
            <Label>Tipo de estudio</Label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {(
                [
                  {
                    value: TipoPersona.JURIDICA,
                    label: 'Sociedad / estudio organizado',
                    sub: 'SRL, SA, asociación civil, etc.',
                    Icon: Building2,
                  },
                  {
                    value: TipoPersona.FISICA,
                    label: 'Profesional independiente',
                    sub: 'Contador en ejercicio individual',
                    Icon: User,
                  },
                ] as const
              ).map(({ value, label, sub, Icon }) => (
                <label
                  key={value}
                  className={`relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                    tipoPersona === value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value={value}
                    className="sr-only"
                    {...register('tipoPersona')}
                  />
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      tipoPersona === value ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm leading-tight font-medium ${
                        tipoPersona === value ? 'text-blue-900' : 'text-slate-700'
                      }`}
                    >
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Datos del estudio */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              {esFisica ? 'Datos del profesional' : 'Datos del estudio'}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre comercial del estudio</Label>
              <Input
                id="nombre"
                placeholder={esFisica ? 'Ej: Estudio García' : 'Ej: García & Asociados'}
                error={Boolean(errors.nombre)}
                {...register('nombre')}
              />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="razonSocial">
                  {esFisica ? 'Apellido y nombre del titular' : 'Razón social'}
                </Label>
                <Input
                  id="razonSocial"
                  placeholder={
                    esFisica ? 'Ej: García, Carlos Alberto' : 'Ej: GARCIA Y ASOCIADOS SRL'
                  }
                  error={Boolean(errors.razonSocial)}
                  {...register('razonSocial')}
                />
                {errors.razonSocial && (
                  <p className="text-xs text-red-600">{errors.razonSocial.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder="20-12345678-9"
                  error={Boolean(errors.cuit)}
                  {...register('cuit')}
                />
                {errors.cuit && <p className="text-xs text-red-600">{errors.cuit.message}</p>}
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Contacto y domicilio
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="estudio@ejemplo.com"
                  error={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefono">
                  Teléfono <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input id="telefono" placeholder="(0351) 4xxx-xxxx" {...register('telefono')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domicilio">
                Domicilio <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Input id="domicilio" placeholder="Av. Corrientes 1234" {...register('domicilio')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="localidad">
                  Localidad <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input id="localidad" placeholder="Córdoba" {...register('localidad')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provincia">
                  Provincia <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input id="provincia" placeholder="Córdoba" {...register('provincia')} />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          {isEdit && (
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar y continuar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
