/**
 * El contador simulado: hace el balance de un escenario de punta a punta con las mismas acciones
 * que usan las pantallas. Tipea solo lo que la app todavía no sabe (como haría un contador) y anota
 * cada dato tipeado; así el informe muestra qué se pidió dos veces y qué se podría autocompletar.
 */
import { restar, sumarPor } from '@/lib/importe'
import { iguales } from './registro'
import { crearSociedad } from '@/modules/sociedades/actions/sociedad.actions'
import {
  autorizarComparativoAction,
  avanzarEstadoEjercicio,
  crearEjercicio,
} from '@/modules/ejercicios/actions/ejercicio.actions'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { confirmarImportacionManual } from '@/modules/importaciones/actions/importacion.actions'
import { asignarRubrosBulkAction } from '@/modules/importaciones/actions/clasificacion.actions'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import {
  aceptarDocumentoAction,
  descartarDocumentoAction,
} from '@/modules/documentos/actions/documento.actions'
import {
  actualizarDetalleAction,
  crearDetalleAction,
  generarNotasAutomaticasAction,
  guardarConfigNotaIAction,
} from '@/modules/notas/actions/notas.actions'
import { cargarNotas } from '@/modules/notas/services/notas.service'
import {
  crearBienDeUsoAction,
  guardarLoteBienesAction,
} from '@/modules/bienes-de-uso/actions/bienes-de-uso.actions'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'
import { guardarTodoCostoVentasAction } from '@/modules/costo-ventas/actions/costo-ventas.actions'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { guardarLoteComparativoAction } from '@/modules/comparativo-manual/actions/comparativo.actions'
import { buildClaveHuerfano } from '@/modules/comparativo-manual/domain/types'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import {
  claveFilaAnterior,
  claveFilaAnteriorEnSeccion,
  filasAnexoGastos,
} from '@/modules/gastos/domain/filasAnexo'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { confirmarEstadosAction } from '@/modules/estados/actions/estados.actions'
import {
  confirmarPNAction,
  guardarEvolucionPNAction,
} from '@/modules/patrimonio-neto/actions/patrimonio-neto.actions'
import { PN_MOVIMIENTOS, type EvolucionPNInput } from '@/modules/patrimonio-neto/domain/types'
import { crearAjusteTransicionAction } from '@/modules/transicion-rt54/actions/ajustes.actions'
import {
  crearItemFlujoAction,
  guardarFlujoAction,
  traerConceptosAnteriorAction,
} from '@/modules/flujo-efectivo/actions/flujo.actions'
import { findFlujo } from '@/modules/flujo-efectivo/repository/flujo.repository'
import type { Escenario, MovimientoPN } from './referencia'
import type { Registro } from './registro'

/** Datos que son el mismo número aunque se tipeen en pantallas distintas. */
const DATO_EXISTENCIA_ANTERIOR = 'existencia final de bienes de cambio del año anterior'
const DATO_AJUSTE_RT54 = 'ajuste de transición RT 54 a resultados no asignados'

type Resultado<T> =
  { ok: true; data: T } | { ok: false; error: { codigo: string; mensaje: string } }

export type Contexto = {
  reg: Registro
  auditorId: string
  /** código de rubro → id, y al revés */
  rubroId: Map<string, string>
  rubroCodigo: Map<string, string>
  /** Ejercicio y sociedad de cada escenario ya simulado. */
  hechos: Map<string, { sociedadId: string; ejercicioId: string }>
}

/** Corre una acción y anota el paso. Devuelve los datos o null si falló. */
async function accion<T>(
  ctx: Contexto,
  esc: string,
  nombre: string,
  correr: () => Promise<Resultado<T>>,
): Promise<T | null> {
  try {
    const r = await correr()
    if (r.ok) {
      ctx.reg.paso(esc, nombre, true)
      return r.data
    }
    ctx.reg.paso(esc, nombre, false, `${r.error.codigo}: ${r.error.mensaje}`)
  } catch (e) {
    ctx.reg.paso(esc, nombre, false, `Excepción: ${e instanceof Error ? e.message : String(e)}`)
  }
  return null
}

