import type { ArticuloAyuda } from '../domain/tipos'
import { defs, lista, p, pasos } from './bloques'

export const PREGUNTAS: ArticuloAyuda[] = [
  {
    id: 'pregunta-no-guarda',
    titulo: 'No me deja guardar',
    categoria: 'preguntas',
    resumen: 'Qué revisar cuando un cambio no se guarda o aparece un mensaje al guardar.',
    claves: ['no guarda', 'no se guarda', 'error al guardar', 'no me deja editar', 'boton guardar'],
    bloques: [
      pasos(
        'Fijate si estás en modo edición: hay que hacer clic en "Editar" antes de cambiar importes.',
        'Leé el mensaje que aparece: tiene un código (por ejemplo NEG-012). Buscalo acá en la ayuda.',
        'Si la celda tiene candado, ese importe viene de otro lado: cambialo en su origen.',
        'Si el ejercicio está Cerrado, no se modifica.',
        'Recargá la página por si otra persona cambió algo mientras tanto.',
      ),
    ],
    relacionados: ['editar-tablas', 'pregunta-candado', 'estados-ejercicio'],
  },
  {
    id: 'pregunta-candado',
    titulo: '¿Por qué un importe tiene candado?',
    categoria: 'preguntas',
    resumen:
      'Un importe con candado viene de otro lugar y se cambia ahí, para que el mismo dato no se cargue dos veces.',
    claves: ['candado', 'bloqueado', 'no se puede editar', 'no puedo modificar', 'gris'],
    bloques: [
      p(
        'El candado indica que el importe no se escribe en esa celda: sale de otro lado y está siempre igual. Pasá el mouse sobre el candado para ver de dónde viene.',
      ),
      lista(
        'Del ejercicio anterior vinculado: saldos de inicio, columna anterior, existencia inicial, valor al comienzo de bienes de uso.',
        'De una nota: el anterior de un rubro con nota en el Estado de Situación Patrimonial.',
        'Del Anexo II: la existencia inicial de este año es la existencia final del año anterior.',
        'Del Estado de Resultados: el resultado del ejercicio en el E.E.P.N.',
      ),
    ],
    relacionados: ['anterior-vinculado', 'anterior-manual'],
  },
  {
    id: 'pregunta-no-cuadra',
    titulo: 'El balance no cuadra (activo distinto de pasivo más patrimonio neto)',
    categoria: 'preguntas',
    resumen: 'Dónde buscar la diferencia cuando el Estado de Situación Patrimonial no cuadra.',
    claves: [
      'no cuadra',
      'descuadre',
      'activo pasivo',
      'balance no cierra',
      'diferencia',
      'no balancea',
    ],
    bloques: [
      pasos(
        'Revisá que no queden cuentas sin clasificar.',
        'Revisá que cada cuenta esté en el rubro correcto (en particular las de resultado y las de patrimonio neto).',
        'Revisá el E.E.P.N.: su total al cierre es el patrimonio neto del balance; incluye el resultado del ejercicio.',
        'Si es la columna del año anterior, ver AUT-011.',
      ),
      p(
        'La diferencia que muestra la app es exacta: si es de centavos o menos, también hay que corregirla.',
      ),
    ],
    relacionados: ['paso-clasificar', 'paso-patrimonio-neto', 'aut-011', 'importes-redondeo'],
  },
  {
    id: 'pregunta-sacar-nota',
    titulo: '¿Cómo saco una nota o un anexo del balance?',
    categoria: 'preguntas',
    resumen: 'Cómo hacer que una nota o un anexo deje de salir en las pantallas y en el documento.',
    claves: [
      'sacar nota',
      'quitar nota',
      'eliminar nota',
      'sacar anexo',
      'sigue apareciendo en el pdf',
      'no quiero que salga',
    ],
    bloques: [
      defs(
        [
          'Un anexo o una nota de "Anexos y notas"',
          'Si estaba aceptado, "Quitar de los estados". Si estaba sugerido, "Descartar" o "No aplica". Deja de salir en las pantallas y en el documento imprimible.',
        ],
        [
          'Una nota de composición de un rubro',
          'Borrala desde Notas. Al regenerar las notas puede volver: en el cartel de regenerar, destildá "notas nuevas" si no la querés.',
        ],
      ),
    ],
    relacionados: ['paso-documentos', 'imprimir'],
  },
  {
    id: 'pregunta-gasto-anterior',
    titulo: '¿Cómo cargo un gasto que existió el año anterior y este año no?',
    categoria: 'preguntas',
    resumen: 'Gastos y cuentas que solo existieron en el ejercicio anterior.',
    claves: [
      'gasto del año anterior',
      'cuenta que ya no existe',
      'solo año anterior',
      'fila nueva anterior',
      'rubro que ya no existe',
    ],
    bloques: [
      defs(
        [
          'Anterior vinculado',
          'No hace falta hacer nada: aparece solo, con importe actual cero y su importe anterior reexpresado.',
        ],
        [
          'Anterior cargado a mano: un gasto',
          'En el Anexo III, "Editar" en la columna anterior, agregá una fila nueva y elegí su sección.',
        ],
        [
          'Anterior cargado a mano: una cuenta de un rubro con nota',
          'En la nota, agregá una fila con el nombre de la cuenta y su importe anterior.',
        ],
        [
          'Anterior cargado a mano: un rubro entero',
          'En el Estado de Situación Patrimonial, agregá el rubro del año anterior en la columna anterior.',
        ],
      ),
    ],
    relacionados: ['paso-gastos', 'paso-notas', 'anterior-manual'],
  },
  {
    id: 'pregunta-reimportar',
    titulo: '¿Qué pasa si reimporto el balance?',
    categoria: 'preguntas',
    resumen: 'Las consecuencias de volver a importar el balance de sumas y saldos.',
    claves: ['reimportar', 'volver a importar', 'importar de nuevo', 'cambiar el balance'],
    bloques: [
      lista(
        'Se reemplazan todas las cuentas y se pierde su clasificación: hay que volver a clasificar.',
        'Después regenerá las notas: la app muestra qué cambia y no borra lo cargado a mano salvo que lo elijas.',
      ),
    ],
    relacionados: ['paso-balance', 'paso-notas'],
  },
  {
    id: 'pregunta-no-avanza',
    titulo: '¿Por qué no puedo pasar a Revisión o cerrar?',
    categoria: 'preguntas',
    resumen: 'Lo que hace falta para avanzar el estado del ejercicio.',
    claves: ['no puedo pasar a revision', 'no me deja cerrar', 'no puedo cerrar', 'avanzar estado'],
    bloques: [
      pasos(
        'Confirmá los estados (Estados → "Confirmar estados").',
        'Confirmá el E.E.P.N. ("Confirmar E.E.P.N.").',
        'Si aparece un mensaje con código AUT, buscalo en esta ayuda: dice qué corregir.',
      ),
    ],
    relacionados: ['neg-004', 'neg-030', 'compuerta', 'estados-ejercicio'],
  },
  {
    id: 'pregunta-cerrado',
    titulo: 'Tengo que corregir un ejercicio cerrado',
    categoria: 'preguntas',
    resumen: 'Un ejercicio cerrado no se modifica.',
    claves: [
      'corregir cerrado',
      'reabrir',
      'modificar ejercicio cerrado',
      'error en balance cerrado',
    ],
    bloques: [
      p(
        'Un ejercicio cerrado no se modifica ni se reabre desde la app: es el balance aprobado y firmado, y el siguiente ejercicio puede estar usando sus números. Por eso, antes de cerrar, el ejercicio pasa por Revisión, desde donde todavía se puede volver a En proceso.',
      ),
    ],
    relacionados: ['estados-ejercicio'],
  },
  {
    id: 'pregunta-existencia-inicial',
    titulo: '¿Por qué cambió la existencia inicial del Anexo II?',
    categoria: 'preguntas',
    resumen: 'La existencia inicial es siempre la existencia final del año anterior.',
    claves: ['existencia inicial', 'cambio la existencia', 'costo de ventas cambio'],
    bloques: [
      p(
        'La existencia al comienzo de este ejercicio es, por definición, la existencia final del anterior. La app la toma de ahí, con candado: del ejercicio vinculado (reexpresada) o, con carga manual, de la columna "Ejercicio anterior" del Anexo II. Si antes había otra cargada a mano, ahora se usa la del año anterior y el costo de ventas cambia.',
      ),
    ],
    relacionados: ['paso-costo-ventas'],
  },
  {
    id: 'pregunta-centavos',
    titulo: 'Sumo los importes de la pantalla y no me da el total',
    categoria: 'preguntas',
    resumen:
      'La pantalla muestra 2 decimales cortados, pero los totales suman los importes completos.',
    claves: ['no coincide la suma', 'diferencia de centavos', 'total mal', 'suma a mano'],
    bloques: [
      p(
        'Cada importe se muestra con 2 decimales, cortados sin redondear, pero se guarda y se suma completo. Si algún importe tiene más decimales (por ejemplo, uno reexpresado), la suma de lo que se ve suele quedar unos centavos por debajo del total, que es el correcto. Al editar una celda se ve el importe completo.',
      ),
    ],
    relacionados: ['importes-redondeo'],
  },
  {
    id: 'compuerta',
    titulo: 'La compuerta de autorización',
    categoria: 'preguntas',
    resumen:
      'Los controles que corren antes de confirmar los estados, confirmar el E.E.P.N. y avanzar el ejercicio.',
    claves: [
      'compuerta',
      'controles',
      'validaciones',
      'checklist',
      'condiciones pendientes',
      'autorizacion',
    ],
    bloques: [
      p(
        'Antes de confirmar los estados, confirmar el E.E.P.N. o pasar a Revisión o Cerrado, la app controla que el balance esté completo y cuadre. Lo que bloquea (códigos AUT) hay que corregirlo; los avisos se pueden leer y seguir.',
      ),
      lista(
        'Ejercicio anterior definido y categoría del ente cargada (AUT-001, AUT-002).',
        'Anterior cargado a mano: autorizado y cuadrado (AUT-010, AUT-011, AUT-012).',
        'Anterior vinculado: elegido, iniciado y confirmado (AUT-020, AUT-021, AUT-022).',
        'Primer ejercicio: avisos de inscripción y de presentación sin comparativo (AUT-030, AUT-031).',
        'Primera aplicación de la RT 54: ajustes = modificación al inicio (AUT-040).',
        'Flujo de efectivo cargado y cuadrado (AUT-050, AUT-051, AUT-052).',
      ),
    ],
    relacionados: ['neg-030', 'pregunta-no-avanza'],
  },
  {
    id: 'en-desarrollo',
    titulo: 'Qué está en desarrollo',
    categoria: 'preguntas',
    resumen: 'Partes del balance que la app todavía no genera.',
    claves: [
      'proximamente',
      'pendiente',
      'en desarrollo',
      'nota 1 texto',
      'informe del auditor',
      'memoria',
      'word',
    ],
    bloques: [
      lista(
        'El informe del auditor independiente.',
        'La Memoria.',
        'La exportación a Word editable (hoy el documento se guarda en PDF desde el navegador).',
      ),
    ],
    relacionados: ['imprimir'],
  },
  {
    id: 'buscar-en-la-ayuda',
    titulo: 'Cómo buscar en la ayuda',
    categoria: 'preguntas',
    resumen: 'El buscador entiende preguntas, siglas, errores de tipeo y códigos de error.',
    claves: ['buscador', 'buscar', 'como busco'],
    bloques: [
      lista(
        'Escribí como te salga: "¿cómo cargo el ejercicio anterior?", "no me deja cerrar", "anexo 2".',
        'Entiende siglas y sinónimos: EEPN, SSP, EERR, CMV, "año anterior" = comparativo.',
        'No importan las tildes, las mayúsculas ni un error de tipeo.',
        'Para un mensaje de error, escribí su código como lo veas: "AUT-012", "aut 12" o "neg004".',
        'Con la tecla / (barra) vas directo al buscador. Con las flechas elegís un resultado y con Enter lo abrís.',
      ),
    ],
  },
]

