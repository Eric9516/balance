import type { ArticuloAyuda } from '../domain/tipos'
import { aviso, defs, lista, p, pasos } from './bloques'
import { CONFIGURAR_NOTAS } from './configuracionNotas'

export const PASOS: ArticuloAyuda[] = [
  {
    id: 'paso-balance',
    titulo: 'Balance de sumas y saldos',
    categoria: 'pasos',
    paso: 'balance',
    resumen:
      'Las cuentas del ejercicio: de dónde salen, cómo se cargan y qué se controla al importarlas.',
    claves: [
      'cuentas',
      'balance de sumas y saldos',
      'carga manual',
      'reimportar',
      'saldo deudor',
      'saldo acreedor',
      'debe',
      'haber',
    ],
    bloques: [
      p(
        'Hay dos formas de cargar las cuentas: importar un Excel del sistema contable del cliente (Tango, Bejerman, etc.) o escribirlas en la carga manual.',
      ),
      lista(
        'Carga manual: escribís código, nombre, saldo deudor y saldo acreedor de cada cuenta.',
        'Si ya cargaste cuentas, usá "Agregar cuenta" en el balance: las nuevas se agregan sin reemplazar las existentes ni perder sus clasificaciones. Los códigos ya usados se rechazan.',
        'Podés agregar una cuenta por vez aunque la carga adicional no cuadre. Después revisá el cuadre total, clasificá las cuentas nuevas y regenerá las notas. Los estados deben confirmarse de nuevo.',
        'Cada cuenta necesita un código único (NEG-012) y un nombre (NEG-010).',
        'En la carga inicial y al importar Excel, la app controla que el total del debe sea igual al del haber, exacto. Si no cuadra, te dice de cuánto es la diferencia (NEG-011).',
      ),
      aviso(
        'Reimportar reemplaza todas las cuentas y se pierde la clasificación: hay que volver a clasificar y regenerar las notas.',
      ),
    ],
    relacionados: ['importar-excel', 'paso-clasificar', 'formato-importes'],
  },
  {
    id: 'importar-excel',
    titulo: 'Importar el balance desde Excel',
    categoria: 'pasos',
    resumen: 'Paso a paso para subir el balance de sumas y saldos en un archivo .xlsx.',
    claves: [
      'excel',
      'xlsx',
      'subir archivo',
      'mapear columnas',
      'filas a omitir',
      'encabezado',
      'tango',
      'bejerman',
    ],
    bloques: [
      pasos(
        'Abrí el ejercicio y elegí "Importar".',
        'Seleccioná el archivo .xlsx.',
        'Indicá cuántas filas de arriba omitir (títulos y encabezados que no son cuentas).',
        'Indicá qué columna tiene el código, el nombre, el saldo deudor y el saldo acreedor.',
        'En "Revisar y editar datos" corregí, agregá o borrá filas si hace falta.',
        'Confirmá la importación.',
      ),
      lista(
        'Los importes se leen tal cual, sin redondear: 1.234,56, 1234,56 y 1,234.56 son el mismo número; entre paréntesis o con signo menos es negativo.',
        'Si el debe y el haber no cuadran, no se confirma: la app muestra la diferencia completa.',
      ),
    ],
    relacionados: ['paso-balance', 'formato-importes', 'neg-011'],
  },
  {
    id: 'paso-caratula',
    titulo: 'Carátula',
    categoria: 'pasos',
    paso: 'caratula',
    resumen: 'Los datos formales del balance: sociedad, ejercicio, auditor y fechas.',
    claves: ['caratula', 'portada', 'datos de la sociedad', 'datos del ejercicio'],
    bloques: [
      p(
        'La carátula no se edita acá: se arma con los datos de la sociedad y del ejercicio. Para cambiar algo, editá la sociedad o el ejercicio.',
      ),
    ],
    relacionados: ['sociedades', 'crear-ejercicio', 'auditores'],
  },
  {
    id: 'paso-clasificar',
    titulo: 'Clasificar cuentas',
    categoria: 'pasos',
    paso: 'clasificar',
    resumen:
      'Cómo asignar cada cuenta a su rubro, de a una o varias juntas, y cómo corregir o borrar una cuenta sin descuadrar el balance.',
    claves: [
      'clasificar',
      'asignar rubro',
      'sin clasificar',
      'clasificacion en lote',
      'varias cuentas',
      'cuentas pendientes',
      'editar cuenta',
      'borrar cuenta',
      'descuadre',
      'no cuadra',
    ],
    bloques: [
      pasos(
        'Abrí el ejercicio → Clasificar cuentas.',
        'Para cada cuenta elegí el rubro en el desplegable (agrupado por sección).',
        'Para varias juntas: marcalas con la casilla y asigná el rubro con la barra de abajo.',
        'Usá los filtros Todas / Sin clasificar / Clasificadas para encontrar lo que falta.',
      ),
      lista(
        'Las cuentas patrimoniales van a rubros del Estado de Situación Patrimonial; las de resultado, al Estado de Resultados; capital y reservas, a los rubros del Patrimonio Neto.',
        'Una cuenta sin clasificar no aparece en ningún estado.',
        'La clasificación decide qué anexos y notas se sugieren.',
      ),
      aviso(
        'Una cuenta mal clasificada cambia los totales de los estados y de las notas. Revisá especialmente que ingresos y costos vayan al Estado de Resultados.',
      ),
      p('Para corregir o borrar una cuenta:'),
      pasos(
        'Pasá el mouse por la fila: el lápiz edita el nombre y los importes, y el tacho borra la cuenta.',
        'Al cambiar el debe o el haber, el saldo se recalcula solo. Tocá el tilde para guardar o la X para cancelar.',
      ),
      lista(
        'Si el cambio descuadra el balance de sumas y saldos, antes de guardar aparece un cartel con la diferencia de hoy y la que quedaría. "Volver sin guardar" no cambia nada; "Guardar igual" lo guarda así.',
        'El cartel también aparece si el balance ya no cuadraba y el cambio agranda la diferencia. Si el cambio lo arregla, no hay cartel y la app avisa que el balance cuadra.',
        'Un centavo de diferencia también cuenta: la app nunca redondea.',
      ),
      aviso(
        'Borrar una cuenta no se puede deshacer desde la app. Si una cuenta tiene un importe mal cargado, corregí el importe en vez de borrarla.',
      ),
    ],
    relacionados: ['clasificaciones', 'paso-documentos', 'neg-069'],
  },
  {
    id: 'paso-anterior',
    titulo: 'Ejercicio anterior',
    categoria: 'pasos',
    paso: 'anterior',
    resumen:
      'Los tres caminos para la columna comparativa y cómo se autoriza el anterior cargado a mano.',
    claves: [
      'comparativo',
      'columna ejercicio anterior',
      'autorizar',
      'saldos de inicio',
      'vinculado',
      'carga manual',
      'primer ejercicio',
    ],
    bloques: [
      defs(
        [
          'Vinculado',
          'El anterior está cargado en BalanceRT. La app toma sus saldos de cierre, reexpresados con el coeficiente, y los bloquea con candado.',
        ],
        [
          'Carga manual',
          'No está cargado. Cargás los importes del año anterior una sola vez, en su lugar más detallado, y después los autorizás.',
        ],
        [
          'Primer ejercicio',
          'La sociedad no tuvo ejercicios previos. No hay columna comparativa y los estados lo dicen.',
        ],
      ),
      pasos(
        'Carga manual: cargá todo el anterior (notas, anexos, estado de resultados, E.E.P.N. y flujo).',
        'Abrí el paso "Ejercicio anterior": muestra qué bloques están cargados y si cuadra (activo = pasivo + patrimonio neto, y resultado del EERR = resultado del E.E.P.N.).',
        'Cuando esté todo, hacé clic en "Autorizar": queda registrado quién y cuándo.',
      ),
      aviso(
        'Cualquier cambio posterior en la columna "Ejercicio anterior" anula la autorización: hay que volver a autorizar (AUT-010).',
      ),
    ],
    relacionados: [
      'anterior-vinculado',
      'anterior-manual',
      'primer-ejercicio',
      'cambiar-modo',
      'coeficiente',
    ],
  },
  {
    id: 'paso-documentos',
    titulo: 'Anexos y notas sugeridos',
    categoria: 'pasos',
    paso: 'documentos',
    resumen:
      'Cómo decidir qué anexos y notas lleva el balance: aceptar, descartar, no aplica o agregar uno a mano.',
    claves: [
      'anexos y notas',
      'sugeridos',
      'aceptar',
      'descartar',
      'no aplica',
      'quitar de los estados',
      'agregar nota',
      'agregar anexo',
      'sacar una nota',
      'sacar un anexo',
    ],
    bloques: [
      p(
        'La app revisa los saldos por rubro y sugiere los anexos y notas que corresponden. Nada entra al balance hasta que lo aceptás.',
      ),
      defs(
        [
          'Aceptar',
          'El anexo o la nota pasa a formar parte del balance: aparece su pestaña o su nota y sale en el documento.',
        ],
        ['Descartar', 'No va en este balance.'],
        [
          'Agregar una nota manual',
          'En "Agregar documento manual" elegís "Nota", le ponés título y elegís dónde va. La nota aparece en el paso Notas, lista para completar, y sale en el balance. Después la podés mover con las flechas o con "Mover a…", arriba de cada nota. Regenerar las notas no la borra y respeta el lugar donde las ubicaste.',
        ],
        [
          'No aplica / No aplica este año',
          'No corresponde para esta sociedad o para este ejercicio.',
        ],
        [
          'Quitar de los estados',
          'Saca un documento ya aceptado: deja de salir en las pantallas y en el documento imprimible.',
        ],
        [
          'Agregar a mano',
          'Una nota o un anexo que la app no sugirió: elegís si es nota o anexo y le ponés título.',
        ],
      ),
      lista(
        'Si un documento aceptado se queda sin saldo, la app avisa; no lo saca sola.',
        'La nota de transición a la RT 54 sale en el balance solo si la aceptás acá.',
      ),
    ],
    relacionados: ['paso-anexos', 'paso-notas', 'nota-transicion'],
  },
  {
    id: 'paso-anexos',
    titulo: 'Anexos',
    categoria: 'pasos',
    paso: 'anexos',
    resumen: 'Dónde se cargan los anexos aceptados, cada uno en su pestaña.',
    claves: ['anexos', 'pestañas', 'anexo i', 'anexo ii', 'anexo iii'],
    bloques: [
      p(
        'Cada anexo aceptado en "Anexos y notas" aparece como pestaña. Si no aparece, aceptalo primero en ese paso.',
      ),
      lista('Anexo I: Bienes de uso.', 'Anexo II: Costo de ventas.', 'Anexo III: Gastos.'),
    ],
    relacionados: ['paso-bienes-de-uso', 'paso-costo-ventas', 'paso-gastos', 'paso-documentos'],
  },
  {
    id: 'paso-bienes-de-uso',
    titulo: 'Anexo I - Bienes de uso',
    categoria: 'pasos',
    paso: 'bienes-de-uso',
    resumen:
      'Cómo cargar las categorías, sus valores y amortizaciones, de dónde sale el año anterior y cómo elegir cómo sale el anexo en el documento (Apariencia).',
    claves: [
      'bienes de uso',
      'amortizaciones',
      'categorias',
      'rodados',
      'muebles y utiles',
      'valor de origen',
      'neto residual',
      'agregar categoria',
      'altas',
      'bajas',
      'apariencia',
      'un solo cuadro',
      'dos cuadros',
      'formato del anexo',
      'como sale impreso',
      'vista previa',
    ],
    bloques: [
      pasos(
        'Para agregar una categoría (Rodados, Muebles y útiles…): "Agregar categoría". Se guarda en el momento.',
        'Para cargar importes: "Editar", completá las columnas y "Guardar" (o "Cancelar" para descartar).',
      ),
      defs(
        [
          'Valor de origen',
          'Al comienzo, ajuste por inflación, aumentos (altas) y disminuciones (bajas). El valor al cierre se calcula.',
        ],
        [
          'Amortizaciones',
          'Al comienzo, ajuste por inflación, bajas y del ejercicio. La amortización al cierre se calcula.',
        ],
        [
          'Neto residual',
          'Valor al cierre menos amortización al cierre. La suma de las categorías es el rubro Bienes de uso del Estado de Situación Patrimonial.',
        ],
      ),
      lista(
        'Anterior vinculado: el valor y la amortización al comienzo son el cierre del anterior, con candado. La reexpresión por inflación se carga en las columnas "Ajuste por inflación".',
        'Anterior cargado a mano: el neto del año anterior se calcula solo (valor al comienzo menos amortización al comienzo, con sus ajustes). Si había uno escrito a mano que no coincide, el anexo lo avisa.',
        'La amortización del ejercicio debería coincidir con el gasto de amortizaciones del Anexo III.',
      ),
      p(
        'Apariencia: cómo sale este anexo en el documento impreso. Es el botón chico "Apariencia", arriba a la derecha, al lado de "Editar". Abre una vista previa con los datos guardados del balance, tal como se imprime.',
      ),
      defs(
        [
          'Un solo cuadro',
          'El formato tradicional: en cada fila, el valor de origen, las amortizaciones y el neto residual del ejercicio y del anterior. Sale en hoja apaisada. Es el que viene por defecto.',
        ],
        [
          'Dos cuadros',
          'Arriba el valor de origen y abajo las amortizaciones con los netos. Se lee mejor cuando los importes son muy largos.',
        ],
      ),
      lista(
        'Elegí uno en la vista previa y tocá "Usar este formato". Vale para el documento de este balance: los demás no cambian.',
        'Los importes son los mismos en los dos formatos: solo cambia cómo se dibuja la tabla.',
        'Un balance nuevo arranca con el formato del balance anterior de la misma sociedad.',
        'Lo elige el dueño o un contador. En un balance cerrado se puede mirar la vista previa, pero no cambiar el formato.',
      ),
    ],
    relacionados: ['anterior-vinculado', 'anterior-manual', 'editar-tablas'],
  },
  {
    id: 'paso-costo-ventas',
    titulo: 'Anexo II - Costo de ventas',
    categoria: 'pasos',
    paso: 'costo-ventas',
    resumen: 'Cómo se carga el costo de ventas y por qué la existencia inicial tiene candado.',
    claves: [
      'costo de ventas',
      'cmv',
      'existencia inicial',
      'existencia final',
      'compras',
      'gastos de fabricacion',
      'inventario',
      'mercaderias',
    ],
    bloques: [
      pasos(
        'Hacé clic en "Editar".',
        'Completá compras, gastos de fabricación y existencia final.',
        'Guardá.',
      ),
      lista(
        'La existencia inicial es la existencia final del año anterior: tiene candado, con el anterior vinculado o cargado a mano.',
        'Anterior cargado a mano: la columna "Ejercicio anterior" tiene su propio "Editar". Cargás existencia inicial, compras y gastos de fabricación del año anterior; la existencia final del año anterior se propone desde la nota de Bienes de cambio. Si es otra (por ejemplo, el rubro incluye anticipos a proveedores), escribila y vale la tuya.',
        'Los conceptos que solo existieron el año anterior se agregan como fila nueva de esa columna.',
        'El costo de ventas va al Estado de Resultados; el del año anterior también sale de este anexo.',
      ),
    ],
    relacionados: ['anterior-manual', 'paso-notas', 'pregunta-existencia-inicial'],
  },
  {
    id: 'paso-gastos',
    titulo: 'Anexo III - Gastos',
    categoria: 'pasos',
    paso: 'gastos',
    resumen: 'Cómo se arma el anexo de gastos y cómo se carga el año anterior fila por fila.',
    claves: [
      'gastos',
      'anexo iii',
      'gastos de administracion',
      'gastos de comercializacion',
      'gastos bancarios',
      'impuestos y contribuciones',
      'fila nueva',
      'gasto del año anterior',
    ],
    bloques: [
      p(
        'El anexo se arma solo con las cuentas clasificadas en secciones de gasto: una fila por cuenta y una columna por sección. Si una cuenta con el mismo nombre está en dos secciones, la fila tiene un importe en cada una.',
      ),
      lista(
        'Anterior vinculado: el año anterior sale de las cuentas del anterior, reexpresadas. Los gastos que este año ya no están aparecen igual, con importe actual cero.',
        'Anterior cargado a mano: "Editar" en la columna "Ejercicio anterior" y cargá el importe de cada fila. Si la fila está en varias secciones, un importe por sección.',
        'Un gasto que existió solo el año anterior: agregá una fila nueva en la columna anterior y elegí su sección.',
        'Los totales por sección (actual y anterior) son las líneas de gastos del Estado de Resultados: no se escriben en el estado.',
      ),
    ],
    relacionados: ['secciones-gasto', 'anterior-manual', 'anterior-vinculado'],
  },
  {
    id: 'paso-notas',
    titulo: 'Notas',
    categoria: 'pasos',
    paso: 'notas',
    resumen:
      'Cómo generar, regenerar y editar las notas, y dónde se carga su columna del año anterior.',
    claves: [
      'notas',
      'notas de composicion',
      'generar notas',
      'regenerar',
      'configurar nota i',
      'criterio de medicion',
      'texto de apertura',
      'agregar fila',
      'hechos posteriores',
      'criterio de bienes de cambio',
    ],
    bloques: [
      pasos(
        'Respondé "Configurar Nota I": adopción de la RT 54 (primera adopción o aplicación continuada), criterio de medición de bienes de cambio y hechos posteriores al cierre. Con eso y los datos del ejercicio, la app arma la Nota 1 (ver "Nota 1: bases de preparación"). Qué cambia cada respuesta: "Configuración de las notas: qué hace cada opción", o el símbolo (?) de cada opción.',
        'Hacé clic en "Generar las notas": se arma una nota por cada rubro que la lleva, con sus cuentas.',
        'Editá el texto de apertura o el criterio de cada nota si hace falta.',
      ),
      defs(
        [
          'Nota cuantitativa',
          'Detalla las cuentas del rubro con el importe actual y el anterior. El total tiene que coincidir con el rubro.',
        ],
        ['Nota informativa', 'Solo texto (por ejemplo, la de bienes de uso remite al Anexo I).'],
        [
          'Regenerar',
          'Si cambiaron las cuentas, la app muestra qué va a cambiar antes de hacerlo. Por defecto agrega notas y filas nuevas, actualiza los importes actuales y quita filas que ya no son cuentas y no tienen importe anterior. Nunca borra una fila con importe anterior ni pisa un texto que editaste, salvo que lo elijas.',
        ],
      ),
      lista(
        'El importe del ejercicio actual sale del balance: no se edita en la nota.',
        'Anterior cargado a mano: el año anterior de cada rubro con nota se carga acá, cuenta por cuenta. Si una cuenta ya no existe, agregá una fila con su nombre y su importe anterior.',
        'Anterior vinculado: la columna anterior sale de las cuentas del anterior, reexpresadas, con candado.',
        'Si borrás una nota, las demás se renumeran.',
      ),
    ],
    relacionados: [
      'configurar-notas',
      'nota-uno',
      'nota-transicion',
      'anterior-manual',
      'paso-documentos',
    ],
  },
  CONFIGURAR_NOTAS,
  {
    id: 'nota-uno',
    titulo: 'Nota 1: bases de preparación (se arma sola y se puede editar)',
    categoria: 'pasos',
    resumen:
      'La app escribe la Nota 1 con los datos del ejercicio. El contador puede reemplazarla por su propio texto y volver al generado cuando quiera.',
    claves: [
      'nota 1',
      'nota i',
      'bases de preparacion',
      'bases de presentacion',
      'unidad de medida',
      'empresa en marcha',
      'clasificacion de la entidad',
      'adopcion de la rt 54',
      'editar nota 1',
      'texto de la nota 1',
    ],
    bloques: [
      p(
        'Aparece primera en el paso Notas y en el documento. Sus apartados se numeran solos según lo que corresponda:',
      ),
      defs(
        [
          'Bases de preparación',
          'RT 54 de la FACPCE y, para sociedades de Córdoba, su aprobación por el Consejo de Córdoba (Resolución N° 35/24).',
        ],
        [
          'Adopción de la RT 54',
          'Primera aplicación o aplicación continuada, según "Configurar Nota I". En la primera aplicación incluye lo que dice la nota de transición.',
        ],
        [
          'Unidad de medida',
          'Moneda homogénea de cierre, reexpresión con la serie de la FACPCE y la variación del índice del ejercicio (sale de los índices cargados).',
        ],
        [
          'Clasificación de la Entidad',
          'Pequeña, mediana o restante, según la categoría del ente del ejercicio.',
        ],
        ['Empresa en marcha', 'Texto estándar.'],
        [
          'Transición a la RT 54',
          'Solo en la primera aplicación, si la nota de transición está aceptada y tiene ajustes o reclasificaciones: las conciliaciones salen de los ajustes cargados.',
        ],
      ),
      pasos(
        'Para cambiar el texto: "Editar" en la Nota 1, escribí y "Guardar".',
        'Para descartar tu texto: "Volver al texto generado".',
      ),
      lista(
        'Mientras no la edites, se actualiza sola si cambian los datos (índices, categoría, adopción, ajustes).',
        'Si la editás, queda tu texto aunque cambien los datos: revisala si cambiás algo después.',
        'Separá los párrafos con una línea en blanco. Los títulos de apartado empiezan con su número (1.1., 1.2.…).',
        'Las conciliaciones de la transición no se escriben: siempre salen de los ajustes cargados.',
        'Si falta un dato (adopción, categoría o índices), la nota lo avisa arriba.',
        'Con el ejercicio cerrado ya no se modifica (NEG-005).',
      ),
    ],
    relacionados: ['paso-notas', 'nota-transicion', 'coeficiente', 'neg-005'],
  },
  {
    id: 'nota-transicion',
    titulo: 'Nota de transición a la RT 54 (primera aplicación)',
    categoria: 'pasos',
    resumen:
      'Cómo cargar los ajustes de la primera aplicación de la RT 54 y cómo se reflejan en el E.E.P.N. y en el balance.',
    claves: [
      'nota de transicion',
      'primera aplicacion',
      'primera adopcion',
      'ajustes de medicion',
      'reclasificaciones',
      'conciliacion del patrimonio neto',
      'modificacion de saldos al inicio',
      'nota 1.6',
    ],
    bloques: [
      p(
        'Corresponde solo si en "Configurar Nota I" elegiste primera adopción de la RT 54 (si no, NEG-040).',
      ),
      defs(
        [
          'Ajuste de medición',
          'Cambia el patrimonio neto al inicio y/o el resultado del año anterior. Indicás a qué componente del patrimonio neto va (capital, ajuste de capital, aportes, reserva legal, otras reservas o resultados no asignados) y los importes.',
        ],
        [
          'Reclasificación',
          'Solo cambia la exposición: mueve un importe de un rubro a otro, sin efecto en el patrimonio neto.',
        ],
      ),
      lista(
        'Hay plantillas con las partidas más habituales; elegís cuáles corresponden y con qué importes.',
        'Va dentro de la Nota 1: su texto en el apartado de adopción de la RT 54 y sus conciliaciones (patrimonio neto al inicio y resultado del año anterior) en un apartado propio.',
        'La fila "Modificación de saldos al inicio" del E.E.P.N. acompaña sola a los ajustes de medición. Si la cambiaste a mano (por ejemplo, para incluir la corrección de un error), no se toca y la compuerta avisa la diferencia (AUT-040).',
        'Para que salga en el balance, aceptala en "Anexos y notas". Si no la aceptás, la Nota 1 no la incluye.',
      ),
      aviso(
        'La nota es un borrador armado con los ajustes: revisala y completala antes de emitir.',
      ),
    ],
    relacionados: ['nota-uno', 'paso-notas', 'paso-patrimonio-neto', 'aut-040', 'neg-040'],
  },
  {
    id: 'paso-patrimonio-neto',
    titulo: 'Evolución del patrimonio neto (E.E.P.N.)',
    categoria: 'pasos',
    paso: 'patrimonio-neto',
    resumen: 'Cómo se carga cada fila del E.E.P.N., qué viene solo y cómo se confirma.',
    claves: [
      'eepn',
      'evolucion del patrimonio neto',
      'saldos al inicio',
      'ajuste por inflacion',
      'distribucion',
      'dividendos',
      'reserva legal',
      'honorarios',
      'aportes irrevocables',
      'confirmar eepn',
      'resultado del ejercicio',
    ],
    bloques: [
      defs(
        ['Saldos al inicio', 'Vinculado: el cierre del anterior, con candado. Si no, se cargan.'],
        ['Ajuste por inflación', 'La reexpresión de los saldos al inicio, si corresponde.'],
        [
          'Modificación de saldos al inicio',
          'Primera aplicación de la RT 54: acompaña a los ajustes de la nota de transición.',
        ],
        [
          'Distribuciones',
          'Honorarios, dividendos, reserva legal, otras reservas y aportes irrevocables, por columna.',
        ],
        ['Resultado del ejercicio', 'Viene del Estado de Resultados: no se carga.'],
      ),
      pasos(
        '"Editar", cargá los movimientos y "Guardar".',
        'Revisá que el total al cierre coincida con el patrimonio neto del balance.',
        '"Confirmar E.E.P.N."',
      ),
      lista(
        'Anterior cargado a mano: la columna "Ejercicio anterior" se carga fila por fila, salvo el resultado, que sale del Estado de Resultados anterior.',
        'Cada columna (capital, reservas, resultados no asignados…) tiene que terminar igual que sus cuentas en el balance.',
        'Sin el E.E.P.N. confirmado el ejercicio no pasa a Revisión (NEG-004).',
      ),
    ],
    relacionados: ['nota-transicion', 'estados-ejercicio', 'aut-012'],
  },
  {
    id: 'paso-estados',
    titulo: 'Estados contables',
    categoria: 'pasos',
    paso: 'estados',
    resumen:
      'El Estado de Situación Patrimonial, el de Resultados y el de Flujo de Efectivo, y cómo se confirman.',
    claves: [
      'estados contables',
      'ssp',
      'eerr',
      'situacion patrimonial',
      'estado de resultados',
      'confirmar estados',
      'balance cuadrado',
      'activo',
      'pasivo',
    ],
    bloques: [
      p(
        'Los estados se arman solos con las cuentas clasificadas y los anexos. Cada rubro muestra el saldo actual y, si hay comparativo, el del año anterior.',
      ),
      lista(
        'Situación patrimonial: Activo, Pasivo y Patrimonio Neto, corrientes y no corrientes. El Patrimonio Neto es el total del E.E.P.N.',
        'Resultados: ingresos, costo de ventas (del Anexo II), gastos por sección (del Anexo III), resultados financieros e impuesto a las ganancias.',
        'Anterior cargado a mano: en el estado solo se escriben los rubros sin nota ni anexo ("Editar" en la columna anterior). Los rubros con nota muestran el total de la nota con candado; los gastos salen del Anexo III; el costo de ventas, del Anexo II.',
        '"Confirmar estados" pasa por la compuerta de autorización: si algo no cuadra, te dice qué y dónde corregirlo.',
      ),
    ],
    relacionados: ['flujo-efectivo', 'compuerta', 'pregunta-no-cuadra'],
  },
  {
    id: 'flujo-efectivo',
    titulo: 'Estado de Flujo de Efectivo',
    categoria: 'pasos',
    resumen:
      'Cómo se arma el flujo por el método directo: la propuesta desde el balance, el RECPAM que calcula la app y su revisión.',
    claves: [
      'flujo de efectivo',
      'efe',
      'metodo directo',
      'actividades operativas',
      'actividades de inversion',
      'actividades de financiacion',
      'efectivo al inicio',
      'efectivo al cierre',
      'traer conceptos',
      'recpam',
      'resultados financieros y por tenencia',
      'proponer desde el balance',
      'pagos a proveedores',
      'variacion de activos',
      'variacion de pasivos',
      'prestamos',
      'impuesto a las ganancias pagado',
    ],
    bloques: [
      p('Está en Estados → Flujo de efectivo. Es un estado básico obligatorio (AUT-052).'),
      pasos(
        'Tocá "Proponer desde el balance": la app arma las líneas con lo que ya tiene y muestra de dónde sale cada una (tocá la línea para ver el detalle).',
        'En "Gastos del Anexo III", revisá qué es cada gasto: proveedores, personal, impuestos o algo que no es un pago (amortizaciones, previsiones). La app lo sugiere por el nombre de la cuenta.',
        'En "Rubros corrientes de las variaciones", revisá qué rubros entran.',
        'Cargá lo que la app no puede ver: el impuesto a las ganancias pagado en el año y los préstamos recibidos y devueltos.',
        'Tocá "Usar esta propuesta". Podés corregir cualquier línea con "Editar" o agregar las que falten.',
        'Revisá el RECPAM y, si está bien, tocá "Revisado".',
      ),
      p('De dónde sale cada línea que propone la app:'),
      lista(
        'Cobros por ventas: los ingresos del Estado de Resultados.',
        'Pagos a proveedores: las compras del Anexo II más los gastos del Anexo III, menos los de personal, los impuestos y lo que no es un pago.',
        'Pagos al personal y pagos de impuestos: esos gastos del Anexo III.',
        'Variación de activos y de pasivos: los rubros corrientes, el actual contra el anterior ajustado. Si el activo aumenta, resta; si baja, suma. Si el pasivo aumenta, suma; si baja, resta. Quedan afuera caja y bancos (es el efectivo), los bienes de cambio (ya están en las compras), las inversiones y los préstamos.',
        'Impuesto a las ganancias: lo pagado que cargás vos. Para no contarlo dos veces, a la variación de los pasivos se le resta la del impuesto (devengado menos pagado).',
        'Bienes de uso: con el valor de origen del Anexo I, las bajas suman y las altas restan.',
        'Aportes de los propietarios: en el primer ejercicio, el capital y los aportes del saldo al inicio del E.E.P.N.',
        'Préstamos: lo recibido suma y lo devuelto resta. El balance de sumas y saldos no tiene los movimientos, por eso los cargás vos; la app te muestra cómo cambió el saldo.',
      ),
      p('El RECPAM y su revisión:'),
      lista(
        'La línea "Resultados financieros y por tenencia generados por el efectivo (incluye RECPAM)" la calcula la app: es la diferencia entre la variación del efectivo y las demás líneas, para que el estado cierre. No se edita ni se borra (NEG-070).',
        'Como es una diferencia, puede esconder un error de otra línea. Por eso queda "Pendiente de revisión" hasta que el dueño o un contador toque "Revisado" (un asistente no puede).',
        'Si después cambia algo (una línea o el balance), vuelve a quedar pendiente. Con el RECPAM pendiente no se pueden confirmar los estados (AUT-053).',
        'Si el RECPAM da cero, las demás líneas explican toda la variación del efectivo y no hay nada que revisar.',
      ),
      p('El efectivo y el comparativo:'),
      lista(
        'El efectivo al cierre sale del Estado de Situación Patrimonial (rubros de efectivo, como Caja y bancos): no se carga.',
        'El efectivo al inicio es el del cierre del ejercicio anterior, ajustado a moneda de cierre (sin volver a ajustarlo). Solo en el primer ejercicio se escribe.',
        'Un concepto no se puede repetir en la misma actividad (NEG-050).',
        'Anterior vinculado: la columna anterior sale del flujo del anterior; con "Traer los conceptos del año anterior" se agregan sus líneas (NEG-051 si no está vinculado).',
        'Anterior cargado a mano: cargás el importe anterior de cada concepto y el efectivo al inicio del año anterior.',
        'Si el flujo no tiene línea de RECPAM, la compuerta exige que cuadre (AUT-050). Avisa si no cuadra la columna anterior (AUT-051).',
      ),
    ],
    relacionados: ['paso-estados', 'aut-053', 'aut-050', 'aut-052'],
  },
  {
    id: 'imprimir',
    titulo: 'Imprimir el balance o guardarlo en PDF',
    categoria: 'pasos',
    resumen: 'Cómo se obtiene el documento completo del balance y qué incluye.',
    claves: ['imprimir', 'pdf', 'exportar', 'documento', 'descargar', 'borrador', 'marca de agua'],
    bloques: [
      pasos(
        'Desde cualquier paso del ejercicio, "Imprimir / PDF" (arriba a la derecha).',
        'Se abre el documento en una pestaña nueva.',
        'Usá Imprimir del navegador y elegí "Guardar como PDF" para obtener el archivo.',
      ),
      lista(
        'Incluye carátula, Situación patrimonial, Resultados, E.E.P.N., Flujo de efectivo, los anexos aceptados y las notas aceptadas.',
        'Mientras falte algo sale marcado como BORRADOR y te dice qué falta.',
        'Lo que no aceptaste en "Anexos y notas" no sale.',
        'La Nota 1 sale como en el paso Notas: la generada o la que escribió el contador.',
        'El informe del auditor y la Memoria todavía figuran como pendientes: están en desarrollo.',
      ),
    ],
    relacionados: ['paso-documentos', 'en-desarrollo'],
  },
]
