// Da de alta a una persona en un estudio, desde la plataforma (pnpm usuarios:crear).
//
// Lo usa quien administra BalanceRT: el primer dueño de un estudio, o alguien más cuando todavía no
// está la pantalla de usuarios. La contraseña se escribe acá, sin que se vea, y en la base queda solo
// su huella (Argon2id). Corre con el rol de la app y declarando el estudio: la base controla que la
// persona quede en ese estudio y que el correo no exista en otro (docs/decisiones/0013).
//
// Usa DATABASE_URL del archivo .env de esta carpeta.
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import pg from 'pg'
import { huellaDeContrasena } from '../src/modules/acceso/infra/contrasenas.ts'
import { errorDeContrasena, normalizarEmail } from '../src/modules/acceso/domain/reglas.ts'

const ROLES = { 1: 'DUENO', 2: 'CONTADOR', 3: 'ASISTENTE' }
const NOMBRE_ROL = { DUENO: 'dueño', CONTADOR: 'contador', ASISTENTE: 'asistente' }

// Con las respuestas en un archivo o una tubería (sin teclado), se leen todas de entrada.
const lineas = stdin.isTTY
  ? null
  : await new Promise((listo) => {
      let texto = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (parte) => (texto += parte))
      stdin.on('end', () => listo(texto.split(/\r?\n/)))
    })
const rl = lineas ? null : createInterface({ input: stdin, output: stdout })
let ocultar = false
if (rl) {
  // Mientras se escribe una contraseña, no se muestra lo que se teclea
  const escribirOriginal = rl._writeToOutput?.bind(rl)
  rl._writeToOutput = (texto) => {
    if (!ocultar || texto.includes('\n') || texto.includes(':')) escribirOriginal?.(texto)
  }
}
async function preguntar(texto) {
  if (lineas) {
    stdout.write(`${texto}\n`)
    return lineas.shift() ?? ''
  }
  return rl.question(texto)
}
async function preguntarOculto(texto) {
  if (lineas) {
    stdout.write(`${texto}\n`)
    return lineas.shift() ?? ''
  }
  stdout.write(texto)
  ocultar = true
  try {
    return await rl.question('')
  } finally {
    ocultar = false
    stdout.write('\n')
  }
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el archivo .env.')
  process.exit(1)
}
const base = new pg.Client({ connectionString: process.env.DATABASE_URL })
await base.connect()

try {
  const { rows: estudios } = await base.query(`
    SELECT e.id, e.nombre, e.cuit, e.activo, count(u.id)::int AS usuarios
    FROM estudios e LEFT JOIN usuarios u ON u.estudio_id = e.id
    GROUP BY e.id ORDER BY e.created_at`)
  if (estudios.length === 0) throw new Error('No hay estudios en la base.')
  console.log('\nEstudios:')
  estudios.forEach((e, i) =>
    console.log(
      `  ${i + 1}. ${e.nombre} (CUIT ${e.cuit})${e.activo ? '' : ' [inactivo]'} · ${e.usuarios} usuario(s)`,
    ),
  )
  const elegido = estudios[Number(await preguntar('\n¿En qué estudio? (número): ')) - 1]
  if (!elegido) throw new Error('Ese número no está en la lista.')

  const email = normalizarEmail(await preguntar('Correo: '))
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no parece válido.')
  const nombre = (await preguntar('Nombre y apellido: ')).trim()
  if (!nombre) throw new Error('Falta el nombre.')
  const rol = ROLES[(await preguntar('Rol: 1 dueño, 2 contador, 3 asistente [1]: ')).trim() || '1']
  if (!rol) throw new Error('Rol inválido.')

  const contrasena = await preguntarOculto('Contraseña (no se ve al escribir): ')
  const problema = errorDeContrasena(contrasena)
  if (problema) throw new Error(problema)
  if ((await preguntarOculto('Repetila: ')) !== contrasena)
    throw new Error('Las dos contraseñas no coinciden.')
  const provisoria =
    rol !== 'DUENO' &&
    !/^n/i.test(await preguntar('¿Es provisoria? La persona la cambia al entrar [S/n]: '))

  const huella = await huellaDeContrasena(contrasena)
  await base.query('BEGIN')
  await base.query(
    "SELECT set_config('role', 'balancert_app', true), set_config('app.estudio', $1, true)",
    [elegido.id],
  )
  const {
    rows: [usuario],
  } = await base.query(
    `INSERT INTO usuarios (estudio_id, email, nombre, rol, updated_at)
     VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [elegido.id, email, nombre, rol],
  )
  await base.query('SELECT acceso.fijar_contrasena($1, $2, $3)', [usuario.id, huella, provisoria])
  await base.query('COMMIT')
  console.log(
    `\nListo: ${nombre} (${NOMBRE_ROL[rol]} de ${elegido.nombre}) ya puede entrar con ${email}.`,
  )
} catch (error) {
  await base.query('ROLLBACK').catch(() => {})
  const mensaje = error?.code === '23505' ? 'Ya existe una cuenta con ese correo.' : error.message
  console.error(`\nNo se creó: ${mensaje}`)
  process.exitCode = 1
} finally {
  rl?.close()
  await base.end()
}
