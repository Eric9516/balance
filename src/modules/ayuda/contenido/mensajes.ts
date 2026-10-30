/**
 * Un artículo por cada código de error o aviso de la app. La prueba de la ayuda falla si aparece un
 * código nuevo sin su explicación acá.
 */
import type { ArticuloAyuda } from '../domain/tipos'
import { p, pasos } from './bloques'

type Mensaje = {
  codigo: string
  titulo: string
  significa: string
  /** Cómo se corrige, en orden. */
  solucion: string[]
  claves?: string[]
  relacionados?: string[]
}

const MENSAJES: Mensaje[] = [
  // ─── Compuerta de autorización (AUT) ──────────────────────────────────────
  {
    codigo: 'AUT-001',
    titulo: 'Falta definir cómo se resuelve el ejercicio anterior',
    significa:
      'El ejercicio todavía no dice si el anterior es vinculado, cargado a mano o si es el primer ejercicio.',
    solucion: [
      'Abrí "Editar ejercicio".',
      'Respondé cómo se resuelve el ejercicio anterior y guardá.',
    ],
    relacionados: ['paso-anterior'],
  },
  {
    codigo: 'AUT-002',
    titulo: 'Falta la categoría del ente según la RT 54',
    significa:
      'El ejercicio no tiene definida la categoría del ente (pequeña, mediana o restante).',
    solucion: ['Abrí "Editar ejercicio".', 'Elegí la categoría del ente y guardá.'],
    relacionados: ['crear-ejercicio'],
  },
  {
    codigo: 'AUT-010',
    titulo: 'El anterior cargado a mano no está autorizado',
    significa:
      'Con el anterior cargado a mano, hay que autorizarlo antes de confirmar. También aparece si cambiaste algo de la columna anterior después de autorizar: el cambio anula la autorización.',
    solucion: [
      'Abrí el paso "Ejercicio anterior".',
      'Revisá el cuadre.',
      'Hacé clic en "Autorizar".',
    ],
    relacionados: ['anterior-manual'],
  },
  {
    codigo: 'AUT-011',
    titulo: 'El ejercicio anterior no cuadra',
    significa:
      'En la columna "Ejercicio anterior", el activo no es igual al pasivo más el patrimonio neto. El mensaje muestra los dos totales y la diferencia completa.',
    solucion: [
      'Revisá la columna "Ejercicio anterior" del Estado de Situación Patrimonial: los rubros con nota se cargan en la nota, bienes de uso en el Anexo I.',
      'Revisá el total anterior del E.E.P.N.: es el patrimonio neto anterior.',
      'Corregí hasta que la diferencia sea cero.',
    ],
    claves: ['no cuadra el anterior', 'activo distinto de pasivo mas patrimonio neto'],
    relacionados: ['anterior-manual', 'pregunta-no-cuadra'],
  },
  {
    codigo: 'AUT-012',
    titulo: 'El resultado del año anterior no coincide entre el EERR y el E.E.P.N.',
    significa:
      'El resultado del año anterior del Estado de Resultados no es igual al de la columna "Ejercicio anterior" del E.E.P.N.',
    solucion: [
      'Con el anterior cargado a mano el E.E.P.N. toma el resultado del Estado de Resultados anterior, así que revisá el Estado de Resultados anterior: ingresos, costo de ventas (Anexo II), gastos (Anexo III), resultados financieros e impuesto.',
      'Con el anterior vinculado, revisá el E.E.P.N. y el Estado de Resultados del ejercicio anterior.',
    ],
    relacionados: ['paso-patrimonio-neto', 'anterior-manual'],
  },
  {
    codigo: 'AUT-020',
    titulo: 'Modo vinculado sin ejercicio anterior elegido',
    significa:
      'El ejercicio dice que el anterior es vinculado, pero no tiene un ejercicio asociado.',
    solucion: ['Abrí "Editar ejercicio".', 'Elegí el ejercicio anterior y guardá.'],
    relacionados: ['anterior-vinculado'],
  },
  {
    codigo: 'AUT-021',
    titulo: 'El ejercicio anterior está en Borrador',
    significa:
      'El ejercicio vinculado como anterior todavía está en Borrador: sus saldos no son definitivos.',
    solucion: [
      'Abrí el ejercicio anterior.',
      'Inicialo (En proceso), completalo y confirmá sus estados y su E.E.P.N.',
    ],
    relacionados: ['anterior-vinculado', 'estados-ejercicio'],
  },
  {
    codigo: 'AUT-022',
    titulo: 'El ejercicio anterior no tiene confirmados los estados o el E.E.P.N.',
    significa:
      'Los saldos de inicio de este ejercicio salen del anterior, así que el anterior tiene que tener confirmados sus estados y su E.E.P.N.',
    solucion: [
      'Abrí el ejercicio anterior.',
      'Confirmá los estados y el E.E.P.N.',
      'Volvé a este ejercicio e intentá de nuevo.',
    ],
    relacionados: ['anterior-vinculado'],
  },
  {
    codigo: 'AUT-030',
    titulo: '¿Primer ejercicio con la sociedad inscripta hace más de un año?',
    significa:
      'El ejercicio está marcado como primero, pero la sociedad se inscribió más de un año antes de su inicio. "Primer ejercicio" solo corresponde si no hubo ejercicios previos. Es un aviso: no bloquea.',
    solucion: [
      'Si hubo ejercicios previos, cambiá el modo a "Carga manual" y cargá los saldos del año anterior.',
      'Si es correcto, seguí adelante.',
    ],
    relacionados: ['primer-ejercicio', 'sociedades'],
  },
  {
    codigo: 'AUT-031',
    titulo: 'Se presenta sin información comparativa',
    significa:
      'Es el primer ejercicio de la sociedad: los estados se presentan sin columna anterior y lo indican expresamente. Es informativo.',
    solucion: ['No hace falta hacer nada.'],
    relacionados: ['primer-ejercicio'],
  },
  {
    codigo: 'AUT-040',
    titulo: 'Los ajustes de transición no coinciden con la modificación al inicio del E.E.P.N.',
    significa:
      'La suma de los ajustes de medición de la nota de transición a la RT 54 no es igual a la fila "Modificación de saldos al inicio" del E.E.P.N. Normalmente esa fila acompaña sola a los ajustes; aparece si la cambiaste a mano. Es un aviso.',
    solucion: [
      'Si la diferencia es un error, dejá la fila igual a la suma de los ajustes de medición.',
      'Si la diferencia no es de transición (por ejemplo, la corrección de un error), explicala en la nota.',
    ],
    relacionados: ['nota-transicion', 'paso-patrimonio-neto'],
  },
  {
    codigo: 'AUT-050',
    titulo: 'El Estado de Flujo de Efectivo no cuadra',
    significa:
      'Según el balance el efectivo varió un importe, pero las actividades del flujo suman otro. El mensaje muestra los dos y la diferencia completa.',
    solucion: [
      'Abrí Estados → Flujo de efectivo.',
      'Revisá los importes de las líneas hasta que la diferencia sea cero.',
    ],
    relacionados: ['flujo-efectivo'],
  },
  {
    codigo: 'AUT-051',
    titulo: 'La columna anterior del flujo no cuadra',
    significa:
      'En la columna "Ejercicio anterior" del flujo, la variación del efectivo no es igual a la suma de las actividades. Es un aviso.',
    solucion: [
      'Revisá los importes anteriores de cada concepto y el efectivo al inicio del año anterior.',
    ],
    relacionados: ['flujo-efectivo'],
  },
  {
    codigo: 'AUT-052',
    titulo: 'Falta el Estado de Flujo de Efectivo',
    significa: 'No hay ninguna línea en el flujo. Es un estado básico obligatorio.',
    solucion: ['Abrí Estados → Flujo de efectivo y cargá sus líneas.'],
    relacionados: ['flujo-efectivo'],
  },
  // ─── Reglas de negocio (NEG) ──────────────────────────────────────────────
  {
    codigo: 'NEG-001',
    titulo: 'El ejercicio cambió de estado o el paso no es válido',
    significa:
      'El ejercicio ya no está en el estado que muestra la pantalla (alguien lo cambió), o el cambio pedido no está permitido (por ejemplo, saltar de Borrador a Cerrado).',
    solucion: [
      'Recargá la página para ver el estado actual.',
      'Seguí el orden: Borrador → En proceso → Revisión → Cerrado.',
    ],
    relacionados: ['estados-ejercicio'],
  },
  {
    codigo: 'NEG-002',
    titulo: 'Solo se eliminan ejercicios en Borrador',
    significa: 'Un ejercicio iniciado, en revisión o cerrado no se elimina.',
    solucion: [
      'Si es un ejercicio creado por error y está en Borrador, eliminalo. Si ya se inició, no se puede eliminar.',
    ],
    relacionados: ['crear-ejercicio'],
  },
  {
    codigo: 'NEG-003',
    titulo: 'Otro ejercicio lo usa como anterior',
    significa: 'No se puede eliminar porque otro ejercicio está vinculado a este como su anterior.',
    solucion: [
      'Abrí el otro ejercicio → "Editar ejercicio" y desvinculalo.',
      'Después eliminá este.',
    ],
    relacionados: ['cambiar-modo'],
  },
  {
    codigo: 'NEG-004',
    titulo: 'Falta confirmar los estados o el E.E.P.N.',
    significa:
      'Para pasar el ejercicio a Revisión o a Cerrado tienen que estar confirmados los estados contables y el E.E.P.N. del propio ejercicio. Si se cerrara sin confirmar, el ejercicio siguiente no podría usarlo como anterior.',
    solucion: [
      'En Estados, "Confirmar estados".',
      'En Evolución del patrimonio neto, "Confirmar E.E.P.N."',
      'Volvé a la lista de ejercicios y cambiá el estado.',
    ],
    claves: ['no puedo pasar a revision', 'no me deja cerrar'],
    relacionados: ['estados-ejercicio', 'paso-estados', 'paso-patrimonio-neto'],
  },
  {
    codigo: 'NEG-005',
    titulo: 'La Nota 1 de un ejercicio cerrado no se modifica',
    significa: 'El ejercicio está cerrado: su Nota 1 quedó como se emitió.',
    solucion: [
      'Si hay que corregirla, tiene que ser antes de cerrar: desde Revisión se puede volver a En proceso.',
    ],
    relacionados: ['nota-uno', 'estados-ejercicio'],
  },
  {
    codigo: 'NEG-006',
    titulo: 'La Nota 1 es demasiado larga',
    significa: 'El texto de la Nota 1 supera los 50.000 caracteres.',
    solucion: ['Acortá el texto y volvé a guardar.'],
    relacionados: ['nota-uno'],
  },
  {
    codigo: 'NEG-007',
    titulo: 'Falta describir los hechos posteriores al cierre',
    significa:
      'En "Configurar Nota I" se eligió que hay hechos posteriores, pero la descripción quedó vacía. La nota no puede salir sin texto.',
    solucion: [
      'Volvé a "Configurar Nota I" y escribí qué pasó después del cierre y, si se puede estimar, su efecto.',
      'Si no hay nada que informar, elegí "No, sin nota" o "No, con una nota que lo aclara".',
    ],
    claves: ['hechos posteriores vacio', 'descripcion de hechos posteriores'],
    relacionados: ['configurar-notas'],
  },
  {
    codigo: 'NEG-010',
    titulo: 'No hay datos para continuar',
    significa:
      'Aparece en tres casos: la sociedad no se encontró en este estudio (al crear un ejercicio), no hay filas para importar, o ninguna cuenta tiene código y nombre.',
    solucion: [
      'Recargá la página si buscabas una sociedad.',
      'En la importación, agregá al menos una cuenta con código y nombre.',
    ],
    relacionados: ['paso-balance'],
  },
  {
    codigo: 'NEG-011',
    titulo: 'El balance importado no cuadra, o la autorización no aplica',
    significa:
      'En la importación: el total del debe no es igual al del haber; el mensaje dice qué sobra y la diferencia completa. Al autorizar: la autorización solo existe cuando el anterior se carga a mano.',
    solucion: [
      'Revisá los saldos del balance de sumas y saldos antes de confirmar.',
      'Si estabas autorizando, revisá el modo del ejercicio anterior.',
    ],
    claves: ['debe distinto de haber', 'balance no cierra'],
    relacionados: ['importar-excel', 'anterior-manual'],
  },
  {
    codigo: 'NEG-012',
    titulo: 'Códigos repetidos, o la columna anterior no se carga a mano',
    significa:
      'En la importación: hay cuentas con el mismo código (cada una necesita uno único). En notas y estados: la columna "Ejercicio anterior" solo se carga a mano en modo "Carga manual"; si el ejercicio está vinculado, sale del anterior.',
    solucion: [
      'Corregí los códigos repetidos.',
      'Si querés cargar el anterior a mano, cambiá el modo en "Editar ejercicio".',
    ],
    relacionados: ['paso-balance', 'cambiar-modo'],
  },
  {
    codigo: 'NEG-020',
    titulo: 'No hay cuentas clasificadas',
    significa: 'Las notas se generan desde las cuentas clasificadas, y no hay ninguna.',
    solucion: ['Importá el balance.', 'Clasificá las cuentas.', 'Volvé a generar las notas.'],
    relacionados: ['paso-clasificar', 'paso-notas'],
  },
  {
    codigo: 'NEG-030',
    titulo: 'El ejercicio no cumple las condiciones para confirmar',
    significa:
      'La compuerta de autorización encontró algo pendiente al confirmar los estados, el E.E.P.N. o al cambiar de estado. El mensaje es la primera condición pendiente y dice si hay más.',
    solucion: [
      'Leé el mensaje: dice qué falta y dónde.',
      'Revisá el paso "Ejercicio anterior" y Estados: ahí se ven todas las condiciones.',
      'Corregí y volvé a intentar.',
    ],
    relacionados: ['compuerta'],
  },
  {
    codigo: 'NEG-040',
    titulo: 'La nota de transición no corresponde',
    significa:
      'La nota de primera aplicación de la RT 54 solo corresponde si el ejercicio está marcado como primera adopción.',
    solucion: ['En Notas, "Configurar Nota I": si es primera adopción, marcalo.'],
    relacionados: ['nota-transicion'],
  },
  {
    codigo: 'NEG-050',
    titulo: 'Concepto repetido en el flujo',
    significa:
      'Ya hay una línea con ese concepto en la misma actividad del flujo (no importan mayúsculas ni tildes).',
    solucion: ['Usá un concepto distinto o cargá el importe en la línea que ya existe.'],
    relacionados: ['flujo-efectivo'],
  },
  {
    codigo: 'NEG-051',
    titulo: 'No se pueden traer los conceptos del anterior',
    significa:
      'Traer los conceptos del flujo del año anterior solo funciona con el ejercicio vinculado.',
    solucion: ['Con carga manual, agregá los conceptos a mano.'],
    relacionados: ['flujo-efectivo'],
  },
  {
    codigo: 'NEG-060',
    titulo: 'Importe demasiado grande',
    significa:
      'Un resultado supera los 70 billones de pesos: no se puede calcular con exactitud, y la app no redondea en silencio.',
    solucion: ['Revisá el importe que lo causa: suele ser un error de tipeo (ceros de más).'],
    relacionados: ['importes-redondeo'],
  },
  {
    codigo: 'NEG-061',
    titulo: 'Importe inválido o división por cero',
    significa:
      'Se intentó calcular con algo que no es un número, o dividir por cero (por ejemplo, un índice de inflación en cero).',
    solucion: ['Revisá los importes y los índices de inflación del ejercicio.'],
    relacionados: ['formato-importes', 'coeficiente'],
  },
  // ─── Técnicos y permisos ──────────────────────────────────────────────────
  {
    codigo: 'TECH-001',
    titulo: 'Error de base de datos',
    significa: 'No se pudo leer o guardar en la base de datos.',
    solucion: [
      'Volvé a intentar en unos segundos.',
      'Si sigue, avisá al responsable técnico con la hora y lo que estabas haciendo.',
    ],
  },
  {
    codigo: 'TECH-002',
    titulo: 'No se encontró el registro',
    significa:
      'Lo que querías ver o cambiar ya no existe (por ejemplo, alguien lo borró) o no es de este estudio.',
    solucion: ['Recargá la página y volvé a intentar.'],
  },
  {
    codigo: 'TECH-003',
    titulo: 'Ya existe un registro igual',
    significa:
      'Hay otro registro con un dato que tiene que ser único (por ejemplo, el mismo CUIT).',
    solucion: ['Buscá el registro existente o cambiá el dato.'],
  },
  {
    codigo: 'TECH-004',
    titulo: 'No se puede eliminar: tiene datos relacionados',
    significa: 'El registro tiene otros datos que dependen de él.',
    solucion: ['Eliminá o desvinculá primero lo que depende de él.'],
  },
  {
    codigo: 'TECH-005',
    titulo: 'Error interno',
    significa: 'Ocurrió un error inesperado.',
    solucion: [
      'Volvé a intentar.',
      'Si sigue, avisá al responsable técnico con la hora y lo que estabas haciendo.',
    ],
  },
  {
    codigo: 'AUTH-001',
    titulo: 'Sin permisos',
    significa: 'Lo que intentaste no es de tu estudio o no tenés permiso para hacerlo.',
    solucion: ['Verificá que estés en el estudio correcto.', 'Recargá la página.'],
  },
  {
    codigo: 'AUTH-002',
    titulo: 'Correo o contraseña incorrectos',
    significa:
      'No hay una cuenta con ese correo o la contraseña no coincide. Por seguridad, la app no dice cuál de las dos cosas falló.',
    solucion: [
      'Revisá que el correo esté bien escrito y que no esté activado el bloqueo de mayúsculas.',
      'Si te olvidaste la contraseña, pedile al dueño de tu estudio una provisoria.',
    ],
    claves: ['entrar', 'login', 'contraseña', 'clave'],
  },
  {
    codigo: 'AUTH-003',
    titulo: 'Demasiados intentos',
    significa:
      'Hubo 5 intentos fallidos seguidos con ese correo (o 30 desde la misma conexión) en los últimos 15 minutos. La entrada se frena para que nadie pueda probar contraseñas.',
    solucion: [
      'Esperá 15 minutos y volvé a intentar.',
      'Si te olvidaste la contraseña, pedile al dueño de tu estudio una provisoria.',
    ],
    claves: ['entrar', 'login', 'bloqueado', 'intentos'],
  },
  {
    codigo: 'AUTH-004',
    titulo: 'Cuenta desactivada',
    significa: 'La contraseña es correcta, pero tu cuenta o tu estudio están desactivados.',
    solucion: ['Pedile al dueño de tu estudio que active tu cuenta.'],
    claves: ['entrar', 'login', 'desactivada', 'bloqueada'],
  },
  {
    codigo: 'AUTH-005',
    titulo: 'Código del celular incorrecto',
    significa:
      'Las 6 cifras no coinciden con las que muestra la app de tu celular en este momento, o ese código ya se usó para entrar.',
    solucion: [
      'Escribí el código que se ve ahora en la app (cambia cada 30 segundos).',
      'Si los códigos nunca coinciden, revisá que la hora del celular esté en automático.',
    ],
    claves: ['codigo', 'celular', 'autenticador', 'segundo paso'],
    relacionados: ['codigo-celular'],
  },
  {
    codigo: 'AUTH-006',
    titulo: 'Demasiados códigos equivocados',
    significa:
      'Hubo 5 códigos equivocados seguidos. Por seguridad la sesión se cerró: hay que volver a entrar con la contraseña.',
    solucion: [
      'Volvé a entrar con tu correo y tu contraseña, y escribí el código que muestra la app en ese momento.',
      'Si perdiste el celular, pedile al administrador de BalanceRT que te borre el código para configurarlo de nuevo.',
    ],
    claves: ['codigo', 'celular', 'bloqueado'],
    relacionados: ['codigo-celular'],
  },
]

export const MENSAJES_AYUDA: ArticuloAyuda[] = MENSAJES.map((m) => ({
  id: m.codigo.toLowerCase(),
  titulo: `${m.codigo}: ${m.titulo}`,
  categoria: 'mensajes',
  resumen: m.significa,
  claves: [m.codigo, m.codigo.replace('-', ' '), 'error', 'mensaje', 'aviso', ...(m.claves ?? [])],
  codigos: [m.codigo],
  bloques: [p(m.significa), pasos(...m.solucion)],
  relacionados: m.relacionados,
}))
