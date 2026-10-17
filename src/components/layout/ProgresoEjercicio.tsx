import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type EstadoPaso = 'completado' | 'activo' | 'pendiente' | 'bloqueado'

interface Paso {
  pasoKey: string
  label: string
  descripcion: string
  estado: EstadoPaso
  href?: string
}

function PasoItem({
  paso,
  esUltimo,
  esActivo,
}: {
  paso: Paso
  esUltimo: boolean
  esActivo: boolean
}) {
  const iconos: Record<EstadoPaso, React.ReactNode> = {
    completado: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    activo: (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-600">
        <span className="h-2 w-2 rounded-full bg-blue-600" />
      </span>
    ),
    pendiente: <Circle className="h-5 w-5 text-slate-300" />,
    bloqueado: <Lock className="h-4 w-4 text-slate-300" />,
  }

  const labelColor: Record<EstadoPaso, string> = {
    completado: 'text-emerald-700',
    activo: 'text-blue-700',
    pendiente: 'text-slate-400',
    bloqueado: 'text-slate-300',
  }

  const inner = (
    <div className="flex flex-col items-center text-center gap-1 min-w-0">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0',
          paso.estado === 'completado' && 'border-emerald-200 bg-emerald-50',
          paso.estado === 'activo' && 'border-blue-200 bg-blue-50',
          paso.estado === 'pendiente' && 'border-slate-200 bg-white',
          paso.estado === 'bloqueado' && 'border-slate-100 bg-white',
          esActivo && 'ring-2 ring-offset-1 ring-blue-400',
        )}
      >
        {iconos[paso.estado]}
      </div>
      <span className={cn('text-xs font-semibold leading-tight', labelColor[paso.estado])}>
        {paso.label}
      </span>
      <span
        className={cn(
          'text-[10px] leading-tight',
          paso.estado === 'bloqueado' ? 'text-slate-300' : 'text-slate-400',
        )}
      >
        {paso.descripcion}
      </span>
    </div>
  )

  return (
    <div className="flex items-start gap-0 flex-1 min-w-0">
      <div className="flex-1 min-w-0 px-2">
        {paso.href && paso.estado !== 'bloqueado' ? (
          <Link href={paso.href} className="block hover:opacity-75 transition-opacity">
            {inner}
          </Link>
        ) : (
          inner
        )}
      </div>

      {!esUltimo && (
        <div className="flex-shrink-0 w-4 mt-4 flex items-center">
          <div
            className={cn(
              'h-px w-full',
              paso.estado === 'completado' ? 'bg-emerald-200' : 'bg-slate-200',
            )}
          />
        </div>
      )}
    </div>
  )
}

interface Props {
  sociedadId: string
  ejercicioId: string
  totalCuentas: number
  sinClasificar: number
  pasoActivo?: string
  tieneNotas?: boolean
  tieneEjercicioAnterior?: boolean
  pnConfirmado?: boolean
  estadosConfirmado?: boolean
  anexosAceptados?: number
  anexosCompletos?: boolean
  requiereComparativoManual?: boolean
}

