'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { TipoPersona } from '@prisma/client'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/modules/errores/components/Toast'
import { CreateSociedadSchema, type CreateSociedadInput } from '../schemas/sociedad.schemas'
import { crearSociedad, actualizarSociedad } from '../actions/sociedad.actions'
import type { SociedadDTO } from '../domain/types'
import {
  CATEGORIA_ENTE_DESCRIPCIONES,
  CATEGORIA_ENTE_LABELS,
  CATEGORIA_ENTE_OPTIONS,
  type CategoriaEnteRT54,
} from '@/modules/ejercicios/domain/types'
import { toDateInputValue } from '@/lib/utils/dates'

const TIPO_SOCIETARIO_OPTIONS = [
  'S.A.',
  'S.R.L.',
  'S.A.S.',
  'Cooperativa',
  'Asociación Civil',
  'Fundación',
  'Otra',
]
const CONDICION_FISCAL_OPTIONS = ['Responsable inscripto', 'Monotributista', 'Unipersonal', 'Otro']

/**
 * Mapea el texto libre legacy `clasificacionRT54` al enum CategoriaEnteRT54.
 * Se usa solo como valor inicial al editar sociedades anteriores al enum.
 * Devuelve `undefined` (select en "— Seleccionar —") cuando no hay texto.
 */
function categoriaDesdeLegacy(texto: string | null | undefined): CategoriaEnteRT54 | undefined {
  if (!texto) return undefined
  const t = texto.toLowerCase()
  if (t.includes('pequeñ')) return 'PEQUENA'
  if (t.includes('median')) return 'MEDIANA'
  return 'RESTANTE'
}

interface SociedadFormProps {
  defaultValues?: SociedadDTO
}

