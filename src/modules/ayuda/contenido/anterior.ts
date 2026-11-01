import type { ArticuloAyuda } from '../domain/tipos'
import { aviso, defs, lista, p, pasos } from './bloques'

export const ANTERIOR: ArticuloAyuda[] = [
  {
    id: 'anterior-vinculado',
    titulo: 'Ejercicio anterior vinculado',
    categoria: 'anterior',
    resumen:
      'Cuando el ejercicio anterior está cargado en BalanceRT: qué toma la app sola, cómo lo reexpresa y qué pasa con lo que existió solo ese año.',
    claves: [
      'vinculado',
      'vincular',
      'arrastre',
      'saldos de inicio',
      'candado',
      'reexpresado',
      'coeficiente',
      'traer del anterior',
    ],
    bloques: [
      defs(
        [
          'Requisitos',
          'El anterior es de la misma sociedad, no está vinculado a otro ejercicio, no está en Borrador (AUT-021) y tiene confirmados los estados y el E.E.P.N. (AUT-022).',
        ],
        [
          'Qué toma solo, con candado',
          'La columna "Ejercicio anterior" de estados, anexos, notas y flujo; los saldos al inicio del E.E.P.N.; el valor y la amortización al comienzo del Anexo I; la existencia inicial del Anexo II.',
        ],
        [
          'Reexpresión',
          'Si los índices de inflación son distintos, el anterior se expresa en moneda de cierre: se multiplica por el coeficiente completo. Vale para el estado de situación patrimonial, el estado de resultados (incluidos los gastos), las notas, el costo de ventas del año anterior y el neto anterior del Anexo I. Nada de la columna del ejercicio actual se ajusta.',
        ],
      ),
      lista(
        'El efectivo al inicio del flujo y la existencia al comienzo del Anexo II son de este año: quedan como cerraron, sin ajustar.',
        'Excepciones a propósito: en el Anexo I el valor y la amortización al comienzo quedan como cerraron y la reexpresión se carga en "Ajuste por inflación"; en el E.E.P.N. la reexpresión de los saldos al inicio se carga en la fila "Ajuste por inflación".',
        'Lo que existió solo el año anterior aparece igual: un rubro, una fila o una sección entera del Anexo III, un concepto del flujo.',
        'Si al anterior le falta un dato (por ejemplo, no tiene Anexo II), esa parte queda editable y la app lo avisa.',
        'Con el anterior vinculado no se carga nada a mano en la columna anterior (NEG-012).',
      ),
    ],
    relacionados: ['coeficiente', 'paso-anterior', 'cambiar-modo', 'aut-021', 'aut-022'],
  },
  {
    id: 'anterior-manual',
    titulo: 'Ejercicio anterior cargado a mano',
    categoria: 'anterior',
    resumen:
      'Dónde se carga cada importe del año anterior (una sola vez), qué completa la app sola y cómo se autoriza.',
    claves: [
      'carga manual',
      'anterior a mano',
      'comparativo manual',
      'donde cargo el anterior',
      'balance anterior impreso',
      'autorizar',
      'una sola vez',
    ],
    bloques: [
      p(
        'Se usa cuando el ejercicio anterior no está en BalanceRT: los importes salen del balance anterior impreso. Cada importe se carga una sola vez, en su lugar más detallado.',
      ),
      defs(
        [
          'Rubros con nota (Caja y bancos, créditos, deudas…)',
          'En la nota, cuenta por cuenta. El estado muestra el total de la nota con candado. Una cuenta que ya no existe: agregá una fila en la nota.',
        ],
        [
          'Bienes de uso',
          'En el Anexo I: el neto anterior sale del valor y la amortización al comienzo.',
        ],
        [
          'Bienes de cambio y costo de ventas',
          'Las mercaderías en su nota. En el Anexo II, existencia inicial, compras y gastos de fabricación del año anterior; la existencia final se propone desde la nota.',
        ],
        [
          'Gastos',
          'En el Anexo III, fila por fila. Los gastos que ya no existen: fila nueva eligiendo su sección.',
        ],
        [
          'Rubros sin nota ni anexo',
          'En el Estado de Situación Patrimonial, con "Editar" en la columna anterior. Un rubro que solo existió el año anterior se agrega ahí.',
        ],
        [
          'Estado de resultados',
          'Ingresos, resultados financieros e impuesto a las ganancias en el estado. El costo de ventas sale del Anexo II y los gastos del Anexo III.',
        ],
        [
          'E.E.P.N.',
          'La columna "Ejercicio anterior" de cada fila. El resultado sale del estado de resultados anterior.',
        ],
        [
          'Flujo de efectivo',
          'El importe anterior de cada concepto y el efectivo al inicio del año anterior.',
        ],
      ),
      aviso(
        'No tipees lo que la app ya completa: la existencia inicial de este año, la existencia final anterior propuesta, el resultado anterior del E.E.P.N., el neto anterior del Anexo I, el total de los rubros con nota y, en primera aplicación de la RT 54, la modificación de saldos al inicio.',
      ),
      pasos(
        'Con todo cargado, abrí el paso "Ejercicio anterior" y revisá el cuadre.',
        'Hacé clic en "Autorizar". Queda registrado quién y cuándo, y los importes se ajustan por inflación con el coeficiente.',
        'Si después cambiás algo de la columna anterior, la autorización se anula y hay que autorizar de nuevo (AUT-010).',
      ),
      aviso(
        'Cargá los importes tal como salieron en el balance anterior, sin ajustar. Al autorizar se ajustan todos juntos; si ya estaban ajustados, se ajustarían dos veces.',
      ),
      defs(
        [
          'Qué se ajusta',
          'La columna "Ejercicio anterior" de los estados, el Anexo II, el Anexo III, las notas, el neto anterior del Anexo I, el E.E.P.N. y el flujo de efectivo. El valor y la amortización al comienzo del Anexo I y los saldos al inicio del E.E.P.N. no: su reexpresión se carga en "Ajuste por inflación".',
        ],
        [
          'Qué no se ajusta',
          'Nada de la columna del ejercicio actual. El efectivo al inicio del flujo y la existencia al comienzo del Anexo II son de este año: quedan como se cargaron, sin ajustar.',
        ],
        [
          'Ver lo cargado',
          'Ya ajustado, el botón "Ver lo cargado" agrega al lado una columna con lo que se escribió, sin ajustar, y "Ocultar lo cargado" la saca. Es solo para ver en pantalla: no sale en el balance.',
        ],
        [
          'Corregir lo cargado',
          'En el paso Ejercicio anterior. Quita el ajuste y la autorización, y vuelven a verse los importes como se cargaron para editarlos. Cuando termines, autorizá de nuevo. Los estados y el E.E.P.N. confirmados se confirman otra vez.',
        ],
        [
          'Saldos que ya estaban autorizados',
          'Los que se autorizaron antes de que existiera este ajuste siguen sin ajustar, y el paso lo avisa. Para ajustarlos, quitá la autorización y autorizá de nuevo.',
        ],
      ),
    ],
    relacionados: ['paso-anterior', 'aut-010', 'aut-011', 'aut-012', 'paso-notas'],
  },
  {
    id: 'primer-ejercicio',
    titulo: 'Primer ejercicio (sin comparativo)',
    categoria: 'anterior',
    resumen:
      'Cuándo corresponde declarar el primer ejercicio y cómo se presenta el balance sin columna anterior.',
    claves: [
      'primer ejercicio',
      'sin comparativo',
      'sin anterior',
      'sociedad nueva',
      'inicio de actividades',
    ],
    bloques: [
      p(
        'Corresponde cuando la sociedad no tuvo ejercicios previos. Los estados se presentan sin columna "Ejercicio anterior" y lo dicen expresamente (AUT-031).',
      ),
      lista(
        'Si la sociedad se inscribió más de un año antes del inicio del ejercicio, la app avisa: probablemente hubo ejercicios previos y corresponde cargarlos a mano (AUT-030).',
        'En el flujo de efectivo, el efectivo al inicio se escribe (en una sociedad nueva suele ser cero).',
        'En el E.E.P.N., los saldos al inicio se cargan (por ejemplo, el capital suscripto).',
      ),
    ],
    relacionados: ['aut-030', 'aut-031', 'paso-anterior'],
  },
  {
    id: 'cambiar-modo',
    titulo: 'Cambiar cómo se resuelve el ejercicio anterior',
    categoria: 'anterior',
    resumen:
      'Qué pasa al cambiar entre vinculado, carga manual y primer ejercicio, o al cambiar el ejercicio vinculado.',
    claves: [
      'cambiar modo',
      'pasar de manual a vinculado',
      'desvincular',
      'cambiar el ejercicio anterior',
      'consegui el balance anterior',
    ],
    bloques: [
      pasos(
        'Abrí "Editar ejercicio".',
        'Cambiá la respuesta del ejercicio anterior (o el ejercicio vinculado).',
        'Confirmá.',
      ),
      lista(
        'Cambiar el modo o el ejercicio vinculado anula la autorización del anterior y las confirmaciones de los estados y del E.E.P.N.',
        'Si dejás de cargarlo a mano, los importes cargados a mano se borran: la app pide confirmación antes.',
        'Para desvincular un ejercicio que otro usa como anterior, hacelo desde ese otro ejercicio.',
      ),
    ],
    relacionados: ['anterior-vinculado', 'anterior-manual', 'neg-003'],
  },
  {
    id: 'coeficiente',
    titulo: 'Índices de inflación y coeficiente de reexpresión',
    categoria: 'anterior',
    resumen: 'Cómo se calcula el coeficiente, cómo se muestra y dónde se aplica.',
    claves: [
      'coeficiente',
      'indice',
      'ipc',
      'inflacion',
      'reexpresion',
      'ajuste por inflacion',
      'rt 6',
      'moneda homogenea',
      'recpam',
    ],
    bloques: [
      defs(
        [
          'Índices',
          'Al crear el ejercicio se cargan el índice al cierre del ejercicio anterior y el del cierre de este. Se usa la serie que define la FACPCE (IPC nacional).',
        ],
        [
          'Coeficiente',
          'Índice actual ÷ índice anterior. Con el anterior vinculado, y con el manual al autorizarlo, se ajustan los importes. En los datos del ejercicio se ve con 8 decimales y en el paso del anterior con 2, siempre cortados, sin redondear. Cada importe se reexpresa con los dos índices completos (importe × índice actual ÷ índice anterior): nunca se multiplica por el número mostrado.',
        ],
        [
          'Dónde se aplica',
          'Con el anterior vinculado, a toda la columna "Ejercicio anterior" (ver "Ejercicio anterior vinculado"). Si los índices son iguales o faltan, el coeficiente es 1.',
        ],
      ),
      p(
        'El RECPAM (resultado por exposición a los cambios en el poder adquisitivo de la moneda) se expone en el Estado de Resultados, dentro de los resultados financieros y por tenencia.',
      ),
    ],
    relacionados: ['anterior-vinculado', 'importes-redondeo'],
  },
]