export function ProgresoEjercicio({
  sociedadId,
  ejercicioId,
  totalCuentas,
  sinClasificar,
  pasoActivo,
  tieneNotas = false,
  tieneEjercicioAnterior = false,
  pnConfirmado = false,
  estadosConfirmado = false,
  anexosAceptados = 0,
  anexosCompletos = false,
  requiereComparativoManual = false,
}: Props) {
  const base = `/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`
  const balanceImportado = totalCuentas > 0
  const todoClasificado = balanceImportado && sinClasificar === 0
  const pasoActivoResuelto = pasoActivo ?? 'balance'

  function estadoPaso(pasoKey: string, disponible: boolean, completado = false): EstadoPaso {
    if (completado) return 'completado'
    if (!disponible) return 'bloqueado'
    return pasoKey === pasoActivoResuelto ? 'activo' : 'pendiente'
  }

  const pasos: Paso[] = [
    {
      pasoKey: 'caratula',
      label: 'Carátula',
      descripcion: 'Datos del ejercicio',
      estado: estadoPaso('caratula', true, true),
      href: `${base}?paso=caratula`,
    },
    {
      pasoKey: 'balance',
      label: 'Balance',
      descripcion: balanceImportado ? `${totalCuentas} cuentas` : 'Sin importar',
      estado: balanceImportado ? estadoPaso('balance', true, true) : estadoPaso('balance', true),
      href: balanceImportado
        ? base
        : `/sociedades/${sociedadId}/ejercicios/${ejercicioId}/importar`,
    },
    {
      pasoKey: 'clasificar',
      label: 'Clasificar',
      descripcion: !balanceImportado
        ? 'Esperando balance'
        : todoClasificado
          ? 'Todas clasificadas'
          : `${sinClasificar} pendientes`,
      estado: !balanceImportado
        ? 'bloqueado'
        : todoClasificado
          ? estadoPaso('clasificar', true, true)
          : estadoPaso('clasificar', true),
      href: balanceImportado ? `${base}?paso=clasificar` : undefined,
    },
    {
      pasoKey: 'anexos',
      label: 'Anexos',
      descripcion: anexosAceptados > 0
        ? (anexosCompletos ? `${anexosAceptados} cargados` : `${anexosAceptados} aceptados`)
        : 'Aceptá en el paso anterior',
      estado: estadoPaso('anexos', balanceImportado, anexosAceptados > 0 && anexosCompletos),
      href: balanceImportado ? `${base}?paso=anexos` : undefined,
    },
    {
      pasoKey: 'notas',
      label: 'Notas',
      descripcion: tieneNotas ? 'Generadas' : 'Composición de rubros',
      estado: estadoPaso('notas', balanceImportado, tieneNotas),
      href: balanceImportado ? `${base}?paso=notas` : undefined,
    },
    {
      pasoKey: 'patrimonio-neto',
      label: 'Evolución PN',
      descripcion: pnConfirmado ? 'Confirmado' : 'Patrimonio Neto',
      estado: estadoPaso('patrimonio-neto', todoClasificado, pnConfirmado),
      href: todoClasificado ? `${base}?paso=patrimonio-neto` : undefined,
    },
    {
      pasoKey: 'estados',
      label: 'Estados',
      descripcion: estadosConfirmado ? 'Confirmado' : todoClasificado ? 'Pendiente confirmación' : 'Requiere clasificar',
      estado: estadoPaso('estados', todoClasificado, estadosConfirmado),
      href: todoClasificado ? `${base}?paso=estados` : undefined,
    },
  ]

  return (
    <div className="mb-6 space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
        <div className="flex items-start overflow-x-auto py-1">
          {pasos.map((paso, i) => (
            <PasoItem
              key={paso.pasoKey}
              paso={paso}
              esUltimo={i === pasos.length - 1}
              esActivo={paso.pasoKey === pasoActivoResuelto}
            />
          ))}
        </div>
      </div>

      {!tieneEjercicioAnterior && !requiereComparativoManual && balanceImportado && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>Sin ejercicio anterior vinculado</strong> - los estados, notas y anexos no mostrarán columna comparativa.
            Vinculá el ejercicio anterior desde{' '}
            <Link
              href={`/sociedades/${sociedadId}/ejercicios`}
              className="underline hover:text-amber-900"
            >
              Ejercicios
            </Link>
            .
          </p>
        </div>
      )}

      {requiereComparativoManual && balanceImportado && (
        <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Sin balance anterior importado</strong> - completá los importes del ejercicio anterior
            directamente en la columna <em>&quot;Ejercicio Anterior&quot;</em> de cada anexo, nota y estado.
            Podés agregar filas para clasificaciones que el ejercicio actual no tiene.
          </p>
        </div>
      )}
    </div>
  )
}