/** CUIT con dígito verificador válido a partir de 10 dígitos (si da 10, prueba el siguiente). */
export function cuitValido(base: string): string {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  for (let n = Number(base); ; n++) {
    const b = String(n)
    const suma = pesos.reduce((s, p, i) => s + p * Number(b[i]), 0)
    const dv = (11 - (suma % 11)) % 11
    if (dv !== 10) return `${b}${dv}`
  }
}

async function estados(ejercicio: EjercicioContableDTO) {
  return cargarEstadosConPN(ejercicio, await findCuentasByEjercicio(ejercicio.id))
}

// ─── Escenario completo ───────────────────────────────────────────────────────

export async function simular(ctx: Contexto, esc: Escenario): Promise<string | null> {
  const { reg } = ctx
  const id = esc.id
  const tipear = (pantalla: string, concepto: string, valor: number, dato?: string) =>
    reg.entrada(id, pantalla, concepto, valor, dato)

  // 1. Sociedad (la del escenario C es la misma de B).
  let sociedadId = esc.id === 'C' ? ctx.hechos.get('B')?.sociedadId : undefined
  if (!sociedadId) {
    const sociedad = await accion(ctx, id, 'Crear la sociedad', () =>
      crearSociedad({
        razonSocial: esc.sociedad.razonSocial,
        cuit: cuitValido(esc.sociedad.cuitBase),
        tipoPersona: 'JURIDICA',
        tipoSocietario: 'S.A.S.',
        domicilioLegal: 'Av. Colón 1234',
        localidad: 'Córdoba',
        provincia: 'Córdoba',
        codigoPostal: '5000',
        actividadPpal: esc.sociedad.actividad,
        categoriaEnte: 'PEQUENA',
        fechaInscripcion: esc.sociedad.inscripcion,
        matriculaPJ: '12345-A',
        plazoDuracion: '2117-03-01',
        composicionCapital: 'Capital social suscripto e integrado',
      }),
    )
    sociedadId = sociedad?.id
  }
  if (!sociedadId) return null
  const soc = sociedadId

  // 2. Ejercicio.
  const anteriorId = esc.ejercicio.modo === 'VINCULADO' ? ctx.hechos.get('B')?.ejercicioId : ''
  const creado = await accion(ctx, id, 'Crear el ejercicio', () =>
    crearEjercicio(soc, {
      fechaInicio: esc.ejercicio.inicio,
      fechaCierre: esc.ejercicio.cierre,
      denominacion: '',
      numeroEjercicio: esc.ejercicio.numero,
      auditorId: ctx.auditorId,
      modoAnterior: esc.ejercicio.modo,
      ejercicioAnteriorId: anteriorId ?? '',
      categoriaEnte: 'PEQUENA',
      fechaInformeAuditor: `${Number(esc.ejercicio.cierre.slice(0, 4)) + 1}-03-15`,
      indiceInflacionAnterior: esc.ejercicio.indiceAnterior,
      indiceInflacionActual: esc.ejercicio.indiceActual,
    }),
  )
  if (!creado) return null
  const ej = creado.id
  ctx.hechos.set(id, { sociedadId: soc, ejercicioId: ej })
  const ejercicio = async () => (await findEjercicioById(ej))!

  // 3. Nota 1: adopción de la RT 54 y criterio de bienes de cambio.
  const tieneBienesCambio = esc.cuentas.some((c) => c[2] === 'ACT-CTE-09')
  if (esc.ejercicio.modo === 'VINCULADO') {
    const e = await ejercicio()
    if (e.adopcionRT54 !== esc.ejercicio.adopcionRT54) {
      reg.hallazgo(
        'mejora',
        id,
        'Nota 1',
        `El ejercicio vinculado a uno que ya aplicó la RT 54 no viene con la adopción en "${esc.ejercicio.adopcionRT54}": el contador la vuelve a elegir (viene ${e.adopcionRT54 ?? 'vacía'}).`,
      )
    }
    if (tieneBienesCambio && !e.criteriosBienesCambio) {
      reg.hallazgo(
        'mejora',
        id,
        'Nota 1',
        'El criterio de medición de bienes de cambio no se trae del ejercicio anterior: hay que volver a elegirlo.',
      )
    }
  }
  await accion(ctx, id, 'Configurar la Nota 1', () =>
    guardarConfigNotaIAction(ej, soc, {
      adopcionRT54: esc.ejercicio.adopcionRT54,
      criteriosBienesCambio: tieneBienesCambio ? 'COSTO_REPOSICION' : null,
      hechosPosterioress: false,
      hechosPosterioressTexto: null,
    }),
  )

  // 4. Balance de sumas y saldos: importación manual y clasificación.
  await importarYClasificar(ctx, esc, soc, ej)

  // 5. Anexos y notas sugeridos.
  await decidirDocumentos(ctx, esc, soc, ej)
  await accion(ctx, id, 'Generar las notas', () => generarNotasAutomaticasAction(ej, soc))

  // 6. Transición a la RT 54 (antes del E.E.P.N.: el ajuste podría llegar solo).
  if (esc.transicion) {
    await accion(ctx, id, 'Cargar el ajuste de transición RT 54', () =>
      crearAjusteTransicionAction(ej, soc, {
        tipo: 'AJUSTE_MEDICION',
        concepto: esc.transicion!.concepto,
        descripcion: null,
        componentePN: 'RDOS_NO_ASIGNADOS',
        importePN: esc.transicion!.importePN,
        importeResultadoAnterior: 0,
        rubroOrigen: null,
        rubroDestino: null,
        importeReclasificado: 0,
      }),
    )
    tipear('Transición RT 54', esc.transicion.concepto, esc.transicion.importePN, DATO_AJUSTE_RT54)
  }

  // 7. Anexo I, Anexo II y, en carga manual, el anterior.
  if (esc.documentos.aceptar.includes('ANEXO_BIENES_USO')) await anexoBienesDeUso(ctx, esc, soc, ej)
  if (esc.documentos.aceptar.includes('ANEXO_COSTO_VENTAS'))
    await anexoCostoVentas(ctx, esc, soc, ej)
  if (esc.anteriorManual) {
    await gastosAnterior(ctx, esc, soc, ej)
    await sspAnterior(ctx, esc, soc, ej)
    await eerrAnterior(ctx, esc, soc, ej)
  }

  // 8. Evolución del patrimonio neto.
  await patrimonioNeto(ctx, esc, soc, ej)

  // 9. Flujo de efectivo.
  await flujoEfectivo(ctx, esc, soc, ej)

  // 10. Autorizar el comparativo (manual, con todo el anterior ya cargado), confirmar el
  //     E.E.P.N. y los estados, y cerrar.
  if (esc.ejercicio.modo === 'MANUAL') {
    await accion(ctx, id, 'Autorizar el ejercicio anterior cargado a mano', () =>
      autorizarComparativoAction(ej, soc, 'C.P. Ana Pérez'),
    )
  }
  await accion(ctx, id, 'Evolución del patrimonio neto: confirmar', () =>
    confirmarPNAction(ej, soc, true),
  )
  await accion(ctx, id, 'Confirmar los estados', () => confirmarEstadosAction(ej, soc))
  const camino = [
    ['BORRADOR', 'EN_PROCESO'],
    ['EN_PROCESO', 'REVISION'],
    ['REVISION', 'CERRADO'],
  ] as const
  for (const [desde, hasta] of camino) {
    const r = await accion(ctx, id, `Pasar el ejercicio a ${hasta}`, () =>
      avanzarEstadoEjercicio(ej, soc, desde, hasta),
    )
    if (!r) break
  }
  return ej
}

