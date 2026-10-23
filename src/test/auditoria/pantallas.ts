/**
 * Recorrido por las pantallas: con los ejercicios que dejó el contador simulado, levanta la app
 * contra la base de pruebas, abre cada paso de cada ejercicio y el documento imprimible en un
 * navegador real (el Edge o el Chrome de la computadora) y controla que cargue sin errores y que
 * muestre los totales de la referencia, con el formato de la app.
 *
 * Nunca toca un servidor que ya esté corriendo: si en esta carpeta hay un `next dev` vivo (el que
 * usa la gente), no arranca otro y lo avisa. Nunca apunta a una base que no sea de pruebas.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sumarPor } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'
import type { Escenario } from './referencia'
import type { Contexto } from './motor'

const PUERTO = 3199
const URL_BASE = `http://localhost:${PUERTO}`
const GENERAL = 'Pantallas'

const NAVEGADORES = [
  process.env.AUDITORIA_NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((r): r is string => !!r)

/** Pid del `next dev` que ya corre en esta carpeta, si hay uno vivo. */
function servidorCorriendo(): number | null {
  const lock = join(process.cwd(), '.next', 'dev', 'lock')
  if (!existsSync(lock)) return null
  try {
    const { pid } = JSON.parse(readFileSync(lock, 'utf8')) as { pid?: number }
    if (!pid) return null
    process.kill(pid, 0) // no lo toca: solo pregunta si existe
    return pid
  } catch (e) {
    // Sin permiso para preguntar = existe; archivo bloqueado o ilegible = mejor no arriesgar.
    return (e as NodeJS.ErrnoException).code === 'ESRCH' ? null : -1
  }
}

/** Detiene el servidor que arrancó la auditoría y sus procesos hijos (solo ese árbol). */
function detener(servidor: ChildProcess) {
  if (servidor.exitCode !== null || !servidor.pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    servidor.kill()
  }
}

async function esperarServidor(proceso: ChildProcess, salida: string[]): Promise<string | null> {
  const limite = Date.now() + 180_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) return `el servidor terminó: ${salida.join('').slice(-400)}`
    try {
      const r = await fetch(URL_BASE, { redirect: 'manual' })
      if (r.status > 0) return null
    } catch {
      // todavía no escucha
    }
    await new Promise((ok) => setTimeout(ok, 1_000))
  }
  return 'el servidor no respondió en 3 minutos'
}

type Pagina = { nombre: string; ruta: string; importes: [concepto: string, valor: number][] }

function paginas(esc: Escenario, soc: string, ej: string): Pagina[] {
  const x = esc.esperado
  const base = `/sociedades/${soc}/ejercicios/${ej}/cuentas`
  const acepta = (c: string) => esc.documentos.aceptar.includes(c)
  const totalGastos = sumarPor(Object.values(x.gastos), (v) => v)
  const lista: Pagina[] = [
    { nombre: 'Balance de sumas y saldos', ruta: base, importes: [] },
    { nombre: 'Carátula', ruta: `${base}?paso=caratula`, importes: [] },
    { nombre: 'Clasificar cuentas', ruta: `${base}?paso=clasificar`, importes: [] },
    { nombre: 'Anexos y notas', ruta: `${base}?paso=documentos`, importes: [] },
    { nombre: 'Notas', ruta: `${base}?paso=notas`, importes: [] },
    {
      nombre: 'Evolución del patrimonio neto',
      ruta: `${base}?paso=patrimonio-neto`,
      importes: [['Patrimonio neto al cierre', x.patrimonioNeto]],
    },
    {
      nombre: 'Estados contables',
      ruta: `${base}?paso=estados`,
      importes: [
        ['Total del activo', x.activo],
        ['Total del pasivo', x.pasivo],
        ['Patrimonio neto', x.patrimonioNeto],
      ],
    },
    {
      nombre: 'Documento imprimible',
      ruta: `/sociedades/${soc}/ejercicios/${ej}/imprimir`,
      importes: [
        ['Total del activo', x.activo],
        ['Total del pasivo', x.pasivo],
        ['Patrimonio neto', x.patrimonioNeto],
        ['Resultado del ejercicio', x.resultado],
        ['Efectivo al cierre', x.efectivoCierre],
        ...(x.anterior
          ? ([
              ['Total del activo del año anterior', x.anterior.activo],
              ['Patrimonio neto del año anterior', x.anterior.patrimonioNeto],
              ['Resultado del año anterior', x.anterior.resultado],
            ] as [string, number][])
          : []),
      ],
    },
  ]
  if (esc.ejercicio.modo !== 'SIN_ANTERIOR') {
    lista.push({ nombre: 'Ejercicio anterior', ruta: `${base}?paso=anterior`, importes: [] })
  }
  if (acepta('ANEXO_BIENES_USO')) {
    lista.push({
      nombre: 'Anexo I',
      ruta: `${base}?paso=anexos&anexo=bienes-de-uso`,
      importes: [['Neto de bienes de uso', x.bienesDeUsoNeto]],
    })
  }
  if (acepta('ANEXO_COSTO_VENTAS') && x.costoVentasAnexo) {
    lista.push({
      nombre: 'Anexo II',
      ruta: `${base}?paso=anexos&anexo=costo-ventas`,
      importes: [['Costo de ventas', x.costoVentasAnexo.costo]],
    })
  }
  if (acepta('ANEXO_GASTOS')) {
    lista.push({
      nombre: 'Anexo III',
      ruta: `${base}?paso=anexos&anexo=gastos`,
      importes: [['Total de gastos', totalGastos]],
    })
  }
  return lista
}

