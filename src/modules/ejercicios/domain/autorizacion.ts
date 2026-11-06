/**
 * Compuerta de autorización final del ejercicio (RT 54: estados comparativos obligatorios).
 *
 * Se evalúa antes de confirmar estados, confirmar el E.E.P.N. y pasar a Revisión/Cierre.
 * Devuelve bloqueantes (impiden autorizar) y advertencias (se informan, no bloquean),
 * con mensajes accionables. Puro: no toca la base.
 */

import type { CategoriaEnteRT54, EstadoEjercicio, TipoValidacion } from '@prisma/client'
import { formatCurrency } from '@/lib/utils/currency'
import { formatFecha } from '@/lib/utils/dates'
import type { ModoAnteriorEfectivo } from './ejercicioAnterior'
import { restar, sumar } from '@/lib/importe'

export type SeveridadItem = 'ERROR' | 'ADVERTENCIA'

export type ItemValidacion = {
  codigo: string
  tipo: TipoValidacion
  severidad: SeveridadItem
  mensaje: string
}

export type ContextoAutorizacion = {
  modo: ModoAnteriorEfectivo
  categoriaEnte: CategoriaEnteRT54 | null
  comparativoAutorizadoEn: Date | null
  fechaInicio: Date
  /** ejercicio anterior vinculado (solo VINCULADO) */
  anterior: {
    denominacion: string
    estado: EstadoEjercicio
    estadosConfirmado: boolean
    pnConfirmado: boolean
  } | null
  /** totales de la columna anterior del SSP (MANUAL) */
  cuadreAnterior: { activo: number; pasivo: number; patrimonioNeto: number } | null
  /** resultado del ejercicio anterior según EERR y según la columna anterior del E.E.P.N. */
  resultadoAnterior: { eerr: number; eepn: number } | null
  /** primera aplicación RT 54 */
  transicion: {
    esPrimeraAdopcion: boolean
    sumaAjustesMedicion: number
    modificacionInicioEEPN: number
  } | null
  /** datos de la sociedad para contrastar "primer ejercicio" */
  sociedad: { fechaInscripcion: Date | null } | null
  /** Estado de Flujo de Efectivo: control variación neta = suma de actividades */
  flujo: {
    lineas: number
    actual: CuadreFlujo
    /** null si no hay columna comparativa */
    anterior: CuadreFlujo | null
    /**
     * El RECPAM que calculó la app como diferencia, si está pendiente de revisión (null: revisado, o
     * el flujo no tiene línea de RECPAM).
     */
    recpamPendiente?: number | null
  } | null
}

export type CuadreFlujo = { variacionNeta: number; sumaActividades: number; cuadra: boolean }

export type ResultadoAutorizacion = {
  bloqueantes: ItemValidacion[]
  advertencias: ItemValidacion[]
  puedeAutorizar: boolean
}

/** Importe completo en los mensajes: la diferencia puede estar en el tercer decimal. */
const pesos = (n: number) => formatCurrency(n, { decimales: 'todos' })

function item(
  codigo: string,
  tipo: TipoValidacion,
  severidad: SeveridadItem,
  mensaje: string,
): ItemValidacion {
  return { codigo, tipo, severidad, mensaje }
}

