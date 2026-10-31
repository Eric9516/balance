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
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { comoPlataforma } from '@/lib/contexto-base'
import { darDeAltaUsuario } from '@/modules/acceso/services/entrada.service'
import { codigoDelPaso, desdeBase32, pasoDe } from '@/modules/acceso/domain/codigo'
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

type Pagina = {
  nombre: string
  ruta: string
  importes: [concepto: string, valor: number][]
  /** Textos que tienen que verse (por ejemplo, la Nota 1 armada). */
  textos?: string[]
}

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
    {
      nombre: 'Notas',
      ruta: `${base}?paso=notas`,
      importes: [],
      textos: ['Nota N° 1:', '1.1. Bases de preparación'],
    },
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
      textos: ['1.1. Bases de preparación', 'Empresa en marcha'],
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

export async function recorrerPantallas(ctx: Contexto, escenarios: Escenario[], estudioId: string) {
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

    if (!(await entrarComoDueno(ctx, page, estudioId))) return

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
        if (esc.id === 'B' && p.nombre === 'Notas') {
          await page.screenshot({
            path: join(process.cwd(), 'auditoria', 'informes', 'nota-uno.png'),
          })
          errores = []
          await probarAyudaConfigNotas(ctx, page, esc.id)
          for (const e of new Set(errores))
            reg.hallazgo('error', esc.id, area, `Error en la consola en "Configurar Nota I": ${e}`)
        }
        if (p.nombre === 'Notas') {
          // La configuración define el texto de la Nota 1: va arriba de todo.
          reg.controles++
          const config = texto.indexOf('La configuración de la Nota I')
          if (config < 0 || config > texto.indexOf('Nota N° 1:')) {
            reg.hallazgo(
              'error',
              esc.id,
              area,
              'La configuración de la Nota I no está arriba de todo (antes de la Nota 1).',
            )
          }
        }
        for (const t of p.textos ?? []) {
          reg.controles++
          if (!texto.includes(t)) reg.hallazgo('error', esc.id, area, `No muestra "${t}".`)
        }
        for (const [concepto, valor] of p.importes) {
          reg.controles++
          if (!texto.includes(formatCurrency(valor))) {
            reg.hallazgo('error', esc.id, area, `No muestra ${concepto}: ${formatCurrency(valor)}.`)
          }
        }
      }
    }
    await recorrerGestion(ctx, page)
    await recorrerAyuda(
      ctx,
      page,
      () => errores,
      (v) => (errores = v),
    )
  } finally {
    await browser.close()
    detener(servidor)
    if (agentsAntes !== null && readFileSync(agents, 'utf8') !== agentsAntes) {
      writeFileSync(agents, agentsAntes)
    }
  }
}

/**
 * "Configurar Nota I": el símbolo (?) de una opción abre su explicación, Escape la cierra sin cerrar
 * el asistente, y con hechos posteriores no se puede confirmar sin describirlos. No guarda nada.
 */