export async function recorrerPantallas(ctx: Contexto, escenarios: Escenario[]) {
  const { reg } = ctx
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!url.pathname.endsWith('_test')) {
    reg.hallazgo(
      'error',
      GENERAL,
      GENERAL,
      `La base no es de pruebas (${url.pathname}): no se recorren las pantallas.`,
    )
    return
  }
  const vivo = servidorCorriendo()
  if (vivo !== null) {
    reg.hallazgo(
      'advertencia',
      GENERAL,
      GENERAL,
      'Hay un servidor de desarrollo corriendo en esta carpeta: para no interferir con él no se recorrieron las pantallas. Corré la auditoría desde una copia (worktree) o con el servidor cerrado.',
    )
    return
  }
  const navegador = NAVEGADORES.find((r) => existsSync(r))
  if (!navegador) {
    reg.hallazgo(
      'advertencia',
      GENERAL,
      GENERAL,
      'No se encontró Edge ni Chrome: no se recorrieron las pantallas (variable AUDITORIA_NAVEGADOR).',
    )
    return
  }
  let playwright: typeof import('playwright-core')
  try {
    playwright = await import('playwright-core')
  } catch {
    reg.hallazgo('advertencia', GENERAL, GENERAL, 'Falta playwright-core: corré pnpm install.')
    return
  }

  // `next dev` reescribe AGENTS.md cuando lo corre un agente de IA: se deja como estaba.
  const agents = join(process.cwd(), 'AGENTS.md')
  const agentsAntes = existsSync(agents) ? readFileSync(agents, 'utf8') : null
  const salida: string[] = []
  const servidor = spawn(
    process.execPath,
    [join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--port', String(PUERTO)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DB_POOL_MAX: '4',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  servidor.stdout?.on('data', (d) => salida.push(String(d)))
  servidor.stderr?.on('data', (d) => salida.push(String(d)))
  const browser = await playwright.chromium.launch({ executablePath: navegador, headless: true })
  try {
    const fallo = await esperarServidor(servidor, salida)
    if (fallo) {
      reg.hallazgo('error', GENERAL, GENERAL, `No arrancó la app: ${fallo}`)
      return
    }
    const page = await browser.newPage()
    let errores: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errores.push(m.text().slice(0, 300))
    })
    page.on('pageerror', (e) => errores.push(e.message.slice(0, 300)))

    for (const esc of escenarios) {
      const hecho = ctx.hechos.get(esc.id)
      if (!hecho) continue
      for (const p of paginas(esc, hecho.sociedadId, hecho.ejercicioId)) {
        errores = []
        const area = `Pantalla ${p.nombre}`
        const respuesta = await page.goto(`${URL_BASE}${p.ruta}`, {
          waitUntil: 'networkidle',
          timeout: 180_000,
        })
        const estado = respuesta?.status() ?? 0
        reg.paso(esc.id, `Abrir ${p.nombre}`, estado > 0 && estado < 400, `respondió ${estado}`)
        if (estado >= 400) continue
        for (const e of new Set(errores))
          reg.hallazgo('error', esc.id, area, `Error en la consola: ${e}`)
        const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
        for (const [concepto, valor] of p.importes) {
          reg.controles++
          if (!texto.includes(formatCurrency(valor))) {
            reg.hallazgo('error', esc.id, area, `No muestra ${concepto}: ${formatCurrency(valor)}.`)
          }
        }
      }
    }
  } finally {
    await browser.close()
    detener(servidor)
    if (agentsAntes !== null && readFileSync(agents, 'utf8') !== agentsAntes) {
      writeFileSync(agents, agentsAntes)
    }
  }
}