// ─── Importación y clasificación ──────────────────────────────────────────────

async function importarYClasificar(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const importado = await accion(ctx, id, 'Importar el balance de sumas y saldos', () =>
    confirmarImportacionManual(
      ej,
      soc,
      esc.cuentas.map(([codigo, nombre, , saldo]) => ({
        codigo,
        nombre,
        saldoDeudor: saldo > 0 ? saldo : 0,
        saldoAcreedor: saldo < 0 ? -saldo : 0,
      })),
    ),
  )
  if (!importado) return
  reg.igual(id, 'Importación', 'Cuentas importadas', importado.importadas, esc.cuentas.length)

  const cuentas = await findCuentasByEjercicio(ej)
  const porCodigo = new Map(cuentas.map((c) => [c.codigo, c]))
  const pendientes = new Map<string, string[]>() // rubro esperado → ids
  let yaClasificadas = 0
  let malClasificadas = 0
  for (const [codigo, nombre, rubro, saldo] of esc.cuentas) {
    const c = porCodigo.get(codigo)
    if (!c) {
      reg.hallazgo('error', id, 'Importación', `La cuenta ${codigo} ${nombre} no quedó importada.`)
      continue
    }
    reg.igual(id, 'Importación', `Saldo de ${codigo} ${nombre}`, c.saldoFinal, saldo)
    const esperado = ctx.rubroId.get(rubro)!
    if (c.rubroBaseId === esperado) {
      yaClasificadas++
      continue
    }
    if (c.rubroBaseId) malClasificadas++
    pendientes.set(esperado, [...(pendientes.get(esperado) ?? []), c.id])
  }
  if (malClasificadas > 0) {
    reg.hallazgo(
      'error',
      id,
      'Clasificación',
      `${malClasificadas} cuentas vinieron clasificadas en un rubro distinto al que corresponde.`,
    )
  }
  if (esc.ejercicio.modo === 'VINCULADO') {
    const anteriorId = ctx.hechos.get('B')?.ejercicioId
    const delAnterior = new Set(
      anteriorId
        ? (await findCuentasByEjercicio(anteriorId)).map((c) => `${c.codigo}|${c.nombre}`)
        : [],
    )
    const repetidas = esc.cuentas.filter(
      ([codigo, nombre, rubro]) =>
        delAnterior.has(`${codigo}|${nombre}`) &&
        porCodigo.get(codigo)?.rubroBaseId !== ctx.rubroId.get(rubro),
    ).length
    if (repetidas > 0) {
      reg.hallazgo(
        'mejora',
        id,
        'Clasificación',
        `${repetidas} de ${esc.cuentas.length} cuentas ya estaban clasificadas en el ejercicio anterior (mismo código y nombre) y hubo que clasificarlas de nuevo. Se podrían traer clasificadas.`,
      )
    }
  }
  reg.paso(id, `Clasificación: ${yaClasificadas} cuentas ya venían clasificadas`, true)
  for (const [rubroId, ids] of pendientes) {
    await accion(ctx, id, `Clasificar en ${ctx.rubroCodigo.get(rubroId)}`, () =>
      asignarRubrosBulkAction(ids, rubroId, ej, soc),
    )
  }
}

