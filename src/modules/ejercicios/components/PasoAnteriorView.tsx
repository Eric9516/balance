'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Link2,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import type { EstadoEjercicio } from '@prisma/client'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMontado } from '@/components/shared/useMontado'
import { useGuardarAccion } from '@/components/shared/useGuardarAccion'
import { toastSuccess } from '@/modules/errores/components/Toast'
import { autorizarComparativoAction } from '../actions/ejercicio.actions'
import type { ModoAnteriorEfectivo } from '../domain/ejercicioAnterior'
import type { ItemValidacion } from '../domain/autorizacion'
import type { BloqueComparativo } from '../lib/bloquesComparativo'
import { ESTADO_BADGE_VARIANTS, ESTADO_LABELS, type EjercicioContableDTO } from '../domain/types'
import { restar } from '@/lib/importe'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AnteriorResumen = {
  id: string
  denominacion: string
  fechaCierre: Date
  estado: EstadoEjercicio
  estadosConfirmado: boolean
  pnConfirmado: boolean
}

interface Props {
  ejercicio: EjercicioContableDTO
  sociedadId: string
  modo: ModoAnteriorEfectivo
  anterior: AnteriorResumen | null
  coeficiente: number
  fechaCierreAnterior: Date | null
  bloques: BloqueComparativo[]
  cuadre: { activo: number; pasivo: number; patrimonioNeto: number; diferencia: number }
  resultadoAnterior: { eerr: number; eepn: number }
  evaluacion: {
    bloqueantes: ItemValidacion[]
    advertencias: ItemValidacion[]
    puedeAutorizar: boolean
  }
  auditorNombre: string | null
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

function Seccion({
  titulo,
  children,
  accion,
}: {
  titulo: string
  children: React.ReactNode
  accion?: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{titulo}</h3>
        {accion}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function ListaValidaciones({
  bloqueantes,
  advertencias,
}: {
  bloqueantes: ItemValidacion[]
  advertencias: ItemValidacion[]
}) {
  if (bloqueantes.length === 0 && advertencias.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
        Sin condiciones pendientes: los estados pueden confirmarse.
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {bloqueantes.map((b) => (
        <li
          key={b.codigo}
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <span>{b.mensaje}</span>
        </li>
      ))}
      {advertencias.map((a) => (
        <li
          key={a.codigo}
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <span>{a.mensaje}</span>
        </li>
      ))}
    </ul>
  )
}

function Importe({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        'font-mono text-sm tabular-nums',
        value < 0 ? 'text-red-600' : 'text-slate-800',
        strong && 'font-semibold',
      )}
    >
      {formatCurrency(value)}
    </span>
  )
}

// ─── Modal de autorización ────────────────────────────────────────────────────

function ModalAutorizar({
  open,
  onClose,
  onConfirm,
  nombreInicial,
  fechaCierreAnterior,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (nombre: string) => void
  nombreInicial: string
  fechaCierreAnterior: Date | null
  isPending: boolean
}) {
  const mounted = useMontado()
  const [nombre, setNombre] = useState(nombreInicial)
  const [acepto, setAcepto] = useState(false)
  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-6 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Autorizar saldos del ejercicio anterior
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-2">
          <p className="text-sm text-slate-600">
            Declaro que los importes cargados en la columna &quot;Ejercicio anterior&quot; de los
            estados, anexos y notas corresponden a los estados contables de la sociedad al{' '}
            <strong>{formatFecha(fechaCierreAnterior, 'cierre del ejercicio anterior')}</strong>, y
            que fueron revisados para su presentación comparativa según la RT 54.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="autorizadoPor" className="text-xs font-medium text-slate-600">
              Autoriza
            </label>
            <input
              id="autorizadoPor"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del profesional"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            Revisé los importes y asumo la declaración anterior.
          </label>
          <p className="text-xs text-slate-400">
            Queda registrado con fecha y hora. Cualquier cambio posterior en la columna
            &quot;Ejercicio anterior&quot; anula esta autorización.
          </p>
        </div>
        <div className="flex justify-end gap-2.5 px-6 py-5">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(nombre)}
            disabled={isPending || !acepto || !nombre.trim()}
          >
            {isPending ? 'Autorizando...' : 'Autorizar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export function PasoAnteriorView({
  ejercicio,
  sociedadId,
  modo,
  anterior,
  coeficiente,
  fechaCierreAnterior,
  bloques,
  cuadre,
  resultadoAnterior,
  evaluacion,
  auditorNombre,
}: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const { isPending, ejecutar } = useGuardarAccion()
  const editarHref = `/sociedades/${sociedadId}/ejercicios/${ejercicio.id}/editar`
  const autorizado = ejercicio.comparativoAutorizadoEn !== null

