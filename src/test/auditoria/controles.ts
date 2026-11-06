/**
 * Controles de coherencia de un ejercicio terminado: lo que muestra cada pantalla contra los
 * resultados conocidos de la referencia, y las pantallas entre sí (estados, anexos, notas,
 * patrimonio neto, flujo y el documento que se imprime). Todo con igualdad exacta.
 */
import { dividir, multiplicar, restar, sumar, sumarPor } from '@/lib/importe'
import { iguales } from './registro'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import { evaluarAutorizacionEjercicio } from '@/modules/ejercicios/services/autorizacion.service'
import { findCuentasByEjercicio } from '@/modules/importaciones/repository/cuentas.repository'
import { cargarEstadosConPN } from '@/modules/estados/services/estados.service'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { filasAnexoGastos } from '@/modules/gastos/domain/filasAnexo'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'
import { calcularCierre } from '@/modules/bienes-de-uso/domain/types'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { cargarNotas } from '@/modules/notas/services/notas.service'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import { cargarDocumentoBalance } from '@/modules/exportacion/services/documento.service'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import type { RubroFila } from '@/modules/estados/domain/types'
import { patrimonioNetoSSP } from '@/modules/estados/domain/estructuraSSP'
import type { Escenario } from './referencia'
import type { Contexto } from './motor'