// ─── Anexos y notas sugeridos ─────────────────────────────────────────────────

async function decidirDocumentos(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const docs = await evaluarDocumentos(ej)
  const sugeridos = docs.filter((d) => d.corresponde)
  for (const clave of esc.esperado.documentosSugeridos) {
    const d = docs.find((x) => x.clave === clave)
    if (!d || !d.corresponde) {
      reg.hallazgo(
        'error',
        id,
        'Anexos y notas',
        `No sugiere ${clave} aunque hay cuentas que lo piden.`,
      )
    }
  }
  for (const d of sugeridos) {
    if (!esc.esperado.documentosSugeridos.includes(d.clave)) {
      reg.hallazgo(
        'advertencia',
        id,
        'Anexos y notas',
        `Sugiere "${d.titulo}" (${d.clave}) y según las cuentas no corresponde.`,
      )
    }
  }
  if (esc.ejercicio.modo === 'VINCULADO') {
    const yaDecididos = esc.documentos.aceptar.filter(
      (c) => docs.find((d) => d.clave === c)?.estado === 'SUGERIDO',
    )
    const anterior = ctx.hechos.get('B')?.ejercicioId
    const aceptadosAntes = anterior
      ? new Set(
          (await evaluarDocumentos(anterior))
            .filter((d) => d.estado === 'ACEPTADO')
            .map((d) => d.clave),
        )
      : new Set<string>()
    const otraVez = yaDecididos.filter((c) => aceptadosAntes.has(c))
    if (otraVez.length > 0) {
      reg.hallazgo(
        'mejora',
        id,
        'Anexos y notas',
        `Hay que volver a aceptar ${otraVez.length} documentos que ya se aceptaron el año anterior (${otraVez.join(', ')}).`,
      )
    }
  }
  for (const clave of esc.documentos.aceptar) {
    if (docs.find((d) => d.clave === clave)?.estado === 'ACEPTADO') continue
    await accion(ctx, id, `Aceptar ${clave}`, () => aceptarDocumentoAction(ej, soc, clave))
  }
  for (const clave of esc.documentos.descartar) {
    await accion(ctx, id, `Descartar ${clave}`, () => descartarDocumentoAction(ej, soc, clave))
  }
}

