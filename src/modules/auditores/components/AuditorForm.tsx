'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateAuditorSchema, type CreateAuditorInput } from '../schemas/auditor.schemas'
import { crearAuditor, actualizarAuditor } from '../actions/auditor.actions'
import type { AuditorDTO } from '../domain/types'

interface AuditorFormProps {
  defaultValues?: AuditorDTO
}

export function AuditorForm({ defaultValues }: AuditorFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(defaultValues?.id)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateAuditorInput>({
    resolver: zodResolver(CreateAuditorSchema),
    defaultValues: defaultValues
      ? {
          nombre: defaultValues.nombre,
          apellido: defaultValues.apellido,
          tituloProfesional: defaultValues.tituloProfesional ?? '',
          matricula: defaultValues.matricula ?? '',
          consejoProfesional: defaultValues.consejoProfesional ?? '',
          universidad: defaultValues.universidad ?? '',
          localidadInforme: defaultValues.localidadInforme ?? '',
          textoFirma: defaultValues.textoFirma ?? '',
          esDefault: defaultValues.esDefault,
        }
      : { esDefault: false },
  })

  const apellido = useWatch({ control, name: 'apellido' })
  const nombre = useWatch({ control, name: 'nombre' })
  const titulo = useWatch({ control, name: 'tituloProfesional' })
  const univ = useWatch({ control, name: 'universidad' })
  const mat = useWatch({ control, name: 'matricula' })
  const consejo = useWatch({ control, name: 'consejoProfesional' })

  function generarTextoFirma() {
    const linea1 = [apellido, nombre].filter(Boolean).join(', ')
    const linea2 = [titulo, univ].filter(Boolean).join(' - ')
    const linea3 = [mat ? `Mat. ${mat}` : '', consejo].filter(Boolean).join(' - ')
    const texto = [linea1, linea2, linea3].filter(Boolean).join('\n')
    setValue('textoFirma', texto)
  }

  function onSubmit(values: CreateAuditorInput) {
    startTransition(async () => {
      const result =
        isEdit && defaultValues?.id
          ? await actualizarAuditor(defaultValues.id, values)
          : await crearAuditor(values)

      if (!result.ok) {
        toastError(result.error)
        return
      }

      toastSuccess(isEdit ? 'Auditor actualizado' : 'Auditor creado correctamente')
      router.push('/auditores')
    })
  }

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar auditor' : 'Nuevo auditor'}</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Registrá los datos del contador o profesional que firmará los informes y estados contables.
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">

          {/* Datos personales */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Datos personales
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  placeholder="García"
                  error={Boolean(errors.apellido)}
                  {...register('apellido')}
                />
                {errors.apellido && (
                  <p className="text-xs text-red-600">{errors.apellido.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Carlos"
                  error={Boolean(errors.nombre)}
                  {...register('nombre')}
                />
                {errors.nombre && (
                  <p className="text-xs text-red-600">{errors.nombre.message}</p>
                )}
              </div>
            </div>

          </div>

          {/* Datos profesionales */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Datos profesionales
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tituloProfesional">
                  Título profesional{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="tituloProfesional"
                  placeholder="Contador Público"
                  {...register('tituloProfesional')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="universidad">
                  Universidad{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="universidad"
                  placeholder="UBA, UNVM, UNC..."
                  {...register('universidad')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="matricula">
                  Matrícula{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="matricula"
                  placeholder="CP 12345"
                  {...register('matricula')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="consejoProfesional">
                  Consejo profesional{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="consejoProfesional"
                  placeholder="CPCE Córdoba"
                  {...register('consejoProfesional')}
                />
              </div>
            </div>
          </div>

          {/* Firma e informe */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Firma e informe
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="localidadInforme">
                Localidad del informe{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="localidadInforme"
                placeholder="Ej: Leones, Córdoba"
                {...register('localidadInforme')}
              />
              <p className="text-xs text-slate-400">
                Aparece en el pie de cada informe: &quot;Leones, 15 de Abril de 2026.-&quot;
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="textoFirma">
                  Texto de firma{' '}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <button
                  type="button"
                  onClick={generarTextoFirma}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Wand2 className="h-3 w-3" />
                  Generar automáticamente
                </button>
              </div>
              <textarea
                id="textoFirma"
                rows={4}
                placeholder={'García, Carlos\nContador Público - UNVM\nMat. CP 12345 - CPCE Córdoba'}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
                {...register('textoFirma')}
              />
              <p className="text-xs text-slate-400">
                Se replica en todos los documentos generados. Usá &quot;Generar automáticamente&quot; para completarlo con los datos cargados arriba.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                id="esDefault"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                {...register('esDefault')}
              />
              <div>
                <label htmlFor="esDefault" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Auditor por defecto
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Se preseleccionará al crear un nuevo ejercicio contable. Solo puede haber uno por defecto.
                </p>
              </div>
            </div>
          </div>

        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear auditor'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
