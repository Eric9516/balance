import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProgresoEjercicio } from '@/components/layout/ProgresoEjercicio'
import { StepInfoButton } from '@/components/shared/StepInfoButton'
import { PASO_TITULO, PASO_INFO, isPasoKey, type InfoPasoKey } from './_info'

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
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { findGastosDinamicos } from '@/modules/gastos/repository/gastos-dinamico.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import { findAjustesByEjercicio } from '@/modules/transicion-rt54/repository/ajustes.repository'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import { cargarEstadosConPN, totalesAnteriorSSP } from '@/modules/estados/services/estados.service'
import { evaluarAutorizacionSinPersistir } from '@/modules/ejercicios/services/autorizacion.service'
import { previsualizarNotaTransicion } from '@/modules/transicion-rt54/services/nota-transicion.service'
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
  resolverCostoVentasAnterior,
  resolverGastos,
} from '@/modules/comparativo-manual/lib/politica'
import {
  aplicarArrastreBienesDeUso,
  derivarArrastreBienesDeUso,
} from '@/modules/bienes-de-uso/domain/saldosInicio'
import { aplicarArrastreCostoVentas } from '@/modules/costo-ventas/domain/saldosInicio'
import { ajustarCostoVentas, getCoeficienteComparativo } from '@/modules/estados/lib/ajuste'
import { totalAnteriorFila } from '@/modules/patrimonio-neto/domain/evolucion'
import { db } from '@/lib/db'