// ─── Anexo I ──────────────────────────────────────────────────────────────────

async function anexoBienesDeUso(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const vinculado = esc.ejercicio.modo === 'VINCULADO'
  const antes = await cargarBienesDeUso((await findEjercicioById(ej))!)
  const bienes = [...antes.bienes]
  const nuevas: string[] = []
  const netoDeducible: string[] = []
  for (const cat of esc.bienesDeUso) {
    if (bienes.some((b) => b.categoria === cat.categoria)) continue
    const creado = await accion(ctx, id, `Anexo I: crear la categoría ${cat.categoria}`, () =>
      crearBienDeUsoAction(ej, soc, cat.categoria),
    )
    if (creado) bienes.push(creado)
    nuevas.push(cat.categoria)
  }
  if (vinculado && nuevas.length > 0) {
    reg.hallazgo(
      'mejora',
      id,
      'Anexo I',
      `Las categorías del año anterior no vienen solas: hubo que crear ${nuevas.join(', ')}.`,
    )
  }
  const lote = bienes.map((b) => {
    const cat = esc.bienesDeUso.find((c) => c.categoria === b.categoria)
    if (!cat) return b
    return {
      ...b,
      costoInicioReexpresado: cat.costoInicio,
      costoAjusteInflacion: cat.ajusteCosto ?? b.costoAjusteInflacion,
      depAjusteInflacion: cat.ajusteDep ?? b.depAjusteInflacion,
      altas: cat.altas,
      bajas: cat.bajas,
      depAcumInicio: cat.depInicio,
      depEjercicio: cat.depEjercicio,
      depBajas: cat.depBajas,
      netoResidualAnteriorManual: cat.netoAnterior ?? b.netoResidualAnteriorManual,
    }
  })
  for (const cat of esc.bienesDeUso) {
    const p = `Anexo I ${cat.categoria}`
    if (!antes.bloqueadas.has(cat.categoria)) {
      reg.entrada(id, p, 'costo al inicio', cat.costoInicio)
      reg.entrada(id, p, 'amortización acumulada al inicio', cat.depInicio)
    }
    reg.entrada(id, p, 'altas', cat.altas)
    reg.entrada(id, p, 'bajas', cat.bajas)
    reg.entrada(id, p, 'amortización del ejercicio', cat.depEjercicio)
    reg.entrada(id, p, 'amortización de las bajas', cat.depBajas)
    reg.entrada(id, p, 'ajuste por inflación del valor de origen', cat.ajusteCosto ?? 0)
    reg.entrada(id, p, 'ajuste por inflación de la amortización', cat.ajusteDep ?? 0)
    if (cat.netoAnterior !== undefined) {
      reg.entrada(id, p, 'neto del año anterior', cat.netoAnterior)
      // El comienzo de este año es el cierre del anterior: neto anterior = valor − amortización.
      if (
        !antes.bloqueadas.has(cat.categoria) &&
        iguales(cat.netoAnterior, restar(cat.costoInicio, cat.depInicio))
      ) {
        netoDeducible.push(cat.categoria)
      }
    }
  }
  if (netoDeducible.length > 0) {
    reg.hallazgo(
      'mejora',
      id,
      'Anexo I',
      `El "neto del año anterior" se tipea aparte y es el valor al comienzo menos la amortización acumulada al comienzo, que ya se cargaron (${netoDeducible.join(', ')}). Se podría calcular solo.`,
    )
  }
  if (esc.bienesDeUso.some((c) => c.ajusteCosto || c.ajusteDep)) {
    reg.hallazgo(
      'mejora',
      id,
      'Anexo I',
      'El ajuste por inflación del valor de origen y de la amortización al comienzo se tipea a mano; la app ya tiene el coeficiente y los valores al comienzo para proponerlo.',
    )
  }
  await accion(ctx, id, 'Anexo I: guardar', () => guardarLoteBienesAction(ej, soc, lote))
}

// ─── Anexo II ─────────────────────────────────────────────────────────────────

