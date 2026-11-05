import { exigirSesion } from '@/lib/estudio-context'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { esUuid } from '@/lib/utils/uuid'
import { AlertTriangle, ChevronLeft, Printer, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProgresoEjercicio } from '@/components/layout/ProgresoEjercicio'
import { StepInfoButton } from '@/components/shared/StepInfoButton'
import { PASO_TITULO, PASO_INFO, articuloDePaso, isPasoKey, type InfoPasoKey } from './_info'

// Componentes de cada paso
import { CaratulaContent } from '@/modules/sociedades/components/CaratulaContent'
import { CuentasTable } from '@/modules/importaciones/components/CuentasTable'
import { ClasificacionTable } from '@/modules/importaciones/components/ClasificacionTable'
import { PasoAnteriorView } from '@/modules/ejercicios/components/PasoAnteriorView'
import { BienesDeUsoView } from '@/modules/bienes-de-uso/components/BienesDeUsoView'
import { CostoVentasView } from '@/modules/costo-ventas/components/CostoVentasView'
import { GastosView } from '@/modules/gastos/components/GastosView'
import { NotasView } from '@/modules/notas/components/NotasView'
import { NotaTransicionCard } from '@/modules/transicion-rt54/components/NotaTransicionCard'
import { PatrimonioNetoView } from '@/modules/patrimonio-neto/components/PatrimonioNetoView'
import { EstadosView } from '@/modules/estados/components/EstadosView'
import { FlujoEfectivoView } from '@/modules/flujo-efectivo/components/FlujoEfectivoView'
import { cargarFlujo } from '@/modules/flujo-efectivo/services/flujo.service'
import { cargarBienesDeUso } from '@/modules/bienes-de-uso/services/bienes-de-uso.service'
import { cargarCostoVentas } from '@/modules/costo-ventas/services/costo-ventas.service'
import { cargarGastos } from '@/modules/gastos/services/gastos.service'
import { ANEXOS_CON_VISTA } from '@/modules/documentos/domain/anexos'
import { DocumentosView } from '@/modules/documentos/components/DocumentosView'
import { AnexosTabs, AnexoEnConstruccion, type AnexoTab } from '@/components/shared/AnexosTabs'

// Repositorios y servicios
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  findCuentasByEjercicio,
  findRubrosBase,
  resumenCuentasByEjercicio,
} from '@/modules/importaciones/repository/cuentas.repository'
import { findBienesDeUso } from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { cargarNotas } from '@/modules/notas/services/notas.service'
import { findAjustesByEjercicio } from '@/modules/transicion-rt54/repository/ajustes.repository'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import { cargarEstadosConPN, totalesAnteriorSSP } from '@/modules/estados/services/estados.service'
import { evaluarAutorizacionSinPersistir } from '@/modules/ejercicios/services/autorizacion.service'
import { armarNotaUno } from '@/modules/notas/domain/notaUno'
import { formatFecha } from '@/lib/utils/dates'
import { NotaUnoCard } from '@/modules/notas/components/NotaUnoCard'
import { previsualizarNotaTransicion } from '@/modules/transicion-rt54/services/nota-transicion.service'
import { inclusionNotaTransicion } from '@/modules/transicion-rt54/domain/inclusion'
import { armarBloquesComparativo } from '@/modules/ejercicios/lib/bloquesComparativo'

// Dominio
import {
  diaAnteriorUTC,
  idAnteriorDerivable,
  modoEfectivo,
} from '@/modules/ejercicios/domain/ejercicioAnterior'
import {
  editarAnteriorManual,
  mostrarColumnaAnterior,
} from '@/modules/comparativo-manual/lib/politica'
import { getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import { anteriorAjustado } from '@/modules/comparativo-manual/lib/ajuste'
import { totalAnteriorFila } from '@/modules/patrimonio-neto/domain/evolucion'
import { db } from '@/lib/db'

// Las pestañas del paso "Anexos" son los anexos ACEPTADOS en "Anexos y notas", en el
// orden fijo del catálogo (documentos/domain/anexos.ts, compartido con el documento).

// Pasos que necesitan conocer el ejercicio anterior vinculado.
const PASOS_CON_ANTERIOR = ['anterior', 'anexos', 'notas', 'patrimonio-neto', 'estados']

// ─── Página ───────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string; ejercicioId: string }>
  searchParams: Promise<{ paso?: string; anexo?: string }>
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { ejercicioId } = await params
  const { paso } = await searchParams
  const ejercicio = await findEjercicioById(ejercicioId)
  const titulo = isPasoKey(paso) ? `${PASO_TITULO[paso]} — ` : ''
  return { title: ejercicio ? `${titulo}${ejercicio.denominacion}` : 'Cuentas' }
}

