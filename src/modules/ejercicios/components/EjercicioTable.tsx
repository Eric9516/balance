import Link from 'next/link'
import {
  AlertTriangle,
  Link2,
  Pencil,
  PenLine,
  Sparkles,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EjercicioEstadoButton } from './EjercicioEstadoButton'
import { EjercicioEliminarButton } from './EjercicioEliminarButton'
import {
  CATEGORIA_ENTE_LABELS,
  ESTADO_LABELS,
  ESTADO_BADGE_VARIANTS,
  type EjercicioContableDTO,
} from '../domain/types'
import { formatFecha } from '@/lib/utils/dates'

interface EjercicioTableProps {
  ejercicios: EjercicioContableDTO[]
  sociedadId: string
}

// ─── Chip del modo del ejercicio anterior ────────────────────────────────────

function Chip({
  icon: Icon,
  tono = 'neutro',
  children,
}: {
  icon: LucideIcon
  tono?: 'neutro' | 'atencion'
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
        tono === 'atencion'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-500',
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  )
}

function ChipModoAnterior({ ejercicio }: { ejercicio: EjercicioContableDTO }) {
  switch (ejercicio.modoAnterior) {
    case 'VINCULADO':
      return <Chip icon={Link2}>Vinculado</Chip>
    case 'MANUAL':
      return (
        <Chip icon={PenLine}>
          Saldos manuales{ejercicio.comparativoAutorizadoEn != null ? ' · autorizado' : ''}
        </Chip>
      )
    case 'SIN_ANTERIOR':
      return <Chip icon={Sparkles}>Primer ejercicio</Chip>
    default:
      return (
        <Chip icon={AlertTriangle} tono="atencion">
          Ejercicio anterior sin definir
        </Chip>
      )
  }
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

export function EjercicioTable({ ejercicios, sociedadId }: EjercicioTableProps) {
  if (ejercicios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-slate-500">No hay ejercicios contables.</p>
        <p className="mt-1 text-xs text-slate-400">
          Creá el primero usando el botón &quot;Nuevo ejercicio&quot;.
        </p>
      </div>
    )
  }

  // Ejercicios vienen ordenados por fechaCierre DESC (más reciente primero).
  // Si e.ejercicioAnteriorId === siguiente.id → están vinculados en cadena.
  const idMap = new Map(ejercicios.map((e) => [e.id, e]))

  return (
    <div>
      {ejercicios.map((e, i) => {
        const next = ejercicios[i + 1]
        const isLinkedToNext = next != null && e.ejercicioAnteriorId === next.id

        // Vínculo a un ejercicio que existe en la lista pero no es el siguiente (caso raro)
        const linkedNonAdjacent =
          e.ejercicioAnteriorId && !isLinkedToNext
            ? (idMap.get(e.ejercicioAnteriorId) ?? null)
            : null

        const categoriaLabel = e.categoriaEnte
          ? CATEGORIA_ENTE_LABELS[e.categoriaEnte]
          : e.clasificacionEntidad

        return (
          <div key={e.id}>
            {/* ── Card del ejercicio ─────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
              {/* Nombre + período + detalles */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{e.denominacion}</span>
                  {e.numeroEjercicio != null && (
                    <span className="font-mono text-xs text-slate-400">#{e.numeroEjercicio}</span>
                  )}
                  <ChipModoAnterior ejercicio={e} />
                  {linkedNonAdjacent && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                      <Link2 className="h-2.5 w-2.5" />
                      anterior: {linkedNonAdjacent.denominacion}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-slate-500">
                    {formatFecha(e.fechaInicio)}
                    <span className="mx-1 text-slate-300">→</span>
                    {formatFecha(e.fechaCierre)}
                  </span>
                  {categoriaLabel && (
                    <span className="text-xs text-slate-400">{categoriaLabel}</span>
                  )}
                  {e.auditorNombre && (
                    <span className="text-xs text-slate-400">{e.auditorNombre}</span>
                  )}
                </div>
              </div>

              {/* Estado + acciones */}
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Badge variant={ESTADO_BADGE_VARIANTS[e.estado]}>{ESTADO_LABELS[e.estado]}</Badge>

                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/sociedades/${sociedadId}/ejercicios/${e.id}/cuentas`}>
                    <Table2 className="mr-1 h-3.5 w-3.5" />
                    Cuentas
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/sociedades/${sociedadId}/ejercicios/${e.id}/editar`}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Link>
                </Button>

                {e.estado === 'BORRADOR' && (
                  <>
                    <EjercicioEstadoButton
                      id={e.id}
                      sociedadId={sociedadId}
                      estadoActual="BORRADOR"
                      nuevoEstado="EN_PROCESO"
                      label="Iniciar"
                    />
                    <EjercicioEliminarButton id={e.id} sociedadId={sociedadId} />
                  </>
                )}

                {e.estado === 'EN_PROCESO' && (
                  <EjercicioEstadoButton
                    id={e.id}
                    sociedadId={sociedadId}
                    estadoActual="EN_PROCESO"
                    nuevoEstado="REVISION"
                    label="A revisión"
                  />
                )}

                {e.estado === 'REVISION' && (
                  <>
                    <EjercicioEstadoButton
                      id={e.id}
                      sociedadId={sociedadId}
                      estadoActual="REVISION"
                      nuevoEstado="CERRADO"
                      label="Cerrar"
                      variant="default"
                    />
                    <EjercicioEstadoButton
                      id={e.id}
                      sociedadId={sociedadId}
                      estadoActual="REVISION"
                      nuevoEstado="EN_PROCESO"
                      label="Reabrir"
                      variant="ghost"
                    />
                  </>
                )}
              </div>
            </div>

            {/* ── Conector entre ejercicios vinculados ───────────────────── */}
            {isLinkedToNext && (
              <div className="flex items-stretch gap-0 py-0 pl-6">
                {/* línea vertical con flecha */}
                <div className="flex w-5 flex-col items-center">
                  <div className="w-px flex-1 bg-slate-300" />
                </div>
                {/* label */}
                <div className="flex items-center gap-1.5 py-1.5 pl-1.5">
                  <Link2 className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">toma como ejercicio anterior ↓</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
