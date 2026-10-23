/**
 * Registro de la auditoría: los pasos que dio el contador simulado, lo que tipeó y lo que encontró.
 * Nada corta la corrida: cada diferencia queda anotada y al final sale un informe en Markdown.
 */
import { restar, type ValorImporte } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'

export type Gravedad = 'error' | 'advertencia' | 'mejora'

export type Hallazgo = { gravedad: Gravedad; escenario: string; area: string; mensaje: string }

/**
 * Un dato que el contador tuvo que tipear. `dato` nombra lo que ese número ES (por ejemplo, la
 * existencia final del año anterior): el mismo dato tipeado en dos pantallas es una carga doble.
 */
export type Entrada = {
  escenario: string
  pantalla: string
  concepto: string
  valor: number
  dato?: string
}

export type Paso = { escenario: string; nombre: string; ok: boolean; detalle?: string }

const ICONO: Record<Gravedad, string> = { error: '🔴', advertencia: '🟡', mejora: '🔵' }

/** Igualdad exacta, sin tolerancia (`comparaImportes` acepta hasta un centavo de diferencia). */
export const iguales = (a: ValorImporte, b: ValorImporte) => restar(a, b) === 0

/** Importe completo, sin redondear: en un control la diferencia puede estar en el tercer decimal. */
export const pesos = (n: number) => formatCurrency(n, { decimales: 'todos' })

export class Registro {
  readonly hallazgos: Hallazgo[] = []
  readonly entradas: Entrada[] = []
  readonly pasos: Paso[] = []
  controles = 0

  hallazgo(gravedad: Gravedad, escenario: string, area: string, mensaje: string) {
    const repetido = this.hallazgos.some(
      (h) => h.escenario === escenario && h.area === area && h.mensaje === mensaje,
    )
    if (!repetido) this.hallazgos.push({ gravedad, escenario, area, mensaje })
  }

  paso(escenario: string, nombre: string, ok: boolean, detalle?: string) {
    this.pasos.push({ escenario, nombre, ok, detalle })
    if (!ok) this.hallazgo('error', escenario, nombre, detalle ?? 'falló')
  }

  entrada(escenario: string, pantalla: string, concepto: string, valor: number, dato?: string) {
    if (valor !== 0) this.entradas.push({ escenario, pantalla, concepto, valor, dato })
  }

  /** Igualdad exacta (sin tolerancia: nunca se redondea). Devuelve si coincide. */
  igual(
    escenario: string,
    area: string,
    concepto: string,
    obtenido: number | null | undefined,
    esperado: number,
    gravedad: Gravedad = 'error',
  ): boolean {
    this.controles++
    const valor = obtenido ?? 0
    if (iguales(valor, esperado)) return true
    this.hallazgo(
      gravedad,
      escenario,
      area,
      `${concepto}: muestra ${pesos(valor)} y debería ser ${pesos(esperado)} (diferencia ${pesos(restar(valor, esperado))}).`,
    )
    return false
  }

  /** El mismo dato tipeado en más de una pantalla del mismo ejercicio. */
  cargasDobles(): { escenario: string; dato: string; donde: string[] }[] {
    const grupos = new Map<string, Entrada[]>()
    for (const e of this.entradas.filter((x) => x.dato)) {
      const k = `${e.escenario}|${e.dato}`
      grupos.set(k, [...(grupos.get(k) ?? []), e])
    }
    return [...grupos.values()]
      .filter((g) => new Set(g.map((e) => e.pantalla)).size > 1)
      .map((g) => ({
        escenario: g[0]!.escenario,
        dato: g[0]!.dato!,
        donde: g.map((e) => `${e.pantalla} → ${e.concepto} (${pesos(e.valor)})`),
      }))
  }

  informe(
    titulo: string,
    escenarios: { id: string; titulo: string }[],
    duracionMs: number,
  ): string {
    const cuenta = (g: Gravedad) => this.hallazgos.filter((h) => h.gravedad === g).length
    const dobles = this.cargasDobles()
    const l: string[] = []
    l.push(`# ${titulo}`, '')
    l.push(
      `Corrida: ${new Date().toISOString()} · ${duracionMs / 1000} s · ` +
        `${this.pasos.length} pasos · ${this.controles} controles · ${this.entradas.length} datos tipeados`,
      '',
    )
    l.push(
      `| ${ICONO.error} Errores | ${ICONO.advertencia} Advertencias | ${ICONO.mejora} Mejoras | Cargas dobles |`,
      '|---|---|---|---|',
      `| ${cuenta('error')} | ${cuenta('advertencia')} | ${cuenta('mejora')} | ${dobles.length} |`,
      '',
    )
    for (const esc of escenarios) {
      const pasos = this.pasos.filter((p) => p.escenario === esc.id)
      const hallazgos = this.hallazgos.filter((h) => h.escenario === esc.id)
      l.push(`## Escenario ${esc.id}: ${esc.titulo}`, '')
      l.push(`Pasos: ${pasos.filter((p) => p.ok).length} de ${pasos.length} sin error.`, '')
      if (hallazgos.length === 0) l.push('Sin hallazgos.', '')
      for (const g of ['error', 'advertencia', 'mejora'] as const) {
        for (const h of hallazgos.filter((x) => x.gravedad === g)) {
          l.push(`- ${ICONO[g]} **${h.area}** — ${h.mensaje}`)
        }
      }
      const doblesEsc = dobles.filter((d) => d.escenario === esc.id)
      if (doblesEsc.length > 0) {
        l.push('', '**Mismo dato tipeado en más de una pantalla** (se podría autocompletar):')
        for (const d of doblesEsc) l.push(`- ${d.dato}: ${d.donde.join(' · ')}`)
      }
      const tipeados = this.entradas.filter((x) => x.escenario === esc.id)
      if (tipeados.length > 0) {
        l.push(
          '',
          `<details><summary>Datos que tipeó el contador (${tipeados.length})</summary>`,
          '',
        )
        const porPantalla = new Map<string, Entrada[]>()
        for (const t of tipeados)
          porPantalla.set(t.pantalla, [...(porPantalla.get(t.pantalla) ?? []), t])
        for (const [pantalla, ts] of porPantalla) {
          l.push(
            `- **${pantalla}**: ${ts.map((t) => `${t.concepto} ${pesos(t.valor)}`).join(' · ')}`,
          )
        }
        l.push('', '</details>')
      }
      l.push('')
    }
    const generales = this.hallazgos.filter((h) => !escenarios.some((e) => e.id === h.escenario))
    if (generales.length > 0) {
      l.push('## Generales', '')
      for (const h of generales) l.push(`- ${ICONO[h.gravedad]} **${h.area}** — ${h.mensaje}`)
      l.push('')
    }
    return l.join('\n')
  }
}