  function autorizar(nombre: string) {
    ejecutar(
      () => autorizarComparativoAction(ejercicio.id, sociedadId, nombre),
      () => {
        setModalOpen(false)
        toastSuccess('Saldos del ejercicio anterior autorizados')
        router.refresh()
      },
    )
  }

  // ── PENDIENTE ─────────────────────────────────────────────────────────────
  if (modo === 'PENDIENTE') {
    return (
      <div className="max-w-3xl space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Falta definir el ejercicio anterior
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                La RT 54 exige presentar los estados contables en forma comparativa. Elegí cómo se
                resuelve el ejercicio anterior para habilitar la columna comparativa y los saldos de
                inicio.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Link2,
                titulo: 'Vincular',
                texto:
                  'El ejercicio anterior ya está cargado en el sistema. Todo se arrastra solo.',
              },
              {
                icon: PenLine,
                titulo: 'Carga manual',
                texto: 'No está en el sistema. Cargás los saldos del año anterior y los autorizás.',
              },
              {
                icon: Sparkles,
                titulo: 'Primer ejercicio',
                texto: 'La sociedad no tuvo ejercicios previos. No hay comparativo.',
              },
            ].map((o) => (
              <div key={o.titulo} className="rounded-xl border border-slate-200 bg-white p-4">
                <o.icon className="h-4 w-4 text-blue-600" />
                <p className="mt-2 text-sm font-semibold text-slate-800">{o.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{o.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <Button asChild>
              <Link href={editarHref}>
                Configurar en Editar ejercicio
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Encabezado común ──────────────────────────────────────────────────────
  const encabezado = {
    VINCULADO: {
      icon: Link2,
      titulo: 'Ejercicio anterior vinculado',
      texto:
        'Los saldos de inicio y la columna comparativa se toman del ejercicio anterior y quedan bloqueados.',
    },
    MANUAL: {
      icon: PenLine,
      titulo: 'Configurar saldos de inicio del ejercicio anterior',
      texto:
        'Requisito comparativo RT 54. Cargá los importes del ejercicio anterior en cada estado, anexo y nota, verificá el cuadre y autorizalos.',
    },
    SIN_ANTERIOR: {
      icon: Sparkles,
      titulo: 'Primer ejercicio de la sociedad',
      texto:
        'Los estados se presentan sin información comparativa. Los estados lo indican expresamente.',
    },
  }[modo]

  const Icono = encabezado.icon

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Icono className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{encabezado.titulo}</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">{encabezado.texto}</p>
            {modo === 'MANUAL' && autorizado && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Autorizado por {ejercicio.comparativoAutorizadoPor} el{' '}
                {formatFecha(ejercicio.comparativoAutorizadoEn)}
              </p>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href={editarHref}>Cambiar</Link>
        </Button>
      </div>

      {/* ── VINCULADO ──────────────────────────────────────────────────────── */}
      {modo === 'VINCULADO' && (
        <Seccion titulo="Ejercicio vinculado">
          {anterior ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">
                  {anterior.denominacion}
                </span>
                <Badge variant={ESTADO_BADGE_VARIANTS[anterior.estado]}>
                  {ESTADO_LABELS[anterior.estado]}
                </Badge>
                <span className="font-mono text-xs text-slate-500">
                  cierre {formatFecha(anterior.fechaCierre)}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  coeficiente {coeficiente.toFixed(4)}
                </span>
                <Link
                  href={`/sociedades/${sociedadId}/ejercicios/${anterior.id}/cuentas?paso=estados`}
                  className="text-xs text-blue-600 underline-offset-2 hover:underline"
                >
                  Abrir ejercicio anterior
                </Link>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Estados contables del anterior', anterior.estadosConfirmado],
                  ['E.E.P.N. del anterior', anterior.pnConfirmado],
                ].map(([label, ok]) => (
                  <li
                    key={String(label)}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300" />
                    )}
                    {label} {ok ? 'confirmados' : 'sin confirmar'}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Lock className="h-3.5 w-3.5" /> Qué se arrastra y bloquea
                </p>
                <ul className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <li>Saldos al inicio del E.E.P.N. por componente</li>
                  <li>Columna &quot;Ejercicio anterior&quot; de estados, gastos y E.E.P.N.</li>
                  <li>Valor y amortización al comienzo en Bienes de Uso</li>
                  <li>Existencia inicial en Costo de Ventas</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700">
              No hay un ejercicio anterior asociado. Elegilo en &quot;Editar ejercicio&quot;.
            </p>
          )}
        </Seccion>
      )}

      {/* ── MANUAL ─────────────────────────────────────────────────────────── */}
      {modo === 'MANUAL' && (
        <>
          <Seccion titulo="Carga por bloque">
            <ul className="divide-y divide-slate-100">
              {bloques.map((b) => {
                const completo = b.aplica && b.total > 0 && b.cargados >= b.total
                return (
                  <li key={b.clave} className="flex items-center gap-3 py-2.5">
                    {!b.aplica ? (
                      <Circle className="h-4 w-4 flex-shrink-0 text-slate-200" />
                    ) : completo ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', b.aplica ? 'text-slate-800' : 'text-slate-400')}>
                        {b.label}
                      </p>
                      <p className="text-xs text-slate-400">{b.descripcion}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {b.aplica ? `${b.cargados}/${b.total}` : 'no aplica'}
                    </span>
                    {b.aplica && (
                      <Link
                        href={b.href}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Cargar <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </Seccion>

          <Seccion
            titulo={`Cuadre del ejercicio anterior (${formatFecha(fechaCierreAnterior, 'cierre anterior')})`}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ['Activo', cuadre.activo],
                ['Pasivo', cuadre.pasivo],
                ['Patrimonio neto', cuadre.patrimonioNeto],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-200 px-4 py-3">
                  <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    {label}
                  </p>
                  <Importe value={Number(value)} />
                </div>
              ))}
              <div
                className={cn(
                  'rounded-lg border px-4 py-3',
                  Math.abs(cuadre.diferencia) < 0.01
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50',
                )}
              >
                <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  Diferencia
                </p>
                <Importe value={cuadre.diferencia} strong />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>
                Resultado anterior según EERR: <Importe value={resultadoAnterior.eerr} />
              </span>
              <span>
                según E.E.P.N.: <Importe value={resultadoAnterior.eepn} />
              </span>
              {Math.abs(restar(resultadoAnterior.eerr, resultadoAnterior.eepn)) < 0.01 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> coinciden
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> no coinciden
                </span>
              )}
            </div>
          </Seccion>
        </>
      )}

      {/* ── Compuerta ──────────────────────────────────────────────────────── */}
      <Seccion
        titulo="Condiciones para confirmar los estados"
        accion={
          modo === 'MANUAL' && !autorizado ? (
            <Button size="sm" onClick={() => setModalOpen(true)} disabled={isPending}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              Autorizar saldos del ejercicio anterior
            </Button>
          ) : null
        }
      >
        <ListaValidaciones
          bloqueantes={evaluacion.bloqueantes}
          advertencias={evaluacion.advertencias}
        />
      </Seccion>

      <ModalAutorizar
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={autorizar}
        nombreInicial={auditorNombre ?? ''}
        fechaCierreAnterior={fechaCierreAnterior}
        isPending={isPending}
      />
    </div>
  )
}