export function SociedadForm({ defaultValues }: SociedadFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(defaultValues?.id)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateSociedadInput>({
    resolver: zodResolver(CreateSociedadSchema),
    defaultValues: defaultValues
      ? {
          razonSocial: defaultValues.razonSocial,
          cuit: defaultValues.cuit,
          tipoPersona: defaultValues.tipoPersona,
          tipoSocietario: defaultValues.tipoSocietario ?? '',
          condicionFiscal: defaultValues.condicionFiscal ?? '',
          domicilioLegal: defaultValues.domicilioLegal ?? '',
          localidad: defaultValues.localidad ?? '',
          provincia: defaultValues.provincia ?? '',
          codigoPostal: defaultValues.codigoPostal ?? '',
          actividadPpal: defaultValues.actividadPpal ?? '',
          actividadSecundaria: defaultValues.actividadSecundaria ?? '',
          categoriaEnte:
            defaultValues.categoriaEnte ?? categoriaDesdeLegacy(defaultValues.clasificacionRT54),
          fechaInscripcion: toDateInputValue(defaultValues.fechaInscripcion),
          matriculaPJ: defaultValues.matriculaPJ ?? '',
          plazoDuracion: toDateInputValue(defaultValues.plazoDuracion),
          composicionCapital: defaultValues.composicionCapital ?? '',
        }
      : { tipoPersona: TipoPersona.JURIDICA },
  })

  // Actividades principales como lista dinámica (al menos una requerida)
  const [actPrincipales, setActPrincipales] = useState<string[]>(
    defaultValues?.actividadPpal ? defaultValues.actividadPpal.split('\n').filter(Boolean) : [''],
  )

  function addActPrincipal() {
    setActPrincipales((prev) => [...prev, ''])
  }

  function removeActPrincipal(idx: number) {
    if (actPrincipales.length <= 1) return
    setActPrincipales((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setValue('actividadPpal', next.join('\n'))
      return next
    })
  }

  function updateActPrincipal(idx: number, value: string) {
    setActPrincipales((prev) => {
      const next = [...prev]
      next[idx] = value
      setValue('actividadPpal', next.join('\n'))
      return next
    })
  }

  // Actividades secundarias como lista dinámica
  const [actSecundarias, setActSecundarias] = useState<string[]>(
    defaultValues?.actividadSecundaria
      ? defaultValues.actividadSecundaria.split('\n').filter(Boolean)
      : [],
  )

  function addActSecundaria() {
    setActSecundarias((prev) => [...prev, ''])
  }

  function removeActSecundaria(idx: number) {
    setActSecundarias((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setValue('actividadSecundaria', next.join('\n'))
      return next
    })
  }

  function updateActSecundaria(idx: number, value: string) {
    setActSecundarias((prev) => {
      const next = [...prev]
      next[idx] = value
      setValue('actividadSecundaria', next.join('\n'))
      return next
    })
  }

  // Campos estructurados para composición del capital (S.A.S.)
  function parseComposicion(raw: string | null | undefined) {
    if (!raw) return { cantidad: '', valorNominal: '', clase: '' }
    const m1 = raw.match(/^(\d+) acciones de Valor Nominal \$([^\s]+) c\/u/)
    const m2 = raw.match(/de la clase ([A-Z]+)/)
    return {
      cantidad: m1?.[1] ?? '',
      valorNominal: m1?.[2] ?? '',
      clase: m2?.[1] ?? '',
    }
  }

  const parsed = parseComposicion(defaultValues?.composicionCapital)
  const [accionesCantidad, setAccionesCantidad] = useState(parsed.cantidad)
  const [accionesValor, setAccionesValor] = useState(parsed.valorNominal)
  const [accionesClase, setAccionesClase] = useState(parsed.clase)

  function handleAccionesChange(cantidad: string, valor: string, clase: string) {
    setAccionesCantidad(cantidad)
    setAccionesValor(valor)
    setAccionesClase(clase)
    if (cantidad && valor && clase) {
      const texto = `${cantidad} acciones de Valor Nominal $${valor} c/u\nOrdinarias, nominativas, no endosables, de la clase ${clase}`
      setValue('composicionCapital', texto)
    } else {
      setValue('composicionCapital', '')
    }
  }

  const tipoPersona = useWatch({ control, name: 'tipoPersona' })
  const tipoSocietario = useWatch({ control, name: 'tipoSocietario' })
  const categoriaEnte = useWatch({ control, name: 'categoriaEnte' })
  const esFisica = tipoPersona === TipoPersona.FISICA
  const esSAS = tipoSocietario === 'S.A.S.'

  function onSubmit(values: CreateSociedadInput) {
    startTransition(async () => {
      const result =
        isEdit && defaultValues?.id
          ? await actualizarSociedad(defaultValues.id, values)
          : await crearSociedad(values)

      if (!result.ok) {
        toastError(result.error)
        return
      }

      toastSuccess(isEdit ? 'Cliente actualizado' : 'Cliente creado correctamente')
      router.push('/sociedades')
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Los datos del cliente se usan para generar la carátula y los encabezados de los estados
          contables.
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Identificación */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Identificación
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="tipoPersona">Tipo de cliente</Label>
              <Select
                id="tipoPersona"
                error={Boolean(errors.tipoPersona)}
                {...register('tipoPersona')}
              >
                <option value={TipoPersona.JURIDICA}>Persona jurídica</option>
                <option value={TipoPersona.FISICA}>Persona física</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="razonSocial">{esFisica ? 'Nombre y apellido' : 'Razón social'}</Label>
              <Input
                id="razonSocial"
                placeholder={esFisica ? 'Ej: García, Carlos Alberto' : 'Ej: GARCIA E HIJOS SRL'}
                error={Boolean(errors.razonSocial)}
                {...register('razonSocial')}
              />
              {errors.razonSocial && (
                <p className="text-xs text-red-600">{errors.razonSocial.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder={esFisica ? '20-12345678-9' : '30-12345678-9'}
                  error={Boolean(errors.cuit)}
                  {...register('cuit')}
                />
                {errors.cuit && <p className="text-xs text-red-600">{errors.cuit.message}</p>}
              </div>

              {esFisica ? (
                <div className="space-y-1.5">
                  <Label htmlFor="condicionFiscal">
                    Condición fiscal <span className="font-normal text-slate-400">(opcional)</span>
                  </Label>
                  <Select id="condicionFiscal" {...register('condicionFiscal')}>
                    <option value="">— Seleccionar —</option>
                    {CONDICION_FISCAL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="tipoSocietario">
                    Tipo societario <span className="font-normal text-slate-400">(opcional)</span>
                  </Label>
                  <Select id="tipoSocietario" {...register('tipoSocietario')}>
                    <option value="">— Seleccionar —</option>
                    {TIPO_SOCIETARIO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Domicilio */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Domicilio
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="domicilioLegal">
                {esFisica ? 'Domicilio fiscal' : 'Domicilio legal'}
              </Label>
              <Input
                id="domicilioLegal"
                placeholder="Av. Rivadavia 1234"
                error={Boolean(errors.domicilioLegal)}
                {...register('domicilioLegal')}
              />
              {errors.domicilioLegal && (
                <p className="text-xs text-red-600">{errors.domicilioLegal.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="localidad">Localidad</Label>
                <Input
                  id="localidad"
                  placeholder="Leones"
                  error={Boolean(errors.localidad)}
                  {...register('localidad')}
                />
                {errors.localidad && (
                  <p className="text-xs text-red-600">{errors.localidad.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="codigoPostal">CP</Label>
                <Input
                  id="codigoPostal"
                  placeholder="2594"
                  error={Boolean(errors.codigoPostal)}
                  {...register('codigoPostal')}
                />
                {errors.codigoPostal && (
                  <p className="text-xs text-red-600">{errors.codigoPostal.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="provincia">Provincia</Label>
              <Input
                id="provincia"
                placeholder="Córdoba"
                error={Boolean(errors.provincia)}
                {...register('provincia')}
              />
              {errors.provincia && (
                <p className="text-xs text-red-600">{errors.provincia.message}</p>
              )}
            </div>
          </div>

          {/* Actividad */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Actividad
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actividad principal</Label>
                <button
                  type="button"
                  onClick={addActPrincipal}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
              {actPrincipales.map((act, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={act}
                    onChange={(e) => updateActPrincipal(idx, e.target.value)}
                    placeholder="Ej: Venta al por menor de productos alimenticios"
                    error={idx === 0 && Boolean(errors.actividadPpal)}
                  />
                  {actPrincipales.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeActPrincipal(idx)}
                      className="flex-shrink-0 text-slate-400 transition-colors hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {errors.actividadPpal && (
                <p className="text-xs text-red-600">{errors.actividadPpal.message}</p>
              )}
              <input type="hidden" {...register('actividadPpal')} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Actividades secundarias{' '}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <button
                  type="button"
                  onClick={addActSecundaria}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
              {actSecundarias.length === 0 && (
                <p className="text-xs text-slate-400">Sin actividades secundarias.</p>
              )}
              {actSecundarias.map((act, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={act}
                    onChange={(e) => updateActSecundaria(idx, e.target.value)}
                    placeholder="Ej: Importación y distribución mayorista"
                  />
                  <button
                    type="button"
                    onClick={() => removeActSecundaria(idx)}
                    className="flex-shrink-0 text-slate-400 transition-colors hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <input type="hidden" {...register('actividadSecundaria')} />
            </div>
          </div>

          {/* Datos contables */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Datos contables
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
                  : 'Se usa como valor por defecto en los ejercicios nuevos y en las Notas I para identificar el tipo de entidad según RT 54.'}
              </p>
              {errors.categoriaEnte && (
                <p className="text-xs text-red-600">{errors.categoriaEnte.message}</p>
              )}
            </div>
          </div>

          {/* Datos registrales */}
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Datos registrales
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fechaInscripcion">
                  {esFisica ? 'Fecha de inicio de actividad' : 'Fecha de inscripción estatutaria'}
                </Label>
                <Input
                  id="fechaInscripcion"
                  type="date"
                  error={Boolean(errors.fechaInscripcion)}
                  {...register('fechaInscripcion')}
                />
                {errors.fechaInscripcion && (
                  <p className="text-xs text-red-600">{errors.fechaInscripcion.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="matriculaPJ">
                  {esFisica ? 'N° de matrícula' : 'Matrícula / IGJ / Pers. Jurídicas'}
                </Label>
                <Input
                  id="matriculaPJ"
                  placeholder={esFisica ? 'Mat. CP 12345' : 'Ej: 36281-A'}
                  error={Boolean(errors.matriculaPJ)}
                  {...register('matriculaPJ')}
                />
                {errors.matriculaPJ && (
                  <p className="text-xs text-red-600">{errors.matriculaPJ.message}</p>
                )}
              </div>
            </div>

            {!esFisica && (
              <div className="space-y-1.5">
                <Label htmlFor="plazoDuracion">Plazo de duración</Label>
                <Input
                  id="plazoDuracion"
                  type="date"
                  error={Boolean(errors.plazoDuracion)}
                  {...register('plazoDuracion')}
                />
                {errors.plazoDuracion && (
                  <p className="text-xs text-red-600">{errors.plazoDuracion.message}</p>
                )}
              </div>
            )}

            {esSAS && (
              <div className="space-y-3">
                <Label>Composición del capital</Label>

                {/* Helpers para autocompletar */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Cantidad de acciones</p>
                    <Input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={accionesCantidad}
                      onChange={(e) =>
                        handleAccionesChange(e.target.value, accionesValor, accionesClase)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Valor nominal c/u ($)</p>
                    <Input
                      placeholder="1759,74"
                      value={accionesValor}
                      onChange={(e) =>
                        handleAccionesChange(accionesCantidad, e.target.value, accionesClase)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Clase</p>
                    <Input
                      placeholder="B"
                      value={accionesClase}
                      onChange={(e) =>
                        handleAccionesChange(
                          accionesCantidad,
                          accionesValor,
                          e.target.value.toUpperCase(),
                        )
                      }
                    />
                  </div>
                </div>

                {/* Textarea editable — campo real que se guarda */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Texto en la carátula (editable)</p>
                  <textarea
                    rows={4}
                    className={`w-full resize-none rounded-md border px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.composicionCapital ? 'border-red-400' : 'border-slate-200'}`}
                    placeholder={
                      '100 acciones de Valor Nominal $1759,74 c/u\nOrdinarias, nominativas, no endosables, de la clase B'
                    }
                    {...register('composicionCapital')}
                  />
                </div>

                {errors.composicionCapital && (
                  <p className="text-xs text-red-600">{errors.composicionCapital.message}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