async function anexoCostoVentas(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const cv = esc.costoVentas!
  const antes = await cargarCostoVentas((await findEjercicioById(ej))!)
  if (!antes.existenciaInicialBloqueada) {
    reg.entrada(
      id,
      'Anexo II',
      'existencia inicial',
      cv.existenciaInicial,
      DATO_EXISTENCIA_ANTERIOR,
    )
  }
  reg.entrada(id, 'Anexo II', 'compras', cv.compras)
  reg.entrada(id, 'Anexo II', 'existencia final', cv.existenciaFinal)
  await accion(ctx, id, 'Anexo II: guardar', () => guardarTodoCostoVentasAction(ej, soc, cv))

  const ant = esc.anteriorManual?.costoVentas
  if (!ant) return
  const claves = ['existenciaInicial', 'compras', 'gastosFabricacion', 'existenciaFinal'] as const
  for (const k of claves) {
    reg.entrada(
      id,
      'Anexo II anterior',
      k,
      ant[k],
      k === 'existenciaFinal' ? DATO_EXISTENCIA_ANTERIOR : undefined,
    )
  }
  await accion(ctx, id, 'Anexo II: cargar el año anterior', () =>
    guardarLoteComparativoAction(
      ej,
      soc,
      claves.map((k, orden) => ({
        modulo: 'COSTO_VENTAS' as const,
        clave: k,
        label: k,
        valor: ant[k],
        esHuerfano: false,
        orden,
      })),
    ),
  )
}

// ─── Anterior cargado a mano ──────────────────────────────────────────────────

async function gastosAnterior(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const id = esc.id
  const gastos = await cargarGastos((await findEjercicioById(ej))!)
  const filas = filasAnexoGastos(gastos.secciones, [])
  const items = esc.anteriorManual!.gastos.map((g, orden) => {
    const fila = filas.find((f) => f.nombre === g.nombre)
    const soloAnterior = !fila
    const clave = soloAnterior
      ? buildClaveHuerfano(g.seccion ?? null)
      : fila.secciones.length > 1
        ? claveFilaAnteriorEnSeccion(g.nombre, g.seccion!)
        : claveFilaAnterior(g.nombre)
    ctx.reg.entrada(
      id,
      'Anexo III anterior',
      `${g.nombre}${g.seccion ? ` (${g.seccion})` : ''}`,
      g.valor,
    )
    return {
      modulo: 'GASTOS_FILA' as const,
      clave: soloAnterior ? `${clave}${orden}` : clave,
      label: g.nombre,
      valor: g.valor,
      esHuerfano: soloAnterior,
      orden,
    }
  })
  await accion(ctx, id, 'Anexo III: cargar el año anterior fila por fila', () =>
    guardarLoteComparativoAction(ej, soc, items),
  )
}

async function sspAnterior(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const manual = esc.anteriorManual!
  const esperado = esc.esperado.anterior!
  const { estadosData } = await estados((await findEjercicioById(ej))!)
  const notas = await cargarNotas((await findEjercicioById(ej))!)
  const directos: { clave: string; label: string; valor: number }[] = []

  for (const r of estadosData.sspRubros) {
    // El patrimonio neto anterior sale de la evolución del patrimonio neto, no se tipea acá.
    if (!(r.codigo in esperado.rubros)) continue
    const valorRubro = esperado.rubros[r.codigo]!
    const detalle = r.anteriorDesdeDetalle
    if (detalle?.fuente === 'ANEXO_I') continue // sale del neto anterior del Anexo I
    if (detalle?.fuente === 'NOTA' && detalle.notaId) {
      const nota = notas.find((n) => n.id === detalle.notaId)
      if (!nota) continue
      for (const d of nota.detalles.filter((x) => !x.esTotal)) {
        const valor = manual.porCuenta[d.concepto]
        if (valor === undefined) {
          reg.hallazgo(
            'advertencia',
            id,
            'Notas',
            `La nota "${nota.titulo}" tiene la fila "${d.concepto}" que no es una cuenta del rubro.`,
          )
          continue
        }
        const unica = r.codigo === 'ACT-CTE-09' && r.cuentas.length === 1
        reg.entrada(
          id,
          `Nota ${nota.titulo}`,
          d.concepto,
          valor,
          unica ? DATO_EXISTENCIA_ANTERIOR : undefined,
        )
        await accion(ctx, id, `Nota ${nota.titulo}: anterior de ${d.concepto}`, () =>
          actualizarDetalleAction(d.id, ej, soc, { importeAnterior: valor }),
        )
      }
      for (const extra of manual.soloAnterior.filter((x) => x.rubro === r.codigo)) {
        const fila = await accion(ctx, id, `Nota ${nota.titulo}: agregar ${extra.nombre}`, () =>
          crearDetalleAction(nota.id, ej, soc, nota.detalles.length + 1),
        )
        if (!fila) continue
        reg.entrada(id, `Nota ${nota.titulo}`, extra.nombre, extra.valor)
        await accion(ctx, id, `Nota ${nota.titulo}: anterior de ${extra.nombre}`, () =>
          actualizarDetalleAction(fila.id, ej, soc, {
            concepto: extra.nombre,
            importeAnterior: extra.valor,
          }),
        )
      }
      continue
    }
    if (iguales(r.displayValueAnt, valorRubro)) continue
    reg.entrada(id, 'Estado de situación patrimonial (anterior)', r.nombre, valorRubro)
    directos.push({ clave: r.id, label: r.nombre, valor: valorRubro })
  }
  if (directos.length > 0) {
    await accion(ctx, id, 'Estado de situación patrimonial: cargar el anterior', () =>
      guardarLoteComparativoAction(
        ej,
        soc,
        directos.map((d, orden) => ({ modulo: 'SSP' as const, ...d, esHuerfano: false, orden })),
      ),
    )
  }
}

