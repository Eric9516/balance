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
import { BienesDeUsoView } from '@/modules/bienes-de-uso/components/BienesDeUsoView'
import { CostoVentasView } from '@/modules/costo-ventas/components/CostoVentasView'
import { GastosView } from '@/modules/gastos/components/GastosView'
import { NotasView } from '@/modules/notas/components/NotasView'
import { PatrimonioNetoView } from '@/modules/patrimonio-neto/components/PatrimonioNetoView'
import { EstadosView } from '@/modules/estados/components/EstadosView'
import { DocumentosView } from '@/modules/documentos/components/DocumentosView'
import { AnexosTabs, AnexoEnConstruccion, type AnexoTab } from '@/components/shared/AnexosTabs'

// Repositorios
import { findSociedadById } from '@/modules/sociedades/repository/sociedad.repository'
import { findEjercicioById } from '@/modules/ejercicios/repository/ejercicio.repository'
import {
  findCuentasByEjercicio,
  findRubrosBase,
} from '@/modules/importaciones/repository/cuentas.repository'
import {
  findBienesDeUso,
  findNetoResidualAnterior,
} from '@/modules/bienes-de-uso/repository/bienes-de-uso.repository'
import { findCostoVentas } from '@/modules/costo-ventas/repository/costo-ventas.repository'
import { findGastosDinamicos } from '@/modules/gastos/repository/gastos-dinamico.repository'
import { findNotasByEjercicio } from '@/modules/notas/repository/notas.repository'
import {
  buildEvolucionPNDefaultsDesdeAnterior,
  findEvolucionPN,
} from '@/modules/patrimonio-neto/repository/patrimonio-neto.repository'
import { buildEstadosData } from '@/modules/estados/lib/aggregate'
import { evaluarDocumentos } from '@/modules/documentos/lib/evaluar'
import {
  getCoeficienteComparativo,
  ajustarCuentas,
  ajustarCostoVentas,
} from '@/modules/estados/lib/ajuste'
import { findComparativoByEjercicio } from '@/modules/comparativo-manual/repository/comparativo.repository'
import {
  applyComparativosToEstados,
  applyComparativosToGastos,
  buildCostoVentasAntFromComparativos,
} from '@/modules/comparativo-manual/lib/apply'
import { db } from '@/lib/db'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'

// ─── Anexos: mapeo regla → pestaña ────────────────────────────────────────────
// Las pestañas del paso "Anexos" son los anexos ACEPTADOS en "Anexos y notas".
// `hasView` indica si ya existe la pantalla para cargarlo.
const ANEXO_TABS_META: Record<string, { slug: string; label: string; hasView: boolean }> = {
  ANEXO_BIENES_USO: { slug: 'bienes-de-uso', label: 'Bs. de Uso', hasView: true },
  ANEXO_COSTO_VENTAS: { slug: 'costo-ventas', label: 'Cto. Ventas', hasView: true },
  ANEXO_GASTOS: { slug: 'gastos', label: 'Gastos', hasView: true },
}
// Orden fijo de las pestañas (independiente del orden en que se aceptaron).
const ANEXO_ORDEN = ['ANEXO_BIENES_USO', 'ANEXO_COSTO_VENTAS', 'ANEXO_GASTOS']

// ─── Helper: fetch compartido por los pasos patrimonio-neto y estados ─────────
// Ambos necesitan exactamente los mismos datos; se centraliza acá para no duplicar.