async function probarAyudaConfigNotas(
  ctx: Contexto,
  page: import('playwright-core').Page,
  escenario: string,
) {
  const { reg } = ctx
  const area = 'Pantalla Notas'
  const control = (ok: boolean, falla: string) => {
    reg.controles++
    if (!ok) reg.hallazgo('error', escenario, area, falla)
  }
  const visible = (l: import('playwright-core').Locator, estado: 'visible' | 'hidden') =>
    l
      .waitFor({ state: estado, timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

  await page.getByRole('button', { name: /Volver a configurar|Completar configuración/ }).click()
  const asistente = page.getByRole('heading', { name: 'Adopción de la RT 54', exact: true })
  control(await visible(asistente, 'visible'), 'No abre "Configurar Nota I".')
  await page.getByRole('button', { name: 'Qué hace: Primera adopción', exact: true }).click()
  const globo = page.getByRole('dialog', { name: 'Primera adopción', exact: true })
  const abre = await visible(globo, 'visible')
  control(abre, 'El símbolo (?) de "Primera adopción" no abre su explicación.')
  if (abre) {
    control(
      (await globo.innerText()).includes('Modificación de saldos al inicio'),
      'La explicación de "Primera adopción" no dice qué cambia en el E.E.P.N.',
    )
    await page.screenshot({
      path: join(process.cwd(), 'auditoria', 'informes', 'ayuda-opcion.png'),
    })
  }
  await page.keyboard.press('Escape')
  control(
    (await visible(globo, 'hidden')) && (await asistente.isVisible()),
    'Escape no cierra solo la explicación: tiene que dejar abierto "Configurar Nota I".',
  )

  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByText('No, con una nota que lo aclara', { exact: true }).click()
  control(
    (await page.getByLabel(/Texto de la nota/).inputValue()).startsWith(
      'No existen acontecimientos',
    ),
    '"No, con una nota que lo aclara" no propone el texto estándar.',
  )
  await page.waitForTimeout(400) // que terminen las transiciones de color de las opciones
  await page.screenshot({
    path: join(process.cwd(), 'auditoria', 'informes', 'hechos-posteriores.png'),
  })
  await page.getByText('Sí', { exact: true }).click()
  await page.getByLabel(/Descripción de hechos posteriores/).fill('')
  control(
    await page.getByRole('button', { name: 'Confirmar', exact: true }).isDisabled(),
    'Con hechos posteriores sin describir se puede confirmar (tiene que pedir la descripción).',
  )
  await page.keyboard.press('Escape')
  control(await visible(asistente, 'hidden'), 'Escape no cierra "Configurar Nota I".')
}

/**
 * La ayuda: carga sin errores, el buscador encuentra un código de error y una pregunta, y un enlace
 * como el del botón (i) de un paso abre su artículo. Deja una captura del buscador en el informe.
 */
async function recorrerAyuda(
  ctx: Contexto,
  page: import('playwright-core').Page,
  errores: () => string[],
  limpiar: (v: string[]) => void,
) {
  const { reg } = ctx
  const area = 'Pantalla Ayuda'
  limpiar([])
  const respuesta = await page.goto(`${URL_BASE}/ayuda`, {
    waitUntil: 'networkidle',
    timeout: 180_000,
  })
  const estado = respuesta?.status() ?? 0
  reg.paso(GENERAL, 'Abrir la ayuda', estado > 0 && estado < 400, `respondió ${estado}`)
  if (estado >= 400) return
  const buscar = async (consulta: string, esperado: RegExp, concepto: string) => {
    await page.fill('#buscador-ayuda', consulta)
    const primero = page.locator('section[aria-live] ul li a span').first()
    reg.controles++
    // La lista anterior sigue en pantalla un instante: se espera a que muestre la búsqueda nueva.
    let titulo = ''
    for (const limite = Date.now() + 5_000; Date.now() < limite;) {
      titulo = (await primero.innerText({ timeout: 1_000 }).catch(() => '')).trim()
      if (esperado.test(titulo)) return
      await page.waitForTimeout(100)
    }
    reg.hallazgo(
      'error',
      GENERAL,
      area,
      titulo
        ? `Buscar ${concepto} ("${consulta}") da primero "${titulo}".`
        : `Buscar ${concepto} ("${consulta}") no muestra resultados.`,
    )
  }
  await buscar('aut 12', /AUT-012/, 'un código de error')
  await buscar('¿cómo cargo el ejercicio anterior a mano?', /cargado a mano/, 'una pregunta')
  await page.screenshot({
    path: join(process.cwd(), 'auditoria', 'informes', 'ayuda-buscador.png'),
  })

  await page.goto(`${URL_BASE}/ayuda#paso-patrimonio-neto`, { waitUntil: 'networkidle' })
  await page
    .locator('#titulo-paso-patrimonio-neto')
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined)
  const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  reg.controles++
  // innerText aplica el estilo (mayúsculas): se compara sin distinguirlas.
  const visible = texto.toLowerCase()
  if (!visible.includes('de dónde salen los datos') || !visible.includes('confirmar e.e.p.n.')) {
    reg.hallazgo(
      'error',
      GENERAL,
      area,
      'El enlace a un paso (#paso-patrimonio-neto) no abre su artículo con el resumen del paso.',
    )
  }
  await page.screenshot({
    path: join(process.cwd(), 'auditoria', 'informes', 'ayuda-articulo.png'),
    fullPage: true,
  })
  for (const e of new Set(errores()))
    reg.hallazgo('error', GENERAL, area, `Error en la consola: ${e}`)
}

/**
 * Pantallas de gestión: abren sin error y su botón (i) muestra el resumen de la pantalla con el
 * enlace a la ayuda completa.
 */
/**
 * Entra como lo haría una persona nueva: sin sesión la app manda a "Entrar"; con la contraseña
 * provisoria pide elegir una nueva; con la nueva, entra. Las contraseñas son al azar, de esta corrida.
 */
async function entrarComoDueno(
  ctx: Contexto,
  page: import('playwright-core').Page,
  estudioId: string,
): Promise<boolean> {
  const { reg } = ctx
  const email = 'duena.auditoria@balancert.test'
  const provisoria = randomBytes(12).toString('base64url')
  const nueva = randomBytes(12).toString('base64url')
  const espera = { timeout: 180_000 }

  await page.goto(`${URL_BASE}/sociedades`, { waitUntil: 'networkidle', ...espera })
  const sinSesion = new URL(page.url())
  reg.paso(
    GENERAL,
    'Sin sesión, la app manda a Entrar',
    sinSesion.pathname === '/entrar' && sinSesion.searchParams.get('volver') === '/sociedades',
    `quedó en ${sinSesion.pathname}${sinSesion.search}`,
  )

  await comoPlataforma(() => db.usuario.deleteMany({ where: { email } }))
  // La auditoría prueba el recorrido completo, con el código del celular obligatorio para dueños
  await comoPlataforma(
    () => db.$executeRaw`UPDATE acceso.ajustes SET codigo_obligatorio_duenos = true`,
  )
  const alta = await darDeAltaUsuario({
    estudioId,
    email,
    nombre: 'Dueña de la auditoría',
    rol: 'DUENO',
    contrasenaProvisoria: provisoria,
  })
  if (!alta.ok) {
    reg.hallazgo('error', GENERAL, 'Entrar', `No se pudo crear el usuario: ${alta.error.mensaje}`)
    return false
  }

  const entrar = async (contrasena: string) => {
    await page.fill('#email', email)
    await page.fill('#contrasena', contrasena)
    await page.click('button[type=submit]')
  }
  try {
    await page.fill('#email', email)
    await page.fill('#contrasena', 'una contraseña equivocada')
    await page.click('button[type=submit]')
    await page.waitForSelector('#error-entrar', espera)
    reg.paso(GENERAL, 'Una contraseña equivocada no entra', true)

    await entrar(provisoria)
    await page.waitForURL((u) => u.pathname === '/entrar/nueva-contrasena', espera)
    reg.paso(GENERAL, 'Con la contraseña provisoria, pide elegir una nueva', true)

    // Con la contraseña elegida sigue en la misma entrada: el dueño configura el código del
    // celular, leyendo la clave como la cargaría en la app
    await page.fill('#nueva', nueva)
    await page.fill('#repetida', nueva)
    await page.click('button[type=submit]')
    await page.waitForURL((u) => u.pathname === '/entrar/configurar-codigo', espera)
    reg.paso(GENERAL, 'El dueño tiene que configurar el código del celular', true)
    const clave = (await page.locator('#clave-manual').innerText()).trim()
    await page.fill('#codigo', '000000')
    await page.click('button[type=submit]')
    await page.waitForSelector('#error-codigo', espera)
    reg.paso(GENERAL, 'Un código equivocado no entra', true)
    await page.fill('#codigo', codigoDelPaso(desdeBase32(clave), pasoDe(Date.now())))
    await page.click('button[type=submit]')
    await page.waitForURL((u) => u.pathname === '/sociedades', espera)
    reg.paso(GENERAL, 'Con el código, entra', true)
    return true
  } catch (e) {
    reg.paso(
      GENERAL,
      'Entrar',
      false,
      `quedó en ${page.url()}: ${(e as Error).message.slice(0, 200)}`,
    )
    return false
  }
}

async function recorrerGestion(ctx: Contexto, page: import('playwright-core').Page) {
  const { reg } = ctx
  for (const [nombre, ruta] of [
    ['Sociedades', '/sociedades'],
    ['Auditores', '/auditores'],
    ['Estudio', '/configuracion'],
    ['Clasificaciones RT 54', '/configuracion/rubros'],
    ['Usuarios', '/configuracion/usuarios'],
    ['Mi cuenta', '/mi-cuenta'],
  ] as const) {
    const area = `Pantalla ${nombre}`
    const respuesta = await page.goto(`${URL_BASE}${ruta}`, {
      waitUntil: 'networkidle',
      timeout: 180_000,
    })
    const estado = respuesta?.status() ?? 0
    reg.paso(GENERAL, `Abrir ${nombre}`, estado > 0 && estado < 400, `respondió ${estado}`)
    if (estado >= 400) continue
    reg.controles++
    const boton = page.locator('button[title^="Información:"]').first()
    if ((await boton.count()) === 0) {
      reg.hallazgo('error', GENERAL, area, 'No tiene el botón (i) de información.')
      continue
    }
    await boton.click()
    const enlace = page.locator('a', { hasText: 'Ver la ayuda completa' })
    try {
      await enlace.waitFor({ timeout: 5_000 })
    } catch {
      reg.hallazgo(
        'error',
        GENERAL,
        area,
        'El botón (i) no abre el resumen con el enlace a la ayuda.',
      )
    }
    await page.keyboard.press('Escape')
  }
}