async function eerrAnterior(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const id = esc.id
  const eerr = esc.anteriorManual!.eerr
  const { estadosData } = await estados((await findEjercicioById(ej))!)
  const actual = estadosData.eerr
  const lineas = [
    { clave: 'INGRESOS', label: 'Ingresos', valor: eerr.ingresos, hoy: actual.ingresosAnt },
    {
      clave: 'COSTO_VENTAS',
      label: 'Costo de Ventas',
      valor: eerr.costoVentas,
      hoy: actual.costoVentasAnt,
    },
    {
      clave: 'RESULTADOS_FINANCIEROS',
      label: 'Resultados Financieros',
      valor: eerr.resultadosFinancieros,
      hoy: actual.resultadosFinancierosAnt,
    },
    {
      clave: 'IMPUESTO_GANANCIAS',
      label: 'Impuesto a las Ganancias',
      valor: eerr.impuesto,
      hoy: actual.impuestoGananciasAnt,
    },
  ].filter((l) => !iguales(l.valor, l.hoy))
  for (const l of lineas) ctx.reg.entrada(id, 'Estado de resultados (anterior)', l.label, l.valor)
  if (lineas.some((l) => l.clave === 'COSTO_VENTAS') && esc.anteriorManual!.costoVentas) {
    ctx.reg.hallazgo(
      'mejora',
      id,
      'Estado de resultados',
      'El costo de ventas del año anterior se tipea en el estado de resultados aunque ya se cargó el Anexo II del año anterior, que lo calcula.',
    )
  }
  if (lineas.length === 0) return
  await accion(ctx, id, 'Estado de resultados: cargar el anterior', () =>
    guardarLoteComparativoAction(
      ej,
      soc,
      lineas.map(({ clave, label, valor }, orden) => ({
        modulo: 'EERR' as const,
        clave,
        label,
        valor,
        esHuerfano: false,
        orden,
      })),
    ),
  )
}

// ─── Evolución del patrimonio neto ────────────────────────────────────────────

const COLUMNAS_PN = [
  'capitalSuscripto',
  'ajusteCapital',
  'aportesIrrevocables',
  'reservaLegal',
  'otrasReservas',
  'rdosNoAsignados',
  'totalAnterior',
] as const