export const USO: ArticuloAyuda[] = [
  {
    id: 'editar-tablas',
    titulo: 'Cómo se editan las tablas',
    categoria: 'uso',
    resumen: 'Editar, Guardar y Cancelar; filas que se agregan en el momento; celdas con candado.',
    claves: [
      'editar',
      'guardar',
      'cancelar',
      'lapiz',
      'boton editar',
      'no me deja guardar',
      'agregar fila',
      'eliminar fila',
      'candado',
      'celda bloqueada',
    ],
    bloques: [
      pasos(
        'Toda tabla arranca en modo lectura. Hacé clic en "Editar" (lápiz, arriba a la derecha).',
        'Cambiá los importes: todavía no se guarda nada.',
        '"Guardar" guarda todo junto; "Cancelar" descarta todos los cambios.',
      ),
      lista(
        'Agregar o quitar una fila (una categoría, una línea, una nota) se guarda en el momento y aparece enseguida.',
        'La columna "Ejercicio anterior" tiene su propio "Editar", independiente del resto de la tabla.',
        'Una celda con candado viene de otro lado (el ejercicio anterior, una nota, otro anexo): pasá el mouse para ver de dónde. Para cambiarla, cambiá el origen.',
        'Al editar una celda se ve el importe completo, con todos sus decimales.',
      ),
    ],
    relacionados: ['formato-importes', 'pregunta-no-guarda', 'pregunta-candado'],
  },
  {
    id: 'formato-importes',
    titulo: 'Cómo escribir importes',
    categoria: 'uso',
    resumen: 'Formatos aceptados para escribir un importe, negativos y cómo se ven en pantalla.',
    claves: [
      'formato',
      'coma',
      'punto',
      'miles',
      'decimales',
      'negativo',
      'parentesis',
      'signo menos',
      'guion',
    ],
    bloques: [
      lista(
        'Se aceptan 1.234,56 y 1234,56 (formato argentino) y también 1,234.56.',
        'Un negativo se escribe con signo menos (-1.234,56) o entre paréntesis ((1.234,56)).',
        'En pantalla los negativos se ven entre paréntesis y un cero se ve como "—".',
        'Lo que escribís se guarda completo, con todos los decimales.',
      ),
    ],
    relacionados: ['importes-redondeo', 'editar-tablas'],
  },
  {
    id: 'importes-redondeo',
    titulo: 'La app nunca redondea',
    categoria: 'uso',
    resumen:
      'Por qué la pantalla muestra 2 decimales pero los cálculos usan el importe completo, y qué significa para los controles.',
    claves: [
      'redondeo',
      'redondear',
      'decimales',
      'centavos',
      'diferencia de centavos',
      'no coincide la suma',
      'importe completo',
      'exacto',
    ],
    bloques: [
      lista(
        'Los cálculos, los totales y la base de datos usan siempre el importe completo, sin redondear.',
        'La pantalla y el documento muestran 2 decimales, cortados sin redondear (1.234,567 se ve 1.234,56): es solo cómo se ve.',
        'Por eso, si sumás a mano los importes que se ven, puede no darte exactamente el total: el total suma los importes completos.',
        'Los controles comparan exacto: una diferencia de una milésima es una diferencia. Los mensajes de control la muestran completa.',
        'El coeficiente de reexpresión se ve cortado, sin redondear: con 8 decimales en los datos del ejercicio y con 2 en el paso del anterior. Los importes se reexpresan con los dos índices completos.',
        'Un importe de más de 70 billones de pesos no se puede calcular con exactitud y la app lo avisa (NEG-060).',
      ),
    ],
    relacionados: ['formato-importes', 'coeficiente', 'neg-060'],
  },
]