async function fetchEstadosConPN(
  ejercicioId: string,
  ejercicio: EjercicioContableDTO,
  cuentas: CuentaContableDTO[],
) {
  const coeficiente = getCoeficienteComparativo(ejercicio)
  const [rubros, cuentasAntRaw, costoVentas, costoVentasAntRaw, gastosDinamicos, notas] =
    await Promise.all([
      findRubrosBase(),
      ejercicio.ejercicioAnteriorId
        ? findCuentasByEjercicio(ejercicio.ejercicioAnteriorId)
        : Promise.resolve([] as CuentaContableDTO[]),
      findCostoVentas(ejercicioId),
      ejercicio.ejercicioAnteriorId
        ? findCostoVentas(ejercicio.ejercicioAnteriorId)
        : Promise.resolve(null),
      findGastosDinamicos(ejercicioId, ejercicio.ejercicioAnteriorId ?? null),
      findNotasByEjercicio(ejercicioId),
    ])

  const estadosData = buildEstadosData(cuentas, rubros, {
    cuentasAnt: ajustarCuentas(cuentasAntRaw, coeficiente),
    costoVentas,
    costoVentasAnt: ajustarCostoVentas(costoVentasAntRaw, coeficiente),
    gastosDinamicos,
    notas,
    // Si no hay anterior vinculado pero hay comparativos manuales, tratar como
    // si hubiera anterior para que las columnas comparativas se muestren en los estados.
    hayEjercicioAnterior: !!ejercicio.ejercicioAnteriorId || !ejercicio.balanceAnteriorDisponible,
  })

  const pnDefaults = await buildEvolucionPNDefaultsDesdeAnterior(
    ejercicio.ejercicioAnteriorId,
    coeficiente,
  )
  const pnData = await findEvolucionPN(ejercicioId, estadosData.eerr.utilidadEjercicio, pnDefaults)

  return { estadosData, pnData }
}

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

  // ── Datos base (siempre) ────────────────────────────────────────────────────
  const [sociedad, ejercicio, cuentas] = await Promise.all([
    findSociedadById(id),
    findEjercicioById(ejercicioId),
    findCuentasByEjercicio(ejercicioId),
  ])

  if (!sociedad || !ejercicio) notFound()

  const totalCuentas = cuentas.length
  const sinClasificar = cuentas.filter((c) => !c.rubroBaseId).length

  // ── Completado de pasos (queries lightweight, siempre) ──────────────────────
  const [countBDU, costoExiste, countNotas, tieneGastosClasificados] = await Promise.all([
    db.bienDeUsoCategoria.count({ where: { ejercicioId } }),
    db.costoVentasEjercicio.findFirst({ where: { ejercicioId }, select: { id: true } }),
    db.notaEjercicio.count({ where: { ejercicioId } }),
    db.cuentaContable.findFirst({
      where: { ejercicioId, rubroBase: { rubroGrupo: { esGasto: true } } },
      select: { id: true },
    }),
  ])
  const tieneBDU = countBDU > 0
  const tieneCostoVentas = costoExiste !== null
  const tieneNotas = countNotas > 0
  const tieneGastos = tieneGastosClasificados !== null
  const tieneEjercicioAnterior = ejercicio.ejercicioAnteriorId !== null
  // Requiere comparativos manuales cuando el balance anterior no está disponible,
  // independientemente de si hay o no un ejercicio anterior vinculado en el sistema.
  const requiereComparativoManual = !ejercicio.balanceAnteriorDisponible
  const pnConfirmado = ejercicio.pnConfirmado ?? false

  // ── Anexos/notas sugeridos ───────────────────────────────────────────────────
  // Se evalúan SIEMPRE según los saldos del ejercicio ACTUAL, haya o no ejercicio
  // anterior vinculado. El anterior solo aporta comparativos (por otro camino) y,
  // a lo sumo, una referencia blanda de qué se incluía el año pasado.
  const documentosEval = await evaluarDocumentos(ejercicioId)
  const documentosSugeridos = documentosEval.filter(
    (d) => d.estado === 'SUGERIDO' && !d.referenciaAnioAnterior,
  ).length

  // ── Anexos aceptados (pestañas del paso "Anexos") ───────────────────────────
  const anexosAceptadosSet = new Set(
    documentosEval.filter((d) => d.tipo === 'ANEXO' && d.estado === 'ACEPTADO').map((d) => d.clave),
  )
  const anexosAceptados = anexosAceptadosSet.size
  // "Completos" = los anexos aceptados que YA tienen pantalla, ¿tienen datos cargados?
  const anexosCompletos =
    anexosAceptados > 0 &&
    (!anexosAceptadosSet.has('ANEXO_BIENES_USO') || tieneBDU) &&
    (!anexosAceptadosSet.has('ANEXO_COSTO_VENTAS') || tieneCostoVentas) &&
    (!anexosAceptadosSet.has('ANEXO_GASTOS') || tieneGastos)

  // ── Ejercicio anterior (solo cuando el paso lo necesita) ────────────────────
  const necesitaAnterior = ['anexos', 'notas', 'patrimonio-neto', 'estados'].includes(paso ?? '')
  const ejercicioAnterior =
    necesitaAnterior && ejercicio.ejercicioAnteriorId
      ? await findEjercicioById(ejercicio.ejercicioAnteriorId)
      : null
  const fechaCierreAnterior = ejercicioAnterior?.fechaCierre ?? null

  // ── Contenido del paso activo ───────────────────────────────────────────────
  let content: React.ReactNode

  if (paso === 'caratula') {
    content = <CaratulaContent sociedad={sociedad} ejercicio={ejercicio} />
  } else if (paso === 'clasificar') {
    const rubros = await findRubrosBase()
    content = (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" asChild>
            <Link
              href={`/configuracion/rubros?volver=/sociedades/${id}/ejercicios/${ejercicioId}/cuentas?paso=clasificar`}
            >
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
  } else if (paso === 'anexos') {
    // Pestañas = anexos ACEPTADOS, en orden fijo.
    const tabs: AnexoTab[] = ANEXO_ORDEN.filter((clave) => anexosAceptadosSet.has(clave)).flatMap(
      (clave) => ANEXO_TABS_META[clave] ?? [],
    )
    // Configuración: explícita (?anexo=configuracion) o por defecto si no hay anexos aún.
    const enConfig = anexo === 'configuracion' || tabs.length === 0
    const activeSlug = enConfig
      ? ''
      : (tabs.find((t) => t.slug === anexo)?.slug ?? tabs[0]?.slug ?? '')

    let anexoContent: React.ReactNode = null
    if (enConfig) {
      // La pantalla de elegir qué anexos/notas van, ahora adentro de "Anexos".
      anexoContent = (
        <DocumentosView documentos={documentosEval} ejercicioId={ejercicioId} sociedadId={id} />
      )
    } else if (activeSlug === 'bienes-de-uso') {
      const [bienes, netoAnteriorMapDb] = await Promise.all([
        findBienesDeUso(ejercicioId),
        ejercicio.ejercicioAnteriorId
          ? findNetoResidualAnterior(ejercicio.ejercicioAnteriorId)
          : Promise.resolve(new Map<string, number>()),
      ])
      anexoContent = (
        <BienesDeUsoView
          bienes={bienes}
          netoAnteriorMap={netoAnteriorMapDb}
          hayEjercicioAnterior={!!ejercicio.ejercicioAnteriorId}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
        />
      )
    } else if (activeSlug === 'costo-ventas') {
      const [datos, datosAnterioresDb] = await Promise.all([
        findCostoVentas(ejercicioId),
        ejercicio.ejercicioAnteriorId
          ? findCostoVentas(ejercicio.ejercicioAnteriorId)
          : Promise.resolve(null),
      ])
      const comparativosCV = requiereComparativoManual
        ? await findComparativoByEjercicio(ejercicioId, 'COSTO_VENTAS')
        : []
      const datosAnteriores =
        datosAnterioresDb ??
        (requiereComparativoManual
          ? buildCostoVentasAntFromComparativos(ejercicioId, comparativosCV)
          : null)
      anexoContent = (
        <CostoVentasView
          datos={datos}
          datosAnteriores={datosAnteriores}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          editarAnterior={requiereComparativoManual}
          conceptosExtra={comparativosCV.filter((c) => c.esHuerfano)}
        />
      )
    } else if (activeSlug === 'gastos') {
      const gastosRaw = await findGastosDinamicos(
        ejercicioId,
        ejercicio.ejercicioAnteriorId ?? null,
      )
      const gastosData = requiereComparativoManual
        ? applyComparativosToGastos(
            gastosRaw,
            await findComparativoByEjercicio(ejercicioId, 'GASTOS'),
          )
        : gastosRaw
      anexoContent = (
        <GastosView
          data={gastosData}
          ejercicioId={ejercicioId}
          sociedadId={id}
          conComparativo={!!ejercicio.ejercicioAnteriorId || requiereComparativoManual}
          editarAnterior={requiereComparativoManual}
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
        basePath={`/sociedades/${id}/ejercicios/${ejercicioId}/cuentas`}
      >
        {anexoContent}
      </AnexosTabs>
    )
  } else if (paso === 'notas') {
    const notas = await findNotasByEjercicio(ejercicioId)
    content = (
      <div className="max-w-4xl">
        <NotasView
          notas={notas}
          ejercicioId={ejercicioId}
          sociedadId={id}
          fechaCierre={ejercicio.fechaCierre}
          fechaCierreAnterior={fechaCierreAnterior}
          editarAnterior={requiereComparativoManual}
          tieneCuentasClasificadas={cuentas.some((c) => c.rubroBaseId !== null)}
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
    const { pnData } = await fetchEstadosConPN(ejercicioId, ejercicio, cuentas)
    content = (
      <PatrimonioNetoView
        data={pnData}
        ejercicioId={ejercicioId}
        sociedadId={id}
        fechaCierre={ejercicio.fechaCierre}
        fechaCierreAnterior={fechaCierreAnterior}
        pnConfirmado={ejercicio.pnConfirmado ?? false}
      />
    )
  } else if (paso === 'estados') {
    const { estadosData: estadosRaw, pnData } = await fetchEstadosConPN(
      ejercicioId,
      ejercicio,
      cuentas,
    )

    // Aplicar comparativos manuales (edición inline) — siempre a nivel rubro
    let estadosData = estadosRaw
    if (requiereComparativoManual) {
      const comparativos = await findComparativoByEjercicio(ejercicioId)
      estadosData = applyComparativosToEstados(estadosRaw, comparativos, 'RUBRO')
    }

    const data = {
      ...estadosData,
      patrimonioNetoFinal: pnData.totalActual,
      patrimonioNetoFinalAnt: pnData.totalAnterior,
    }
    content = (
      <EstadosView
        data={data}
        ejercicioId={ejercicioId}
        sociedadId={id}
        estadosConfirmado={ejercicio.estadosConfirmado}
        editarAnterior={requiereComparativoManual}
      />
    )
  } else {
    // Default: tabla de cuentas (balance overview)
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
          tieneEjercicioAnterior={tieneEjercicioAnterior}
          pnConfirmado={pnConfirmado}
          estadosConfirmado={ejercicio.estadosConfirmado}
          anexosAceptados={anexosAceptados}
          anexosCompletos={anexosCompletos}
          requiereComparativoManual={requiereComparativoManual}
        />
        {content}
      </div>
    </div>
  )
}