export function validarAutorizacionFinal(ctx: ContextoAutorizacion): ResultadoAutorizacion {
  const bloqueantes: ItemValidacion[] = []
  const advertencias: ItemValidacion[] = []

  // ── Configuración básica ──────────────────────────────────────────────────
  if (ctx.modo === 'PENDIENTE') {
    bloqueantes.push(
      item(
        'AUT-001',
        'CONSISTENCIA_EJERCICIO',
        'ERROR',
        'Falta definir cómo se resuelve el ejercicio anterior (vinculado, carga manual o primer ejercicio). Configuralo en "Editar ejercicio".',
      ),
    )
  }
  if (!ctx.categoriaEnte) {
    bloqueantes.push(
      item(
        'AUT-002',
        'CONSISTENCIA_EJERCICIO',
        'ERROR',
        'Falta la categoría del ente según RT 54 (pequeña, mediana o restante). Definila en "Editar ejercicio".',
      ),
    )
  }

  // ── Escenario B: carga manual ─────────────────────────────────────────────
  if (ctx.modo === 'MANUAL') {
    if (!ctx.comparativoAutorizadoEn) {
      bloqueantes.push(
        item(
          'AUT-010',
          'CONSISTENCIA_EJERCICIO',
          'ERROR',
          'Los saldos del ejercicio anterior cargados manualmente no fueron autorizados. Revisalos y autorizalos en el paso "Ejercicio anterior".',
        ),
      )
    }
    if (ctx.cuadreAnterior) {
      const { activo, pasivo, patrimonioNeto } = ctx.cuadreAnterior
      const diferencia = restar(activo, pasivo, patrimonioNeto)
      if (diferencia !== 0) {
        bloqueantes.push(
          item(
            'AUT-011',
            'CUADRE_BALANCE',
            'ERROR',
            `El ejercicio anterior no cuadra: Activo ${pesos(activo)} contra Pasivo + Patrimonio Neto ${pesos(sumar(pasivo, patrimonioNeto))} (diferencia ${pesos(diferencia)}). Corregí la columna "Ejercicio anterior" del Estado de Situación Patrimonial o del E.E.P.N.`,
          ),
        )
      }
    }
    if (ctx.resultadoAnterior) {
      const { eerr, eepn } = ctx.resultadoAnterior
      if (restar(eerr, eepn) !== 0) {
        bloqueantes.push(
          item(
            'AUT-012',
            'PATRIMONIO_NETO',
            'ERROR',
            `El resultado del ejercicio anterior difiere entre el Estado de Resultados (${pesos(eerr)}) y la columna "Ejercicio anterior" del E.E.P.N. (${pesos(eepn)}). Tienen que coincidir.`,
          ),
        )
      }
    }
  }

  // ── Escenario A: vinculado ────────────────────────────────────────────────
  if (ctx.modo === 'VINCULADO') {
    if (!ctx.anterior) {
      bloqueantes.push(
        item(
          'AUT-020',
          'CONSISTENCIA_EJERCICIO',
          'ERROR',
          'El modo es "Vinculado" pero no hay un ejercicio anterior asociado. Elegilo en "Editar ejercicio".',
        ),
      )
    } else {
      if (ctx.anterior.estado === 'BORRADOR') {
        bloqueantes.push(
          item(
            'AUT-021',
            'CONSISTENCIA_EJERCICIO',
            'ERROR',
            `${ctx.anterior.denominacion} está en Borrador: sus saldos todavía no son definitivos. Iniciá y confirmá ese ejercicio antes de autorizar este.`,
          ),
        )
      }
      if (!ctx.anterior.estadosConfirmado || !ctx.anterior.pnConfirmado) {
        const faltan = [
          !ctx.anterior.estadosConfirmado ? 'los estados contables' : null,
          !ctx.anterior.pnConfirmado ? 'el E.E.P.N.' : null,
        ]
          .filter(Boolean)
          .join(' y ')
        bloqueantes.push(
          item(
            'AUT-022',
            'CONSISTENCIA_EJERCICIO',
            'ERROR',
            `${ctx.anterior.denominacion} no tiene confirmados ${faltan}. Los saldos de inicio de este ejercicio dependen de esos números.`,
          ),
        )
      }
    }
  }

  // ── Primer ejercicio: sin comparativo ─────────────────────────────────────
  if (ctx.modo === 'SIN_ANTERIOR') {
    const inscripcion = ctx.sociedad?.fechaInscripcion ?? null
    const unAnioAntes = new Date(ctx.fechaInicio.getTime() - 366 * 24 * 60 * 60 * 1000)
    if (inscripcion && inscripcion.getTime() < unAnioAntes.getTime()) {
      advertencias.push(
        item(
          'AUT-030',
          'CONSISTENCIA_EJERCICIO',
          'ADVERTENCIA',
          `La sociedad está inscripta desde el ${formatFecha(inscripcion)}, más de un año antes del inicio de este ejercicio (${formatFecha(ctx.fechaInicio)}). "Primer ejercicio" solo corresponde si no existieron ejercicios previos; si los hubo, cargá sus saldos en modo manual.`,
        ),
      )
    } else {
      advertencias.push(
        item(
          'AUT-031',
          'CONSISTENCIA_EJERCICIO',
          'ADVERTENCIA',
          'Este ejercicio se presenta sin información comparativa por ser el primero de la sociedad. Los estados contables lo indicarán expresamente.',
        ),
      )
    }
  }

  // ── Primera aplicación RT 54 ──────────────────────────────────────────────
  if (ctx.transicion?.esPrimeraAdopcion) {
    const { sumaAjustesMedicion, modificacionInicioEEPN } = ctx.transicion
    if (restar(sumaAjustesMedicion, modificacionInicioEEPN) !== 0) {
      advertencias.push(
        item(
          'AUT-040',
          'PATRIMONIO_NETO',
          'ADVERTENCIA',
          `La suma de los ajustes de medición de la Nota de transición (${pesos(sumaAjustesMedicion)}) no coincide con la fila "Modificación de saldos al inicio" del E.E.P.N. (${pesos(modificacionInicioEEPN)}). Si la diferencia no es transición RT 54 (por ejemplo, corrección de errores), documentala en la nota.`,
        ),
      )
    }
  }

  // ── Estado de Flujo de Efectivo ───────────────────────────────────────────
  if (ctx.flujo) {
    const { lineas, actual, anterior } = ctx.flujo
    if (lineas === 0) {
      advertencias.push(
        item(
          'AUT-052',
          'CONSISTENCIA_EJERCICIO',
          'ADVERTENCIA',
          'No hay Estado de Flujo de Efectivo cargado. Es un estado básico obligatorio: completalo en Estados → Flujo de efectivo.',
        ),
      )
    } else {
      if (!actual.cuadra) {
        bloqueantes.push(
          item(
            'AUT-050',
            'CUADRE_BALANCE',
            'ERROR',
            `El Estado de Flujo de Efectivo no cuadra: según el balance el efectivo varió ${pesos(actual.variacionNeta)}, pero las actividades suman ${pesos(actual.sumaActividades)} (diferencia ${pesos(restar(actual.variacionNeta, actual.sumaActividades))}). Revisá las líneas en Estados → Flujo de efectivo.`,
          ),
        )
      }
      const recpam = ctx.flujo.recpamPendiente
      if (recpam !== null && recpam !== undefined) {
        bloqueantes.push(
          item(
            'AUT-053',
            'CUADRE_BALANCE',
            'ERROR',
            `El RECPAM del Estado de Flujo de Efectivo está pendiente de revisión: la app lo calculó como la diferencia para que el estado cierre (${pesos(recpam)}), y esa diferencia puede esconder un error de otra línea. Revisalo en Estados → Flujo de efectivo y tocá "Revisado".`,
          ),
        )
      }
      if (anterior && !anterior.cuadra) {
        advertencias.push(
          item(
            'AUT-051',
            'CUADRE_BALANCE',
            'ADVERTENCIA',
            `La columna "Ejercicio anterior" del Estado de Flujo de Efectivo no cuadra: el efectivo varió ${pesos(anterior.variacionNeta)} y las actividades suman ${pesos(anterior.sumaActividades)}.`,
          ),
        )
      }
    }
  }

  return { bloqueantes, advertencias, puedeAutorizar: bloqueantes.length === 0 }
}