async function patrimonioNeto(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const { estadosData, pnData } = await estados((await findEjercicioById(ej))!)
  const previo = new Map(pnData.movimientos.map((m) => [m.tipo, m]))

  // Si la app ya trae el inicio reexpresado, el ajuste por inflación no se carga aparte.
  const inicio = previo.get('SALDO_INICIO')
  const inicioTotal = inicio ? sumarPor(COLUMNAS_PN.slice(0, 6), (k) => inicio[k]) : 0
  const ajusteYaIncluido =
    esc.ejercicio.modo === 'VINCULADO' &&
    iguales(inicioTotal, esc.esperado.anterior?.patrimonioNeto ?? 0)
  const movimientos: MovimientoPN[] = esc.pn.filter(
    (m) => !(ajusteYaIncluido && m.tipo === 'AJUSTE_INFLACION'),
  )

  const filas: EvolucionPNInput[] = PN_MOVIMIENTOS.map((m) => {
    const base = previo.get(m.tipo)
    const fila: EvolucionPNInput = {
      tipo: m.tipo,
      orden: m.orden,
      capitalSuscripto: base?.capitalSuscripto ?? 0,
      ajusteCapital: base?.ajusteCapital ?? 0,
      aportesIrrevocables: base?.aportesIrrevocables ?? 0,
      reservaLegal: base?.reservaLegal ?? 0,
      otrasReservas: base?.otrasReservas ?? 0,
      rdosNoAsignados: base?.rdosNoAsignados ?? 0,
      totalAnterior: base?.totalAnterior ?? 0,
    }
    const mio = movimientos.find((x) => x.tipo === m.tipo)
    if (!mio) return fila
    for (const k of COLUMNAS_PN) {
      const valor = mio[k as keyof MovimientoPN] as number | undefined
      if (valor === undefined) continue
      if (!iguales(valor, fila[k])) {
        const dato =
          m.tipo === 'MODIFICACION_INICIO' && k === 'rdosNoAsignados' ? DATO_AJUSTE_RT54 : undefined
        reg.entrada(id, 'Evolución del patrimonio neto', `${m.tipo} · ${k}`, valor, dato)
        if (m.tipo === 'RESULTADO_EJERCICIO' && k === 'totalAnterior') {
          reg.hallazgo(
            'mejora',
            id,
            'Evolución del patrimonio neto',
            'El resultado del año anterior se tipea en la columna "Ejercicio anterior" y ya está en el estado de resultados anterior: se podría traer de ahí.',
          )
        }
      }
      fila[k] = valor
    }
    return fila
  })
  await accion(ctx, id, 'Evolución del patrimonio neto: guardar', () =>
    guardarEvolucionPNAction(ej, soc, filas, estadosData.eerr.utilidadEjercicio),
  )
}

// ─── Flujo de efectivo ────────────────────────────────────────────────────────

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

async function flujoEfectivo(ctx: Contexto, esc: Escenario, soc: string, ej: string) {
  const { reg } = ctx
  const id = esc.id
  if (esc.ejercicio.modo === 'VINCULADO') {
    await accion(ctx, id, 'Flujo: traer los conceptos del año anterior', () =>
      traerConceptosAnteriorAction(ej, soc),
    )
  }
  let guardado = await findFlujo(ej)
  for (const item of esc.flujo) {
    if (
      guardado?.items.some(
        (i) => i.seccion === item.seccion && normalizar(i.concepto) === normalizar(item.concepto),
      )
    ) {
      continue
    }
    await accion(ctx, id, `Flujo: agregar "${item.concepto}"`, () =>
      crearItemFlujoAction(ej, soc, item.seccion, item.concepto),
    )
  }
  guardado = await findFlujo(ej)
  if (!guardado) {
    reg.hallazgo(
      'error',
      id,
      'Flujo de efectivo',
      'No quedó guardado el flujo después de agregar los conceptos.',
    )
    return
  }
  const efectivoInicioAnterior = esc.anteriorManual?.flujo.efectivoInicio
  if (efectivoInicioAnterior !== undefined) {
    reg.entrada(
      id,
      'Flujo de efectivo',
      'efectivo al inicio del año anterior',
      efectivoInicioAnterior,
    )
  }
  const items = guardado.items.map((i) => {
    const mio = esc.flujo.find(
      (x) => x.seccion === i.seccion && normalizar(x.concepto) === normalizar(i.concepto),
    )
    if (!mio) return i
    reg.entrada(id, 'Flujo de efectivo', i.concepto, mio.importe)
    if (mio.importeAnterior !== undefined) {
      reg.entrada(id, 'Flujo de efectivo (anterior)', i.concepto, mio.importeAnterior)
    }
    return { ...i, importe: mio.importe, importeAnterior: mio.importeAnterior ?? i.importeAnterior }
  })
  await accion(ctx, id, 'Flujo: guardar', () =>
    guardarFlujoAction(ej, soc, {
      ...guardado!,
      saldoInicialAnterior: efectivoInicioAnterior ?? guardado!.saldoInicialAnterior,
      items,
    }),
  )
}