export default async function CuentasPage({ params, searchParams }: Props) {
  const { id, ejercicioId } = await params
  const { paso, anexo } = await searchParams
  // La primera oleada consulta por estos ids en paralelo: uno mal formado haría fallar a la base.
  if (!esUuid(id) || !esUuid(ejercicioId)) notFound()
  const base = `/sociedades/${id}/ejercicios/${ejercicioId}/cuentas`

  // ── Oleada 1: datos base + insumos del stepper (todo depende solo de los ids) ─
  const [
    sociedad,
    ejercicio,
    resumenCuentas,
    countBDU,
    costoExiste,
    countNotas,
    tieneGastosClasificados,
    documentosEval,
  ] = await Promise.all([
    findSociedadById(id),
    findEjercicioById(ejercicioId),
    resumenCuentasByEjercicio(ejercicioId),
    db.bienDeUsoCategoria.count({ where: { ejercicioId } }),
    db.costoVentasEjercicio.findFirst({ where: { ejercicioId }, select: { id: true } }),
    db.notaEjercicio.count({ where: { ejercicioId } }),
    db.cuentaContable.findFirst({
      where: { ejercicioId, rubroBase: { rubroGrupo: { esGasto: true } } },
      select: { id: true },
    }),
    evaluarDocumentos(ejercicioId),
  ])

  if (!sociedad || !ejercicio) notFound()

  const totalCuentas = resumenCuentas.total
  const sinClasificar = resumenCuentas.sinClasificar
  const tieneBDU = countBDU > 0
  const tieneCostoVentas = costoExiste !== null
  const tieneNotas = countNotas > 0
  const tieneGastos = tieneGastosClasificados !== null
  const pnConfirmado = ejercicio.pnConfirmado ?? false

  // ── Ejercicio anterior: política única por modo ─────────────────────────────
  const modo = modoEfectivo(ejercicio)
  const anteriorId = idAnteriorDerivable(ejercicio)
  const mostrarAnterior = mostrarColumnaAnterior(modo)
  // Ya ajustado, la columna anterior no se edita: se corrige desde el paso Ejercicio anterior.
  const editarAnterior = editarAnteriorManual(modo) && !anteriorAjustado(ejercicio)
  const coeficiente = getCoeficienteComparativo(ejercicio)
  const esPrimeraAdopcion = ejercicio.adopcionRT54 === 'PRIMERA_ADOPCION'

  // ── Anexos aceptados (pestañas del paso "Anexos") ───────────────────────────
  const documentosSugeridos = documentosEval.filter(
    (d) => d.estado === 'SUGERIDO' && !d.referenciaAnioAnterior,
  ).length
  const anexosAceptadosSet = new Set(
    documentosEval.filter((d) => d.tipo === 'ANEXO' && d.estado === 'ACEPTADO').map((d) => d.clave),
  )
  const anexosAceptados = anexosAceptadosSet.size
  const anexosCompletos =
    anexosAceptados > 0 &&
    (!anexosAceptadosSet.has('ANEXO_BIENES_USO') || tieneBDU) &&
    (!anexosAceptadosSet.has('ANEXO_COSTO_VENTAS') || tieneCostoVentas) &&
    (!anexosAceptadosSet.has('ANEXO_GASTOS') || tieneGastos)

  // ── Ejercicio anterior vinculado (solo cuando el paso lo necesita) ──────────
  const necesitaAnterior = PASOS_CON_ANTERIOR.includes(paso ?? '')
  const ejercicioAnterior =
    necesitaAnterior && anteriorId ? await findEjercicioById(anteriorId) : null
  // En carga manual, el cierre del anterior es, por definición, el día previo al inicio.
  const origenAnterior = anteriorAjustado(ejercicio)
    ? 'lo cargado a mano, ajustado por inflación'
    : (ejercicioAnterior?.denominacion ?? null)
  const fechaCierreAnterior =
    ejercicioAnterior?.fechaCierre ??
    (mostrarAnterior ? diaAnteriorUTC(ejercicio.fechaInicio) : null)

  // ── Contenido del paso activo ───────────────────────────────────────────────
  let content: React.ReactNode

  if (paso === 'caratula') {
    content = <CaratulaContent sociedad={sociedad} ejercicio={ejercicio} />
  } else if (paso === 'clasificar') {
    const [cuentas, rubros] = await Promise.all([
      findCuentasByEjercicio(ejercicioId),
      findRubrosBase(ejercicio.estudioId),
    ])
    content = (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/configuracion/rubros?volver=${base}?paso=clasificar`}>
              <Tags className="mr-1.5 h-3.5 w-3.5" />
              Gestionar clasificaciones
            </Link>
          </Button>
        </div>
        <ClasificacionTable
          cuentas={cuentas}
          rubros={rubros}
          ejercicioId={ejercicioId}
          sociedadId={id}
        />
      </div>
    )
  } else if (paso === 'anterior') {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    const [estados, bienes, notas] = await Promise.all([
      cargarEstadosConPN(ejercicio, cuentas),
      tieneBDU ? findBienesDeUso(ejercicioId) : Promise.resolve([]),
      tieneNotas ? findNotasByEjercicio(ejercicioId) : Promise.resolve([]),
    ])
    const evaluacion = await evaluarAutorizacionSinPersistir(ejercicio, { estados })
    // Lo que se controla es lo cargado: los importes ajustados no se comparan exactos entre sí.
    const delCuadre = estados.cargado ?? estados
    const cuadre = totalesAnteriorSSP(delCuadre.estadosData, delCuadre.pnData)
    content = (
      <PasoAnteriorView
        ejercicio={ejercicio}
        sociedadId={id}
        modo={modo}
        anterior={
          ejercicioAnterior
            ? {
                id: ejercicioAnterior.id,
                denominacion: ejercicioAnterior.denominacion,
                fechaCierre: ejercicioAnterior.fechaCierre,
                estado: ejercicioAnterior.estado,
                estadosConfirmado: ejercicioAnterior.estadosConfirmado,
                pnConfirmado: ejercicioAnterior.pnConfirmado,
              }
            : null
        }
        coeficiente={coeficiente}
        fechaCierreAnterior={fechaCierreAnterior}
        bloques={
          modo === 'MANUAL'
            ? armarBloquesComparativo({
                base,
                estadosData: estados.estadosData,
                pnData: estados.pnData,
                comparativos: estados.comparativos,
                bienes,
                notas,
                tieneBDU,
                tieneCostoVentas,
                tieneNotas,
              })
            : []
        }
        cuadre={{ ...cuadre, diferencia: cuadre.activo - (cuadre.pasivo + cuadre.patrimonioNeto) }}
        resultadoAnterior={{
          eerr: delCuadre.estadosData.eerr.utilidadEjercicioAnt,
          eepn: totalAnteriorFila(delCuadre.pnData.movimientos, 'RESULTADO_EJERCICIO'),
        }}
        evaluacion={evaluacion}
        auditorNombre={ejercicio.auditorNombre}
      />
    )
  } else if (paso === 'anexos') {
    const tabs: AnexoTab[] = ANEXOS_CON_VISTA.filter((a) => anexosAceptadosSet.has(a.clave)).map(
      ({ slug, label }) => ({ slug, label, hasView: true }),
    )
    const enConfig = anexo === 'configuracion' || tabs.length === 0
    const activeSlug = enConfig
      ? ''
      : (tabs.find((t) => t.slug === anexo)?.slug ?? tabs[0]?.slug ?? '')

    let anexoContent: React.ReactNode = null
    if (enConfig) {
      anexoContent = (
        <DocumentosView
          documentos={documentosEval}
          ejercicioId={ejercicioId}
          sociedadId={id}
          notas={(await findNotasByEjercicio(ejercicioId)).map((n) => ({
            id: n.id,
            numero: n.numero,
            titulo: n.titulo,
          }))}
        />
      )
    } else if (activeSlug === 'bienes-de-uso') {
      const [arrastre, sesion] = await Promise.all([cargarBienesDeUso(ejercicio), exigirSesion()])
      // El formato del anexo en el documento: lo cambia el dueño o un contador, y no en un cerrado
      const formatoNoSePuedeCambiar =
        ejercicio.estado === 'CERRADO'
          ? 'Este balance está cerrado: el anexo queda con el formato con que se emitió.'
          : sesion.rol === 'ASISTENTE'
            ? 'El formato lo elige el dueño o un contador del estudio.'
            : null
      anexoContent = (
        <BienesDeUsoView
          bienes={arrastre.bienes}
          netoAnteriorMap={arrastre.netoAnteriorMap}
          netoCargadoMap={arrastre.netoCargadoMap}
          bloqueadas={Array.from(arrastre.bloqueadas)}
          advertencias={arrastre.advertencias}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          formatoAnexo={ejercicio.anexoBienesUso}
          columnasDocumento={{
            fechaInicio: ejercicio.fechaInicio,
            fechaCierre: ejercicio.fechaCierre,
            fechaCierreAnterior,
            mostrarAnterior,
            anteriorManual: editarAnteriorManual(modo),
          }}
          formatoNoSePuedeCambiar={formatoNoSePuedeCambiar}
        />
      )
    } else if (activeSlug === 'costo-ventas') {
      const costo = await cargarCostoVentas(ejercicio)
      anexoContent = (
        <CostoVentasView
          datos={costo.datos}
          datosAnteriores={costo.datosAnteriores}
          existenciaInicialBloqueada={costo.existenciaInicialBloqueada}
          existenciaInicialDerivada={costo.existenciaInicialDerivada}
          advertencias={costo.advertencias}
          existenciaFinalAnteriorPropuesta={costo.existenciaFinalAnteriorPropuesta}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          conceptosExtra={costo.conceptosExtra}
          cargado={costo.cargado}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
        />
      )
    } else if (activeSlug === 'gastos') {
      anexoContent = (
        <GastosView
          data={await cargarGastos(ejercicio)}
          ejercicioId={ejercicioId}
          sociedadId={id}
          conComparativo={mostrarAnterior}
          editarAnterior={editarAnterior}
        />
      )
    } else if (activeSlug) {
      const label = tabs.find((t) => t.slug === activeSlug)?.label ?? 'anexo'
      anexoContent = <AnexoEnConstruccion label={`Anexo de ${label}`} />
    }

    content = (
      <AnexosTabs
        tabs={tabs}
        active={activeSlug}
        configActivo={enConfig}
        sugeridos={documentosSugeridos}
        basePath={base}
      >
        {anexoContent}
      </AnexosTabs>
    )
  } else if (paso === 'notas') {
    // Regla única (también la usa el documento imprimible): como los anexos, aparece solo si el
    // contador la incluyó en la configuración de anexos; si no, queda una advertencia.
    const inclusion = inclusionNotaTransicion(esPrimeraAdopcion, documentosEval)
    const [notas, ajustes] = await Promise.all([
      cargarNotas(ejercicio),
      inclusion.incluir ? findAjustesByEjercicio(ejercicioId) : Promise.resolve([]),
    ])
    const notaTransicion = inclusion.incluir
      ? await previsualizarNotaTransicion(ejercicio, { ajustes })
      : null
    // Nota 1: la arma la app con los datos del ejercicio; el contador puede escribir la suya.
    const notaUno = armarNotaUno({
      sociedad,
      ejercicio,
      conComparativo: mostrarAnterior,
      transicion: notaTransicion,
    })
    content = (
      <div className="max-w-4xl space-y-6">
        <NotasView
          notas={notas}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          origenAnterior={origenAnterior}
          tieneCuentasClasificadas={totalCuentas > sinClasificar}
          configNotaI={{
            adopcionRT54: ejercicio.adopcionRT54 ?? null,
            criteriosBienesCambio: ejercicio.criteriosBienesCambio ?? null,
            hechosPosterioress: ejercicio.hechosPosterioress ?? null,
            hechosPosterioressTexto: ejercicio.hechosPosterioressTexto ?? null,
          }}
          antesDeLasNotas={
            <>
              <NotaUnoCard
                nota={{
                  titulo: notaUno.titulo,
                  textoPropio: ejercicio.notaUnoTexto,
                  textoGenerado: notaUno.textoGenerado,
                  editadaEn: notaUno.editadaEn ? formatFecha(notaUno.editadaEn) : null,
                  transicion: notaUno.transicion,
                  advertencias: notaUno.advertencias,
                }}
                ejercicioId={ejercicioId}
                sociedadId={id}
                editable={ejercicio.estado !== 'CERRADO'}
              />
              {!inclusion.incluir && inclusion.motivo === 'NO_INCLUIDA' && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  {inclusion.advertencia}
                </p>
              )}
              {notaTransicion && (
                <NotaTransicionCard
                  ejercicioId={ejercicioId}
                  sociedadId={id}
                  ajustes={ajustes}
                  nota={notaTransicion}
                />
              )}
            </>
          }
        />
      </div>
    )
  } else if (paso === 'patrimonio-neto') {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    const { pnData, cargado } = await cargarEstadosConPN(ejercicio, cuentas)
    content = (
      <PatrimonioNetoView
        data={pnData}
        ejercicioId={ejercicioId}
        sociedadId={id}
        fechaCierre={ejercicio.fechaCierre}
        fechaCierreAnterior={fechaCierreAnterior}
        mostrarAnterior={mostrarAnterior}
        anteriorDenominacion={origenAnterior}
        pnConfirmado={pnConfirmado}
        cargado={cargado?.pnData.movimientos}
      />
    )
  } else if (paso === 'estados') {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    const { estadosData, pnData, cargado, notasParaUbicar } = await cargarEstadosConPN(
      ejercicio,
      cuentas,
    )
    const flujo = await cargarFlujo(ejercicio, estadosData)
    content = (
      <EstadosView
        data={{
          ...estadosData,
          patrimonioNetoFinal: pnData.totalActual,
          patrimonioNetoFinalAnt: pnData.totalAnterior,
        }}
        ejercicioId={ejercicioId}
        sociedadId={id}
        estadosConfirmado={ejercicio.estadosConfirmado}
        editarAnterior={editarAnterior}
        fechaCierre={ejercicio.fechaCierre}
        fechaCierreAnterior={fechaCierreAnterior}
        anteriorDenominacion={ejercicioAnterior?.denominacion ?? null}
        notasParaUbicar={editarAnterior ? notasParaUbicar : undefined}
        cargado={
          cargado && {
            ...cargado.estadosData,
            patrimonioNetoFinal: cargado.pnData.totalActual,
            patrimonioNetoFinalAnt: cargado.pnData.totalAnterior,
          }
        }
        flujo={
          <FlujoEfectivoView
            data={flujo}
            ejercicioId={ejercicioId}
            sociedadId={id}
            fechaInicio={ejercicio.fechaInicio}
            fechaCierre={ejercicio.fechaCierre}
            fechaCierreAnterior={fechaCierreAnterior}
            anteriorDenominacion={origenAnterior}
          />
        }
      />
    )
  } else {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    content = <CuentasTable cuentas={cuentas} sociedadId={id} ejercicioId={ejercicioId} />
  }

  const titulo = isPasoKey(paso) ? PASO_TITULO[paso] : ejercicio.denominacion
  const pasoInfoKey: InfoPasoKey = isPasoKey(paso) ? paso : 'balance'

  return (
    <div>
      <PageHeader
        title={titulo}
        description={`${sociedad.razonSocial} — ${ejercicio.denominacion}`}
        action={
          <div className="flex items-center gap-2">
            <StepInfoButton
              info={PASO_INFO[pasoInfoKey]}
              ayudaHref={`/ayuda#${articuloDePaso(pasoInfoKey)}`}
            />
            <Button variant="secondary" size="sm" asChild>
              <a
                href={`/sociedades/${id}/ejercicios/${ejercicioId}/imprimir`}
                target="_blank"
                rel="noopener"
              >
                <Printer className="mr-1 h-3.5 w-3.5" />
                Imprimir / PDF
              </a>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/sociedades/${id}/ejercicios`}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Ejercicios
              </Link>
            </Button>
          </div>
        }
      />
      <div className="px-8 py-6">
        <ProgresoEjercicio
          sociedadId={id}
          ejercicioId={ejercicioId}
          totalCuentas={totalCuentas}
          sinClasificar={sinClasificar}
          pasoActivo={paso}
          tieneNotas={tieneNotas}
          pnConfirmado={pnConfirmado}
          estadosConfirmado={ejercicio.estadosConfirmado}
          anexosAceptados={anexosAceptados}
          anexosCompletos={anexosCompletos}
          modoAnterior={modo}
          comparativoAutorizado={ejercicio.comparativoAutorizadoEn !== null}
          tieneVinculo={ejercicio.ejercicioAnteriorId !== null}
        />
        {content}
      </div>
    </div>
  )
}
