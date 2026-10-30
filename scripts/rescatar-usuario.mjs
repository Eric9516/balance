// Rescata una cuenta desde la plataforma (pnpm usuarios:rescatar): a quien perdió el celular le borra
// el código (la próxima vez que entre lo configura de nuevo) y a quien se olvidó la contraseña le da
// una provisoria (la cambia al entrar). En los dos casos cierra todas sus sesiones.
//
// Lo usa quien administra BalanceRT, sobre todo para los dueños: a su gente, el dueño la rescata desde
// la app. Usa DATABASE_URL del archivo .env de esta carpeta (docs/decisiones/0013).
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import pg from 'pg'
import { huellaDeContrasena } from '../src/modules/acceso/infra/contrasenas.ts'
import { errorDeContrasena, normalizarEmail } from '../src/modules/acceso/domain/reglas.ts'

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
  const email = normalizarEmail(await preguntar('Correo de la cuenta: '))
  const {
    rows: [usuario],
  } = await base.query(
    `SELECT u.id, u.nombre, u.rol, e.nombre AS estudio, k.activado IS NOT NULL AS con_codigo
     FROM usuarios u JOIN estudios e ON e.id = u.estudio_id
     LEFT JOIN acceso.codigos k ON k.usuario_id = u.id
     WHERE u.email = $1`,
    [email],
  )
  if (!usuario) throw new Error('No hay una cuenta con ese correo.')
  console.log(
    `\n${usuario.nombre} (${usuario.rol.toLowerCase()} de ${usuario.estudio})` +
      ` · código del celular: ${usuario.con_codigo ? 'configurado' : 'sin configurar'}`,
  )
  const opcion = (
    await preguntar('\n1 borrar el código del celular, 2 dar una contraseña provisoria: ')
  ).trim()

  if (opcion === '1') {
    await base.query('BEGIN')
    await base.query('DELETE FROM acceso.codigos WHERE usuario_id = $1', [usuario.id])
    await base.query('DELETE FROM acceso.sesiones WHERE usuario_id = $1', [usuario.id])
    await base.query('COMMIT')
    console.log('\nListo: la próxima vez que entre, configura el código de nuevo.')
  } else if (opcion === '2') {
    const contrasena = await preguntarOculto('Contraseña provisoria (no se ve al escribir): ')
    const problema = errorDeContrasena(contrasena)
    if (problema) throw new Error(problema)
    if ((await preguntarOculto('Repetila: ')) !== contrasena)
      throw new Error('Las dos contraseñas no coinciden.')
    const huella = await huellaDeContrasena(contrasena)
    await base.query('BEGIN')
    await base.query(
      `INSERT INTO acceso.contrasenas (usuario_id, huella, provisoria, cambiada)
       VALUES ($1, $2, true, now())
       ON CONFLICT (usuario_id) DO UPDATE
         SET huella = excluded.huella, provisoria = true, cambiada = excluded.cambiada`,
      [usuario.id, huella],
    )
    await base.query('DELETE FROM acceso.sesiones WHERE usuario_id = $1', [usuario.id])
    await base.query('COMMIT')
    console.log('\nListo: entra con la provisoria y elige la suya.')
  } else {
    throw new Error('Opción inválida.')
  }
} catch (error) {
  await base.query('ROLLBACK').catch(() => {})
  console.error(`\nNo se hizo nada: ${error.message}`)
  process.exitCode = 1
} finally {
  rl?.close()
  await base.end()
}