// ─── Anexos: mapeo regla → pestaña ────────────────────────────────────────────
// Las pestañas del paso "Anexos" son los anexos ACEPTADOS en "Anexos y notas".
const ANEXO_TABS_META: Record<string, { slug: string; label: string; hasView: boolean }> = {
  ANEXO_BIENES_USO: { slug: 'bienes-de-uso', label: 'Bs. de Uso', hasView: true },
  ANEXO_COSTO_VENTAS: { slug: 'costo-ventas', label: 'Cto. Ventas', hasView: true },
  ANEXO_GASTOS: { slug: 'gastos', label: 'Gastos', hasView: true },
}
// Orden fijo de las pestañas (independiente del orden en que se aceptaron).
const ANEXO_ORDEN = ['ANEXO_BIENES_USO', 'ANEXO_COSTO_VENTAS', 'ANEXO_GASTOS']

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
  const editarAnterior = editarAnteriorManual(modo)
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
      findRubrosBase(),
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
    const cuadre = totalesAnteriorSSP(estados.estadosData, estados.pnData)
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
          eerr: estados.estadosData.eerr.utilidadEjercicioAnt,
          eepn: totalAnteriorFila(estados.pnData.movimientos, 'RESULTADO_EJERCICIO'),
        }}
        evaluacion={evaluacion}
        auditorNombre={ejercicio.auditorNombre}
      />
    )
  } else if (paso === 'anexos') {
    const tabs: AnexoTab[] = ANEXO_ORDEN.filter((clave) => anexosAceptadosSet.has(clave)).flatMap(
      (clave) => ANEXO_TABS_META[clave] ?? [],
    )
    const enConfig = anexo === 'configuracion' || tabs.length === 0
    const activeSlug = enConfig
      ? ''
      : (tabs.find((t) => t.slug === anexo)?.slug ?? tabs[0]?.slug ?? '')

    let anexoContent: React.ReactNode = null
    if (enConfig) {
      anexoContent = (
        <DocumentosView documentos={documentosEval} ejercicioId={ejercicioId} sociedadId={id} />
      )
    } else if (activeSlug === 'bienes-de-uso') {
      const [bienesRaw, bienesAnterior] = await Promise.all([
        findBienesDeUso(ejercicioId),
        anteriorId ? findBienesDeUso(anteriorId) : Promise.resolve([]),
      ])
      const arrastre = aplicarArrastreBienesDeUso(
        bienesRaw,
        anteriorId ? derivarArrastreBienesDeUso(bienesAnterior) : null,
        modo,
      )
      anexoContent = (
        <BienesDeUsoView
          bienes={arrastre.bienes}
          netoAnteriorMap={arrastre.netoAnteriorMap}
          bloqueadas={Array.from(arrastre.bloqueadas)}
          advertencias={arrastre.advertencias}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
        />
      )
    } else if (activeSlug === 'costo-ventas') {
      const [datos, cvAnteriorRaw, comparativosCV] = await Promise.all([
        findCostoVentas(ejercicioId),
        anteriorId ? findCostoVentas(anteriorId) : Promise.resolve(null),
        editarAnterior
          ? findComparativoByEjercicio(ejercicioId, 'COSTO_VENTAS')
          : Promise.resolve([]),
      ])
      const arrastre = aplicarArrastreCostoVentas(datos, cvAnteriorRaw, modo)
      const datosAnteriores = resolverCostoVentasAnterior(
        ajustarCostoVentas(cvAnteriorRaw, coeficiente),
        modo,
        comparativosCV,
        ejercicioId,
      )
      anexoContent = (
        <CostoVentasView
          datos={arrastre.datos}
          datosAnteriores={datosAnteriores}
          existenciaInicialBloqueada={arrastre.existenciaInicialBloqueada}
          existenciaInicialDerivada={arrastre.existenciaInicialDerivada}
          advertencias={arrastre.advertencias}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          conceptosExtra={comparativosCV.filter((c) => c.esHuerfano)}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
        />
      )
    } else if (activeSlug === 'gastos') {
      const [gastosRaw, comparativosGastos] = await Promise.all([
        findGastosDinamicos(ejercicioId, anteriorId),
        editarAnterior ? findComparativoByEjercicio(ejercicioId, 'GASTOS') : Promise.resolve([]),
      ])
      anexoContent = (
        <GastosView
          data={resolverGastos(gastosRaw, modo, comparativosGastos)}
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
    const [notas, ajustes] = await Promise.all([
      findNotasByEjercicio(ejercicioId),
      esPrimeraAdopcion ? findAjustesByEjercicio(ejercicioId) : Promise.resolve([]),
    ])
    const notaTransicion = esPrimeraAdopcion
      ? await previsualizarNotaTransicion(ejercicio, { ajustes })
      : null
    content = (
      <div className="max-w-4xl space-y-6">
        {esPrimeraAdopcion && notaTransicion && (
          <NotaTransicionCard
            ejercicioId={ejercicioId}
            sociedadId={id}
            ajustes={ajustes}
            nota={notaTransicion}
          />
        )}
        <NotasView
          notas={notas}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          mostrarAnterior={mostrarAnterior}
          editarAnterior={editarAnterior}
          tieneCuentasClasificadas={totalCuentas > sinClasificar}
          configNotaI={{
            adopcionRT54: ejercicio.adopcionRT54 ?? null,
            criteriosBienesCambio: ejercicio.criteriosBienesCambio ?? null,
            hechosPosterioress: ejercicio.hechosPosterioress ?? null,
            hechosPosterioressTexto: ejercicio.hechosPosterioressTexto ?? null,
          }}
        />
      </div>
    )
  } else if (paso === 'patrimonio-neto') {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    const { pnData } = await cargarEstadosConPN(ejercicio, cuentas)
    content = (
      <PatrimonioNetoView
        data={pnData}
        ejercicioId={ejercicioId}
        sociedadId={id}
        fechaCierre={ejercicio.fechaCierre}
        fechaCierreAnterior={fechaCierreAnterior}
        mostrarAnterior={mostrarAnterior}
        anteriorDenominacion={ejercicioAnterior?.denominacion ?? null}
        pnConfirmado={pnConfirmado}
      />
    )
  } else if (paso === 'estados') {
    const cuentas = await findCuentasByEjercicio(ejercicioId)
    const { estadosData, pnData } = await cargarEstadosConPN(ejercicio, cuentas)
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
        flujo={
          <FlujoEfectivoView
            data={flujo}
            ejercicioId={ejercicioId}
            sociedadId={id}
            fechaInicio={ejercicio.fechaInicio}
            fechaCierre={ejercicio.fechaCierre}
            fechaCierreAnterior={fechaCierreAnterior}
            anteriorDenominacion={ejercicioAnterior?.denominacion ?? null}
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
            <StepInfoButton info={PASO_INFO[pasoInfoKey]} />
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