export const GLOSARIO: ArticuloAyuda[] = [
  {
    id: 'glosario',
    titulo: 'Glosario',
    categoria: 'glosario',
    resumen: 'Qué significa cada sigla y término que usa la app.',
    claves: ['glosario', 'que significa', 'definicion', 'siglas'],
    bloques: [
      defs(
        ['SSP', 'Estado de Situación Patrimonial: activo, pasivo y patrimonio neto al cierre.'],
        ['EERR', 'Estado de Resultados: ingresos, costos, gastos y resultado del ejercicio.'],
        [
          'E.E.P.N.',
          'Estado de Evolución del Patrimonio Neto: cómo pasó el patrimonio neto del inicio al cierre.',
        ],
        [
          'EFE',
          'Estado de Flujo de Efectivo: cómo varió el efectivo por actividades operativas, de inversión y de financiación.',
        ],
        [
          'RT 54',
          'Resolución Técnica 54 de la FACPCE: norma unificada de presentación de estados contables.',
        ],
        [
          'RT 6',
          'Resolución Técnica 6: estados contables en moneda homogénea (ajuste por inflación).',
        ],
        [
          'Primera aplicación (primera adopción)',
          'El primer ejercicio en que se aplica la RT 54: lleva nota de transición con sus ajustes.',
        ],
        ['Comparativo', 'La columna "Ejercicio anterior" de estados, anexos y notas.'],
        ['Vinculado', 'El ejercicio anterior está cargado en BalanceRT y la app toma sus números.'],
        ['Carga manual', 'El ejercicio anterior se carga a mano y se autoriza.'],
        [
          'Coeficiente',
          'Índice de inflación al cierre ÷ índice al cierre anterior. Reexpresa el comparativo a moneda de cierre.',
        ],
        [
          'Reexpresión',
          'Expresar un importe del año anterior en moneda de cierre, multiplicándolo por el coeficiente.',
        ],
        [
          'RECPAM',
          'Resultado por exposición a los cambios en el poder adquisitivo de la moneda: va dentro de los resultados financieros y por tenencia.',
        ],
        [
          'Rubro (clasificación)',
          'El grupo del balance donde va una cuenta: Caja y bancos, Créditos por ventas, Deudas fiscales…',
        ],
        ['Sección', 'Agrupador de rubros (corriente, no corriente, una sección de gastos…).'],
        [
          'Anexo I',
          'Bienes de uso: valores de origen, amortizaciones y neto residual por categoría.',
        ],
        ['Anexo II', 'Costo de ventas: existencias, compras y gastos de fabricación.'],
        ['Anexo III', 'Gastos por sección, con una fila por cuenta.'],
        ['Nota cuantitativa', 'Detalla las cuentas de un rubro con importe actual y anterior.'],
        ['Nota informativa', 'Nota de solo texto.'],
        [
          'Nota I',
          'Bases de preparación: unidad de medida, criterios, adopción de la RT 54, hechos posteriores.',
        ],
        [
          'Compuerta de autorización',
          'Los controles que corren antes de confirmar y de avanzar el ejercicio.',
        ],
        ['Autorizar', 'Con carga manual: el contador da por buenos los importes del año anterior.'],
        ['Confirmar', 'Dar por terminados los estados o el E.E.P.N. del ejercicio.'],
        ['Candado', 'El importe viene de otro lugar y se cambia ahí.'],
        [
          'Resultados no asignados (RNA)',
          'Resultados acumulados de ejercicios anteriores que todavía no se distribuyeron.',
        ],
        ['Categoría del ente', 'Pequeña, mediana o restante, según la RT 54.'],
      ),
    ],
  },
]