const costo = (c: CostoVentasDTO | null) =>
  c ? restar(sumar(c.existenciaInicial, c.compras, c.gastosFabricacion), c.existenciaFinal) : 0

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export async function controlar(ctx: Contexto, esc: Escenario, ej: string) {
  const { reg } = ctx
  const id = esc.id
  const x = esc.esperado
  const ant = x.anterior
  // La columna del ejercicio actual no se ajusta: lo que arrastra del anterior se compara ajustándolo.
  const ajustado = (v: number) =>
    multiplicar(v, dividir(esc.ejercicio.indiceActual, esc.ejercicio.indiceAnterior))
  const conAnterior = esc.ejercicio.modo !== 'SIN_ANTERIOR'
  const igual = (
    area: string,
    concepto: string,
    obtenido: number | null | undefined,
    esperado: number,
  ) => reg.igual(id, area, concepto, obtenido, esperado)

  const ejercicio = (await findEjercicioById(ej))!
  const cuentas = await findCuentasByEjercicio(ej)
  const { estadosData: e, pnData: pn } = await cargarEstadosConPN(ejercicio, cuentas)
  const [flujo, gastos, bdu, cv, notas, docs, documento, evaluacion] = await Promise.all([
    cargarFlujo(ejercicio, e),
    cargarGastos(ejercicio),
    cargarBienesDeUso(ejercicio),
    cargarCostoVentas(ejercicio),
    cargarNotas(ejercicio),
    evaluarDocumentos(ej),
    cargarDocumentoBalance(ej),
    evaluarAutorizacionEjercicio(ej),
  ])

  // ── Proceso ────────────────────────────────────────────────────────────────
  if (ejercicio.estado !== 'CERRADO') {
    reg.hallazgo(
      'error',
      id,
      'Cierre',
      `El ejercicio quedó en ${ejercicio.estado}: no se pudo cerrar.`,
    )
  }
  for (const b of evaluacion?.bloqueantes ?? []) {
    reg.hallazgo('error', id, 'Compuerta de autorización', `${b.codigo}: ${b.mensaje}`)
  }
  for (const a of evaluacion?.advertencias ?? []) {
    reg.hallazgo('advertencia', id, 'Compuerta de autorización', `${a.codigo}: ${a.mensaje}`)
  }
  igual('Clasificación', 'Cuentas sin clasificar', e.sinClasificar, 0)

  // ── Estado de situación patrimonial ────────────────────────────────────────
  const rubro = (codigo: string) => e.sspRubros.find((r) => r.codigo === codigo)
  const seccion = (r: RubroFila[], s: string[], campo: 'displayValue' | 'displayValueAnt') =>
    sumarPor(
      r.filter((f) => s.includes(f.seccionSSP ?? '')),
      (f) => f[campo],
    )
  const ACTIVO = ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE']
  const PASIVO = ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE']
  const ssp = 'Estado de situación patrimonial'
  for (const [codigo, valor] of Object.entries(x.rubros)) {
    const r = rubro(codigo)
    if (!r) reg.hallazgo('error', id, ssp, `Falta el rubro ${codigo}.`)
    else igual(ssp, `${r.nombre} (actual)`, r.displayValue, valor)
  }
  for (const r of e.sspRubros) {
    const esperadoActual = x.rubros[r.codigo] !== undefined
    const esperadoAnt = ant?.rubros[r.codigo] !== undefined
    if (!esperadoActual && r.seccionSSP && !r.codigo.startsWith('PN') && r.displayValue !== 0) {
      reg.hallazgo(
        'error',
        id,
        ssp,
        `Muestra el rubro ${r.nombre} con ${r.displayValue} y no debería tener saldo.`,
      )
    }
    if (!esperadoAnt && r.seccionSSP && !r.codigo.startsWith('PN') && r.displayValueAnt !== 0) {
      reg.hallazgo(
        'error',
        id,
        ssp,
        `Muestra el anterior de ${r.nombre} con ${r.displayValueAnt} y no debería.`,
      )
    }
  }
  const activo = seccion(e.sspRubros, ACTIVO, 'displayValue')
  const pasivo = seccion(e.sspRubros, PASIVO, 'displayValue')
  igual(ssp, 'Total del activo', activo, x.activo)
  igual(ssp, 'Total del pasivo', pasivo, x.pasivo)
  // Como la pantalla del estado: el total del E.E.P.N. (la página se lo pasa al SSP).
  const pnSSP = patrimonioNetoSSP(e.sspRubros, pn.totalActual, 'actual')
  igual(ssp, 'Patrimonio neto', pnSSP, x.patrimonioNeto)
  igual(ssp, 'Activo = pasivo + patrimonio neto', activo, sumar(pasivo, pnSSP))
  if (ant) {
    for (const [codigo, valor] of Object.entries(ant.rubros)) {
      const r = rubro(codigo)
      if (!r)
        reg.hallazgo('error', id, ssp, `Falta el rubro ${codigo}, que tenía saldo el año anterior.`)
      else igual(ssp, `${r.nombre} (anterior)`, r.displayValueAnt, valor)
    }
    const activoAnt = seccion(e.sspRubros, ACTIVO, 'displayValueAnt')
    const pasivoAnt = seccion(e.sspRubros, PASIVO, 'displayValueAnt')
    igual(ssp, 'Total del activo (anterior)', activoAnt, ant.activo)
    igual(ssp, 'Total del pasivo (anterior)', pasivoAnt, ant.pasivo)
    const pnSSPAnt = patrimonioNetoSSP(e.sspRubros, pn.totalAnterior, 'anterior')
    igual(ssp, 'Patrimonio neto (anterior)', pnSSPAnt, ant.patrimonioNeto)
    igual(
      ssp,
      'Activo = pasivo + patrimonio neto (anterior)',
      activoAnt,
      sumar(pasivoAnt, pnSSPAnt),
    )
  }

  // ── Estado de resultados ───────────────────────────────────────────────────
  const er = 'Estado de resultados'
  igual(er, 'Ingresos', e.eerr.ingresos, x.ingresos)
  igual(er, 'Costo de ventas', e.eerr.costoVentas, x.costoVentas)
  igual(er, 'Resultados financieros', e.eerr.resultadosFinancieros, x.resultadosFinancieros)
  igual(er, 'Impuesto a las ganancias', e.eerr.impuestoGanancias, x.impuesto)
  igual(er, 'Resultado del ejercicio', e.eerr.utilidadEjercicio, x.resultado)
  for (const [key, valor] of Object.entries(x.gastos)) {
    const s = e.eerr.seccionesGasto.find((g) => g.key === key)
    igual(er, `Gastos ${s?.nombre ?? key}`, s?.total, valor)
    if (ant) igual(er, `Gastos ${s?.nombre ?? key} (anterior)`, s?.totalAnt, ant.gastos[key] ?? 0)
  }
  if (ant)
    igual(er, 'Resultado del ejercicio (anterior)', e.eerr.utilidadEjercicioAnt, ant.resultado)

  // ── Evolución del patrimonio neto ──────────────────────────────────────────
  const pnArea = 'Evolución del patrimonio neto'
  igual(pnArea, 'Total al cierre', pn.totalActual, x.patrimonioNeto)
  igual(
    pnArea,
    'Resultado del ejercicio = estado de resultados',
    pn.resultadoEjercicio,
    e.eerr.utilidadEjercicio,
  )
  igual(pnArea, 'Total al cierre = estado de situación patrimonial', pn.totalActual, pnSSP)
  if (ant) {
    igual(pnArea, 'Total del año anterior', pn.totalAnterior, ant.patrimonioNeto)
    const resAnt = pn.movimientos.find((m) => m.tipo === 'RESULTADO_EJERCICIO')?.totalAnterior
    igual(
      pnArea,
      'Resultado del año anterior = estado de resultados anterior',
      resAnt,
      e.eerr.utilidadEjercicioAnt,
    )
  }
  // Cada columna del patrimonio neto contra las cuentas del balance.
  const cuentasPN = (codigo: string) =>
    sumarPor(
      cuentas.filter((c) => c.rubroBaseId === ctx.rubroId.get(codigo)),
      (c) => -c.saldoFinal,
    )
  const columna = (k: 'capitalSuscripto' | 'ajusteCapital' | 'reservaLegal' | 'rdosNoAsignados') =>
    sumarPor(
      pn.movimientos.filter((m) => m.tipo !== 'RESULTADO_EJERCICIO'),
      (m) => m[k],
    )
  igual(
    pnArea,
    'Columna capital = cuenta Capital social',
    columna('capitalSuscripto'),
    cuentasPN('PN-01'),
  )
  igual(
    pnArea,
    'Columna ajuste de capital = cuenta Ajuste de capital',
    columna('ajusteCapital'),
    cuentasPN('PN-02'),
  )
  igual(
    pnArea,
    'Columna reserva legal = cuenta Reservas',
    columna('reservaLegal'),
    cuentasPN('PN-03'),
  )
  igual(
    pnArea,
    'Columna resultados no asignados = cuenta RNA',
    columna('rdosNoAsignados'),
    cuentasPN('PN-04'),
  )

  // ── Flujo de efectivo ──────────────────────────────────────────────────────
  const fe = 'Flujo de efectivo'
  igual(fe, 'Efectivo al cierre = Caja y bancos', flujo.actual.efectivoCierre, x.efectivoCierre)
  igual(fe, 'Variación explicada por las actividades', flujo.actual.diferencia, 0)
  if (ant && flujo.anterior) {
    igual(
      fe,
      'Efectivo al cierre del año anterior',
      flujo.anterior.efectivoCierre,
      ant.rubros['ACT-CTE-01'] ?? 0,
    )
    // El efectivo al inicio ya es el del cierre del anterior ajustado (dueño del producto,
    // 2026-11-06): no se vuelve a ajustar.
    igual(
      fe,
      'Efectivo al inicio = cierre del año anterior ajustado',
      flujo.actual.efectivoInicio,
      flujo.anterior.efectivoCierre,
    )
    igual(fe, 'Variación del año anterior explicada', flujo.anterior.diferencia, 0)
  } else if (ant) {
    reg.hallazgo('error', id, fe, 'No muestra la columna del año anterior.')
  }
  for (const s of flujo.conceptosSoloAnterior) {
    reg.hallazgo(
      'advertencia',
      id,
      fe,
      `Concepto solo del año anterior: "${s.concepto}" (${s.importe}).`,
    )
  }

  // ── Anexo I ────────────────────────────────────────────────────────────────
  const a1 = 'Anexo I (bienes de uso)'
  const cierres = bdu.bienes.map((b) => calcularCierre(b))
  igual(
    a1,
    'Neto al cierre',
    sumarPor(cierres, (c) => c.netoResidual),
    x.bienesDeUsoNeto,
  )
  igual(
    a1,
    'Neto al cierre = rubro Bienes de uso',
    sumarPor(cierres, (c) => c.netoResidual),
    rubro('ACT-NCTE-09')?.displayValue ?? 0,
  )
  igual(
    a1,
    'Amortización del ejercicio',
    sumarPor(bdu.bienes, (b) => b.depEjercicio),
    x.amortizacionEjercicio,
  )
  // Como las pantallas: el anterior por fila cargado a mano solo en modo manual.
  const filasGastos = filasAnexoGastos(
    gastos.secciones,
    esc.ejercicio.modo === 'MANUAL' ? (gastos.anteriorManualPorFila ?? []) : null,
  )
  const amortGasto = filasGastos.find((f) => normalizar(f.nombre).startsWith('amortizacion'))
  igual(
    a1,
    'Amortización del ejercicio = gasto del Anexo III',
    sumarPor(bdu.bienes, (b) => b.depEjercicio),
    amortGasto?.totalActual ?? 0,
  )
  if (ant) {
    const netoAnt =
      bdu.netoAnteriorMap.size > 0
        ? sumarPor([...bdu.netoAnteriorMap.values()], (v) => v)
        : sumarPor(bdu.bienes, (b) => b.netoResidualAnteriorManual ?? 0)
    igual(a1, 'Neto del año anterior', netoAnt, ant.bienesDeUsoNeto)
  }
  for (const a of bdu.advertencias) reg.hallazgo('advertencia', id, a1, a)

  // ── Anexo II ───────────────────────────────────────────────────────────────
  if (x.costoVentasAnexo) {
    const a2 = 'Anexo II (costo de ventas)'
    const c = x.costoVentasAnexo
    igual(a2, 'Existencia inicial', cv.datos?.existenciaInicial, c.existenciaInicial)
    igual(a2, 'Compras', cv.datos?.compras, c.compras)
    igual(a2, 'Existencia final', cv.datos?.existenciaFinal, c.existenciaFinal)
    igual(a2, 'Costo de ventas = estado de resultados', costo(cv.datos), e.eerr.costoVentas)
    igual(
      a2,
      'Existencia final = rubro Bienes de cambio',
      cv.datos?.existenciaFinal,
      rubro('ACT-CTE-09')?.displayValue ?? 0,
    )
    if (ant) {
      igual(
        a2,
        'Existencia inicial, ajustada = Bienes de cambio del año anterior',
        ajustado(cv.datos?.existenciaInicial ?? 0),
        rubro('ACT-CTE-09')?.displayValueAnt ?? 0,
      )
      igual(
        a2,
        'Costo del año anterior = estado de resultados anterior',
        costo(cv.datosAnteriores),
        e.eerr.costoVentasAnt,
      )
    }
    for (const a of cv.advertencias) reg.hallazgo('advertencia', id, a2, a)
  }

  // ── Anexo III ──────────────────────────────────────────────────────────────
  const a3 = 'Anexo III (gastos)'
  for (const s of gastos.secciones) {
    const enEstado = e.eerr.seccionesGasto.find((g) => g.key === s.key)
    if (!enEstado) continue
    igual(a3, `${s.grupoNombre}: total = estado de resultados`, s.total, enEstado.total)
    if (ant)
      igual(
        a3,
        `${s.grupoNombre}: total anterior = estado de resultados`,
        s.totalAnterior,
        enEstado.totalAnt,
      )
  }
  for (const f of x.gastosSoloAnterior ?? []) {
    const fila = filasGastos.find((r) => r.nombre === f.nombre)
    if (!fila)
      reg.hallazgo(
        'error',
        id,
        a3,
        `Falta la fila "${f.nombre}", que solo existió el año anterior.`,
      )
    else igual(a3, `Fila "${f.nombre}" (solo año anterior)`, fila.totalAnterior, f.valor)
  }

  // ── Notas ──────────────────────────────────────────────────────────────────
  const rubroDeCuenta = new Map(cuentas.map((c) => [c.id, c.rubroBaseId]))
  for (const nota of notas.filter((n) => n.tipo === 'CUANTITATIVA')) {
    const rubros = new Set(
      cuentas.filter((c) => c.notaEjercicioId === nota.id).map((c) => rubroDeCuenta.get(c.id)),
    )
    if (rubros.size !== 1) continue
    const r = e.sspRubros.find((f) => f.id === [...rubros][0])
    if (!r) continue
    const filas = nota.detalles.filter((d) => !d.esTotal)
    igual(
      'Notas',
      `Nota "${nota.titulo}" = rubro ${r.nombre}`,
      sumarPor(filas, (d) => d.importeActual),
      r.displayValue,
    )
    if (conAnterior) {
      igual(
        'Notas',
        `Nota "${nota.titulo}" (anterior) = rubro ${r.nombre}`,
        sumarPor(filas, (d) => d.importeAnterior),
        r.displayValueAnt,
      )
    }
    const nombres = new Set(filas.map((d) => normalizar(d.concepto)))
    for (const c of r.cuentas) {
      if (!nombres.has(normalizar(c.nombre))) {
        reg.hallazgo(
          'error',
          id,
          'Notas',
          `La nota "${nota.titulo}" no tiene la cuenta "${c.nombre}" de su rubro.`,
        )
      }
    }
  }
  for (const d of docs.filter((doc) => doc.tipo === 'NOTA')) {
    const hay = notas.some((n) => normalizar(n.titulo) === normalizar(d.titulo))
    if (esc.documentos.descartar.includes(d.clave) && hay) {
      reg.hallazgo(
        'error',
        id,
        'Notas',
        `"${d.titulo}" se descartó y sigue apareciendo entre las notas.`,
      )
    }
  }

  // ── Documento que se imprime ───────────────────────────────────────────────
  const doc = 'Documento (PDF)'
  if (!documento) {
    reg.hallazgo('error', id, doc, 'No se pudo armar el documento del balance.')
    return
  }
  if (documento.columnas.mostrarAnterior !== conAnterior) {
    reg.hallazgo(
      'error',
      id,
      doc,
      `La columna del año anterior ${conAnterior ? 'no aparece' : 'aparece sin haber anterior'}.`,
    )
  }
  if (documento.borrador.es) {
    reg.hallazgo(
      'error',
      id,
      doc,
      `Sale como BORRADOR con el ejercicio cerrado: ${documento.borrador.motivos.join('; ')}`,
    )
  }
  for (const a of documento.advertencias) reg.hallazgo('advertencia', id, doc, a)
  for (const p of documento.pendientes) reg.hallazgo('advertencia', id, doc, `Pendiente: ${p}`)
  const tipos = new Set(documento.secciones.map((s) => s.tipo))
  const anexos = [
    ['ANEXO_BIENES_USO', 'anexo-bienes-uso'],
    ['ANEXO_COSTO_VENTAS', 'anexo-costo-ventas'],
    ['ANEXO_GASTOS', 'anexo-gastos'],
  ] as const
  for (const [clave, tipo] of anexos) {
    const aceptado = esc.documentos.aceptar.includes(clave)
    if (aceptado !== tipos.has(tipo)) {
      reg.hallazgo(
        'error',
        id,
        doc,
        `${clave} ${aceptado ? 'se aceptó y no sale' : 'no se aceptó y sale'} en el documento.`,
      )
    }
  }
  for (const s of documento.secciones) {
    if (s.tipo === 'ssp') {
      for (const r of e.sspRubros) {
        const d = s.estados.sspRubros.find((f) => f.codigo === r.codigo)
        igual(doc, `${r.nombre} (actual) igual que en pantalla`, d?.displayValue, r.displayValue)
        if (conAnterior)
          igual(
            doc,
            `${r.nombre} (anterior) igual que en pantalla`,
            d?.displayValueAnt,
            r.displayValueAnt,
          )
      }
    } else if (s.tipo === 'eerr') {
      const final = s.lineas.find((l) => l.tipo === 'final')
      igual(
        doc,
        'Resultado del ejercicio igual que en pantalla',
        final?.valor,
        e.eerr.utilidadEjercicio,
      )
      if (conAnterior)
        igual(
          doc,
          'Resultado del año anterior igual que en pantalla',
          final?.valorAnt,
          e.eerr.utilidadEjercicioAnt,
        )
    } else if (s.tipo === 'eepn') {
      igual(
        doc,
        'Patrimonio neto al cierre igual que en pantalla',
        s.pn.totalActual,
        pn.totalActual,
      )
    } else if (s.tipo === 'flujo') {
      igual(
        doc,
        'Efectivo al cierre igual que en pantalla',
        s.flujo.actual.efectivoCierre,
        flujo.actual.efectivoCierre,
      )
    } else if (s.tipo === 'anexo-gastos') {
      for (const g of s.anexo.secciones) {
        const pantalla = gastos.secciones.find((p) => p.key === g.key)
        igual(
          doc,
          `Anexo III ${g.grupoNombre} igual que en pantalla`,
          g.total,
          pantalla?.total ?? 0,
        )
        if (conAnterior)
          igual(
            doc,
            `Anexo III ${g.grupoNombre} (anterior) igual que en pantalla`,
            g.totalAnterior,
            pantalla?.totalAnterior ?? 0,
          )
      }
    } else if (s.tipo === 'notas') {
      // La transición a la RT 54 va dentro de la Nota 1 (con ajustes o reclasificaciones).
      const transicion = esc.documentos.aceptar.includes('NOTA_TRANSICION_RT54') && !!esc.transicion
      if (!/^1\.1\. /m.test(s.notaUno.texto)) {
        reg.hallazgo(
          'error',
          id,
          doc,
          'La Nota 1 (bases de preparación) no sale armada en el documento.',
        )
      }
      if (transicion !== (s.notaUno.transicion !== null)) {
        reg.hallazgo(
          'error',
          id,
          doc,
          `La nota de transición a la RT 54 ${transicion ? 'se aceptó y no sale' : 'sale sin haberse aceptado'}.`,
        )
      }
      if (s.notaUno.transicion) {
        const total = s.notaUno.transicion.nota.conciliacionPN.find((f) => f.esTotal)
        const inicio = sumarPor(
          pn.movimientos.filter(
            (m) => m.tipo === 'SALDO_INICIO' || m.tipo === 'MODIFICACION_INICIO',
          ),
          (m) =>
            sumar(
              m.capitalSuscripto,
              m.ajusteCapital,
              m.aportesIrrevocables,
              m.reservaLegal,
              m.otrasReservas,
              m.rdosNoAsignados,
            ),
        )
        igual(
          doc,
          'Conciliación del patrimonio neto (RT 54) = inicio modificado del E.E.P.N.',
          total?.importe,
          inicio,
        )
        for (const a of s.notaUno.transicion.nota.advertencias)
          reg.hallazgo('advertencia', id, doc, `Nota de transición: ${a}`)
      }
      for (const d of docs.filter(
        (doc2) => doc2.tipo === 'NOTA' && esc.documentos.descartar.includes(doc2.clave),
      )) {
        if (s.notas.some((n) => normalizar(n.titulo) === normalizar(d.titulo))) {
          reg.hallazgo('error', id, doc, `"${d.titulo}" se descartó y sale en el documento.`)
        }
      }
    }
  }
  if (iguales(activo, 0)) reg.hallazgo('error', id, ssp, 'El activo quedó en cero.')
}
