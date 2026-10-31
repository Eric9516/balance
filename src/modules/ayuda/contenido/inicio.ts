import type { ArticuloAyuda } from '../domain/tipos'
import { aviso, defs, lista, p, pasos } from './bloques'

export const INICIO: ArticuloAyuda[] = [
  {
    id: 'entrar',
    titulo: 'Entrar a BalanceRT',
    categoria: 'inicio',
    resumen:
      'Cada persona entra con su correo y su contraseña, y ve solo los datos de su estudio. Cómo funciona la sesión y qué hacer si te olvidaste la contraseña.',
    claves: [
      'entrar',
      'login',
      'iniciar sesion',
      'contraseña',
      'clave',
      'recordar este equipo',
      'salir',
      'cerrar sesion',
    ],
    bloques: [
      p(
        'Cada cuenta es de un solo estudio: al entrar, la app ya sabe de qué estudio sos y te muestra solo lo suyo. Si trabajás para dos estudios, necesitás una cuenta en cada uno, con correos distintos.',
      ),
      defs(
        [
          'Sesión',
          'Queda abierta mientras uses la app y se cierra sola a las 8 horas sin uso o al cerrar el navegador.',
        ],
        [
          'Recordar este equipo',
          'La sesión dura 30 días en esa computadora o celular. No lo marques en un equipo compartido.',
        ],
        [
          'Salir',
          'El botón está abajo de todo en la barra lateral, junto a tu nombre y tu rol. Cierra la sesión en ese equipo.',
        ],
      ),
      lista(
        '¿Te olvidaste la contraseña? Pedile una provisoria al dueño de tu estudio. Si sos el dueño, pedísela al administrador de BalanceRT.',
        'Después de 5 intentos fallidos seguidos con el mismo correo, la entrada se frena 15 minutos.',
        'Si la app dice que tu cuenta está desactivada, pedile al dueño de tu estudio que la active.',
      ),
    ],
    relacionados: ['nueva-contrasena', 'codigo-celular', 'auth-002', 'auth-003', 'auth-004'],
  },
  {
    id: 'nueva-contrasena',
    titulo: 'Elegir tu contraseña',
    categoria: 'inicio',
    resumen:
      'Si entraste con una contraseña provisoria, la app te pide que elijas la tuya antes de seguir.',
    claves: ['contraseña provisoria', 'cambiar contraseña', 'nueva contraseña', 'clave'],
    bloques: [
      p(
        'Una contraseña provisoria es la que te dio otra persona (el dueño del estudio o el administrador de BalanceRT). Para que solo vos la sepas, la app te pide una nueva la primera vez que entrás.',
      ),
      lista(
        'Tiene que tener al menos 12 caracteres. No hace falta que tenga mayúsculas, números ni signos: lo que la hace segura es el largo.',
        'Lo más seguro es una frase que puedas recordar, por ejemplo "el mate de las cinco".',
        'Al guardarla se cierran tus sesiones en otros equipos; en este seguís adentro. Si sos dueño, después configurás el código del celular.',
      ),
    ],
    relacionados: ['entrar'],
  },
  {
    id: 'mi-cuenta',
    titulo: 'Mi cuenta: tu nombre y tu contraseña',
    categoria: 'inicio',
    resumen:
      'Cada persona cambia ahí su nombre y su contraseña, y puede cerrar la sesión que dejó abierta en otro equipo.',
    claves: [
      'mi cuenta',
      'cambiar contraseña',
      'cambiar nombre',
      'mis datos',
      'perfil',
      'cerrar sesion en otros equipos',
    ],
    bloques: [
      p(
        'Se entra tocando tu nombre, abajo de todo en la barra lateral. Cualquier rol la puede usar: cada uno ve y cambia solo lo suyo.',
      ),
      defs(
        [
          'Tus datos',
          'El nombre se cambia ahí. El correo y el rol los maneja el dueño del estudio.',
        ],
        [
          'Contraseña',
          'Para cambiarla, la app pide la actual: así nadie la cambia si dejás la computadora abierta. Al guardarla se cierra tu sesión en los demás equipos; en este seguís adentro.',
        ],
        [
          'Otros equipos',
          'Si entraste desde otra computadora o un celular y no saliste, "Cerrar en los demás" cierra esas sesiones sin moverte de donde estás.',
        ],
      ),
      lista(
        'Si escribís mal la contraseña actual 5 veces seguidas, se frena 15 minutos, igual que al entrar.',
        '¿No te acordás de la actual? Salí y pedile una provisoria al dueño de tu estudio.',
      ),
    ],
    relacionados: ['entrar', 'nueva-contrasena', 'roles'],
  },
  {
    id: 'codigo-celular',
    titulo: 'El código del celular',
    categoria: 'inicio',
    resumen:
      'Un segundo paso al entrar: además de la contraseña, el número de 6 cifras que muestra la app de tu celular. Cuando la plataforma lo activa, es obligatorio para los dueños.',
    claves: [
      'codigo',
      'celular',
      'autenticador',
      'google authenticator',
      'microsoft authenticator',
      'doble factor',
      'segundo paso',
      'qr',
    ],
    bloques: [
      p(
        'Aunque alguien robe o adivine una contraseña, no puede entrar sin el celular de su dueño. El dueño puede hacer todo en su estudio, por eso, cuando la plataforma lo activa, lo usa siempre. Por ahora está apagado.',
      ),
      pasos(
        'Instalá Google Authenticator o Microsoft Authenticator (gratis) en tu celular.',
        'La primera vez que entrás, BalanceRT muestra un código QR: escanealo con la app. Si no podés, escribí a mano la clave que aparece abajo.',
        'Escribí el número de 6 cifras que muestra la app. Cambia cada 30 segundos.',
        'Las próximas veces, después de la contraseña la app te pide ese número.',
      ),
      lista(
        'Con "recordar este equipo", el código se pide una vez cada 30 días en esa computadora.',
        'Si los códigos no coinciden, revisá que la hora del celular esté en automático.',
        'Si perdiste o cambiaste el celular, pedile al dueño de tu estudio que te quite el código (Configuración → Usuarios): la próxima vez que entres lo configurás de nuevo. Si sos el dueño, pedíselo a otro dueño o al administrador de BalanceRT.',
      ),
    ],
    relacionados: ['entrar', 'auth-005', 'auth-006'],
  },
  {
    id: 'como-funciona',
    titulo: 'Cómo se hace un balance en BalanceRT',
    categoria: 'inicio',
    resumen:
      'El recorrido completo, del alta de la sociedad al balance cerrado, en el orden en que conviene hacerlo.',
    claves: [
      'empezar',
      'primeros pasos',
      'orden de los pasos',
      'por donde empiezo',
      'guia',
      'flujo de trabajo',
      'tutorial',
    ],
    bloques: [
      pasos(
        'Cargá los datos del estudio (Configuración → Estudio) y al menos un auditor (Auditores).',
        'Registrá la sociedad (Sociedades → Nueva sociedad).',
        'Desde la sociedad, creá el ejercicio: fechas, número, auditor, categoría del ente, índices de inflación y cómo se resuelve el ejercicio anterior.',
        'Importá el balance de sumas y saldos desde Excel o cargalo a mano.',
        'Clasificá todas las cuentas en su rubro.',
        'Resolvé el ejercicio anterior: vinculalo a uno cargado, cargalo a mano y autorizalo, o declaralo primer ejercicio.',
        'En "Anexos y notas", aceptá o descartá lo que la app sugiere según los saldos.',
        'Completá los anexos aceptados: Bienes de uso, Costo de ventas y Gastos.',
        'Generá las notas y respondé "Configurar Nota I": la Nota 1 se arma sola y la podés editar. Si es la primera aplicación de la RT 54, cargá los ajustes de transición.',
        'Completá la Evolución del patrimonio neto y confirmala.',
        'Revisá los estados (Situación patrimonial, Resultados y Flujo de efectivo) y confirmalos.',
        'Pasá el ejercicio a Revisión, revisá el documento imprimible y cerralo.',
      ),
      aviso(
        'Cada pantalla tiene un botón (i) arriba a la derecha: resume de dónde salen los datos, qué calcula y qué tener en cuenta, y lleva al artículo completo de esta ayuda.',
      ),
      lista(
        'La barra de progreso del ejercicio muestra en qué paso estás y qué falta.',
        'Nada se redondea: los cálculos usan el importe completo y la pantalla lo muestra con 2 decimales, cortados.',
        'La app propone y controla; las decisiones contables son siempre del contador.',
      ),
    ],
    relacionados: ['paso-ejercicios', 'estados-ejercicio', 'paso-anterior', 'buscar-en-la-ayuda'],
  },
  {
    id: 'paso-ejercicios',
    titulo: 'Lista de ejercicios de una sociedad',
    categoria: 'inicio',
    paso: 'ejercicios',
    resumen:
      'Dónde se crean los ejercicios, se ve su estado y cómo se resuelve su ejercicio anterior, y se pasan a Revisión o Cerrado.',
    claves: ['ejercicios', 'periodos', 'lista de ejercicios', 'nuevo ejercicio', 'chip ambar'],
    bloques: [
      p(
        'Se llega desde Sociedades → la sociedad → Ejercicios. Cada fila es un ejercicio contable.',
      ),
      lista(
        'El chip de cada fila dice cómo se resuelve su ejercicio anterior. En ámbar: todavía no se definió.',
        'Los ejercicios vinculados entre sí aparecen conectados.',
        'Desde cada fila se abre el ejercicio, se edita y se cambia su estado (Borrador, En proceso, Revisión, Cerrado).',
      ),
    ],
    relacionados: ['crear-ejercicio', 'estados-ejercicio'],
  },
  {
    id: 'sociedades',
    titulo: 'Registrar y editar una sociedad',
    categoria: 'inicio',
    resumen:
      'Cómo dar de alta al cliente del estudio y qué datos se usan en la carátula y en los controles del balance.',
    claves: [
      'nueva sociedad',
      'alta de cliente',
      'empresa',
      'cuit',
      'razon social',
      'sas',
      'srl',
      'sa',
      'composicion del capital',
      'inscripcion',
      'matricula',
      'categoria del ente',
    ],
    bloques: [
      pasos('Entrá a Sociedades y hacé clic en "Nueva sociedad".', 'Completá los datos y guardá.'),
      defs(
        [
          'Obligatorios',
          'Razón social, CUIT, tipo de persona, domicilio legal, localidad, provincia, código postal, actividad principal, categoría del ente según RT 54, fecha de inscripción, matrícula y plazo de duración.',
        ],
        ['CUIT', 'Se controla el dígito verificador. Si no es válido, la app no lo acepta.'],
        ['S.A.S.', 'También pide la composición del capital.'],
        [
          'Categoría del ente',
          'Pequeña, mediana o restante, según la RT 54. Define qué exige el balance.',
        ],
        [
          'Fecha de inscripción',
          'Se usa para controlar el "primer ejercicio": si la sociedad se inscribió más de un año antes del inicio del ejercicio, la app avisa (AUT-030).',
        ],
      ),
      lista(
        'Estos datos van a la carátula y al encabezado del documento: para corregirlos, editá la sociedad.',
        'Una sociedad desactivada no aparece en las listas, pero conserva todos sus ejercicios.',
      ),
    ],
    relacionados: ['crear-ejercicio', 'aut-030'],
  },
  {
    id: 'auditores',
    titulo: 'Auditores y firmantes',
    categoria: 'inicio',
    resumen: 'Quién firma los estados contables y cómo se elige el auditor de cada ejercicio.',
    claves: [
      'auditor',
      'contador',
      'firmante',
      'matricula',
      'consejo profesional',
      'pie de firma',
      'predeterminado',
      'informe del auditor',
    ],
    bloques: [
      pasos(
        'Entrá a Auditores y hacé clic en "Nuevo auditor".',
        'Cargá nombre, apellido y los datos del pie de firma.',
        'Guardá.',
      ),
      lista(
        'Título profesional, matrícula, consejo profesional y universidad se usan en la firma.',
        'La localidad del informe y el texto de firma se usan en el documento.',
        'El auditor marcado como predeterminado se propone al crear cada ejercicio; se puede elegir otro.',
        'La fecha del informe se carga en cada ejercicio y se repite igual en todo el documento.',
      ),
    ],
    relacionados: ['crear-ejercicio'],
  },
  {
    id: 'estudio',
    titulo: 'Datos y apariencia del estudio',
    categoria: 'configuracion',
    resumen: 'Nombre, CUIT y tipo del estudio contable, y el color de la app.',
    claves: [
      'configuracion',
      'estudio',
      'nombre comercial',
      'apariencia',
      'color',
      'marca',
      'preferencias',
    ],
    bloques: [
      p(
        'Configuración → Estudio. Arriba, los datos del estudio (nombre comercial, CUIT y tipo de estudio). Abajo, la apariencia.',
      ),
      lista(
        'Podés elegir el color principal de la app.',
        'Si el color es muy claro, la app lo rechaza y te dice el contraste: el texto blanco encima tiene que leerse bien. Elegí un tono más oscuro.',
      ),
    ],
  },
  {
    id: 'usuarios',
    titulo: 'La gente del estudio (usuarios)',
    categoria: 'configuracion',
    resumen:
      'El dueño agrega a cada persona con su rol, le da una contraseña provisoria y puede desactivar o eliminar su cuenta.',
    claves: [
      'usuarios',
      'agregar persona',
      'nuevo usuario',
      'empleado',
      'contraseña provisoria',
      'desactivar',
      'eliminar usuario',
      'olvide la contraseña',
      'perdi el celular',
    ],
    bloques: [
      p(
        'Configuración → Usuarios. Solo la ve el dueño del estudio. Cada persona tiene su propia cuenta: así se sabe quién hizo cada cosa y cada uno ve solo lo que su rol le permite.',
      ),
      pasos(
        'Tocá "Agregar persona" y escribí su nombre, su correo y su rol.',
        'La app crea una contraseña provisoria y te la muestra una sola vez. Pasásela por un medio privado: en persona, por teléfono o por mensaje.',
        'Al entrar por primera vez, la persona elige su propia contraseña. Hasta entonces, en la lista figura "Con contraseña provisoria".',
      ),
      defs(
        [
          'Rol',
          'Se cambia en la misma lista. Antes de confirmarlo, la app te dice qué va a poder hacer.',
        ],
        [
          'Contraseña provisoria nueva',
          'Para quien se olvidó la suya. Se le cierran las sesiones abiertas y la próxima vez que entra elige una nueva.',
        ],
        [
          'Quitar el código del celular',
          'Aparece si la persona configuró el código. Es para quien cambió o perdió el celular: la próxima vez que entra lo configura de nuevo.',
        ],
        [
          'Desactivar',
          'La persona deja de poder entrar al instante, aunque tenga la app abierta. Lo que cargó queda igual, y podés reactivar su cuenta cuando quieras.',
        ],
        [
          'Eliminar',
          'Borra la cuenta. Lo que cargó en los balances queda igual. Si solo querés que no entre por un tiempo, mejor desactivá su cuenta.',
        ],
      ),
      aviso(
        'Nadie se cambia el rol, se desactiva ni se elimina a sí mismo: lo hace otro dueño. A un dueño no se lo elimina: primero se le cambia el rol. Así el estudio nunca queda sin dueño. La base de datos lo controla también, no solo la pantalla.',
      ),
      lista(
        'Cada correo es de un solo estudio. Si la app dice que ya hay una cuenta con ese correo, la persona tiene que usar otro.',
        'Tu propia cuenta (nombre y contraseña) se maneja en Mi cuenta.',
      ),
    ],
    relacionados: ['roles', 'mi-cuenta', 'entrar', 'codigo-celular'],
  },
  {
    id: 'roles',
    titulo: 'Qué puede hacer cada rol',
    categoria: 'configuracion',
    resumen:
      'Dueño, contador y asistente: quién carga, quién confirma y cierra, y quién maneja el estudio y su gente.',
    claves: [
      'roles',
      'permisos',
      'dueño',
      'contador',
      'asistente',
      'quien puede',
      'no me deja',
      'confirmar',
      'cerrar balance',
    ],
    bloques: [
      defs(
        [
          'Asistente',
          'Carga datos: crea sociedades y ejercicios, importa el balance de sumas y saldos, clasifica cuentas y completa anexos, notas y la columna del ejercicio anterior. No confirma, no autoriza el comparativo, no pasa a revisión ni cierra, y no elimina ejercicios.',
        ],
        [
          'Contador',
          'Todo lo del asistente, y además confirma los estados y el E.E.P.N., autoriza el comparativo, pasa el ejercicio a revisión, lo cierra y lo elimina. También configura auditores, clasificaciones y secciones de gastos.',
        ],
        [
          'Dueño',
          'Todo lo del contador, y además maneja a la gente del estudio (Configuración → Usuarios) y los datos y la apariencia del estudio.',
        ],
      ),
      p(
        'La app muestra a cada uno solo lo que puede usar. Si alguien intenta algo que su rol no permite, la app le dice quién lo hace (AUTH-007). La base de datos controla los mismos permisos: aunque alguien saltee la pantalla, no puede hacerlo.',
      ),
      lista(
        'Un asistente puede desconfirmar lo que cambió, para que lo revise el contador.',
        'El rol de cada persona lo cambia el dueño en Configuración → Usuarios.',
      ),
    ],
    relacionados: ['usuarios', 'mi-cuenta', 'auth-007'],
  },
  {
    id: 'crear-ejercicio',
    titulo: 'Crear y editar un ejercicio',
    categoria: 'inicio',
    resumen:
      'Qué datos pide un ejercicio contable, cómo se calcula el coeficiente y cómo se elige el ejercicio anterior.',
    claves: [
      'nuevo ejercicio',
      'crear ejercicio',
      'editar ejercicio',
      'fechas',
      'numero de ejercicio',
      'denominacion',
      'indices',
      'fecha del informe',
      'eliminar ejercicio',
      'borrar ejercicio',
    ],
    bloques: [
      pasos(
        'Desde la sociedad, entrá a Ejercicios y hacé clic en "Nuevo ejercicio".',
        'Completá fecha de inicio y de cierre, número de ejercicio, auditor y fecha del informe.',
        'Elegí la categoría del ente según la RT 54.',
        'Cargá el índice de inflación al cierre del ejercicio anterior y al cierre de este.',
        'Respondé cómo se resuelve el ejercicio anterior: vinculado a uno cargado, carga manual o primer ejercicio.',
        'Guardá.',
      ),
      defs(
        ['Denominación', 'Si la dejás vacía se arma sola: "Ejercicio al DD/MM/AAAA".'],
        [
          'Coeficiente',
          'Índice actual ÷ índice anterior. Se muestra con 8 decimales, cortados sin redondear, y se calcula siempre con el valor completo.',
        ],
        [
          'Ejercicio anterior',
          'Vinculado: elegís un ejercicio de la misma sociedad ya cargado. Carga manual: cargás vos los importes del año anterior. Primer ejercicio: no hay comparativo.',
        ],
      ),
      lista(
        'Para corregir algo: "Editar ejercicio".',
        'Un ejercicio solo se puede eliminar en Borrador y si ningún otro lo usa como anterior (NEG-002, NEG-003).',
      ),
    ],
    relacionados: ['coeficiente', 'paso-anterior', 'cambiar-modo', 'estados-ejercicio'],
  },
  {
    id: 'estados-ejercicio',
    titulo: 'Borrador, En proceso, Revisión y Cerrado',
    categoria: 'inicio',
    resumen:
      'Qué significa cada estado del ejercicio, qué hace falta para avanzar y qué no se puede hacer después de cerrar.',
    claves: [
      'estado del ejercicio',
      'iniciar',
      'pasar a revision',
      'cerrar ejercicio',
      'volver a en proceso',
      'reabrir',
      'no me deja cerrar',
      'no puedo pasar a revision',
    ],
    bloques: [
      defs(
        [
          'Borrador',
          'Recién creado. Todavía no se trabaja en firme y es el único estado en que se puede eliminar.',
        ],
        ['En proceso', 'Se carga y se controla el balance.'],
        [
          'Revisión',
          'El balance está listo para revisarlo. Si aparece un error, se vuelve a En proceso.',
        ],
        ['Cerrado', 'Aprobado y firmado. No se modifica ni se reabre desde la app.'],
      ),
      pasos(
        'Borrador → En proceso: "Iniciar".',
        'En proceso → Revisión: hace falta tener confirmados los estados y el E.E.P.N., y que la compuerta de autorización no tenga bloqueos.',
        'Revisión → Cerrado: lo mismo, revisado de nuevo. También se puede volver a En proceso.',
      ),
      aviso(
        'Antes de cerrar revisá todo: un ejercicio cerrado no se modifica. Si un ejercicio se vincula a este como anterior, va a usar sus números tal como quedaron.',
      ),
      lista(
        'Si cambiás algo que afecta los estados (por ejemplo el Anexo II o un ajuste de transición), la confirmación se anula y hay que volver a confirmar.',
        'El ejercicio siguiente, si se vincula a este, exige que no esté en Borrador (AUT-021) y que tenga confirmados los estados y el E.E.P.N. (AUT-022).',
      ),
    ],
    relacionados: ['neg-004', 'neg-030', 'paso-estados', 'paso-patrimonio-neto'],
  },
  {
    id: 'clasificaciones',
    titulo: 'Clasificaciones RT 54 y secciones',
    categoria: 'configuracion',
    resumen:
      'El catálogo de rubros donde se clasifican las cuentas, y las secciones con que se agrupan (por ejemplo, secciones de gastos propias).',
    claves: [
      'rubros',
      'catalogo',
      'clasificaciones rt 54',
      'nueva clasificacion',
      'nueva seccion',
      'sigla',
      'gestionar clasificaciones',
      'plan de cuentas',
    ],
    bloques: [
      p(
        'Menú → Clasificaciones RT 54. También desde "Clasificar cuentas" → "Gestionar clasificaciones".',
      ),
      defs(
        [
          'Clasificación (rubro)',
          'Dónde va una cuenta: Caja y bancos, Créditos por ventas, Deudas fiscales, Ventas, Gastos de administración… Cada una dice a qué estado va (Situación patrimonial, Resultados o Patrimonio neto), en qué sección y si su saldo normal es deudor o acreedor.',
        ],
        [
          'Sección',
          'Agrupador con nombre y sigla libres, definido por el contador (por ejemplo "Gastos operativos / GTO"). Si se marca como gasto, aparece como línea en el Estado de Resultados y como columna en el Anexo III.',
        ],
      ),
      lista(
        'El catálogo trae los rubros de la RT 54 y es de tu estudio: podés agregar clasificaciones y secciones propias o cambiar las que trae. Lo que cambies se ve en todos los ejercicios de tu estudio y en ningún otro estudio.',
        'Algunos rubros disparan anexos o notas: por ejemplo, Bienes de uso sugiere el Anexo I y Bienes de cambio la nota de bienes de cambio.',
        'Caja y bancos (y los rubros marcados como efectivo) son los que usa el Estado de Flujo de Efectivo.',
        'Ejemplo: la sección "Gastos operativos / GTO", marcada como gasto, con las clasificaciones Sueldos y Alquileres, da una línea "Gastos operativos" en el Estado de Resultados y una columna GTO en el Anexo III.',
        'Una sección de gastos que no tiene que salir en el Estado de Resultados (por ejemplo, gastos vinculados al costo) se configura en el Anexo III.',
      ),
    ],
    relacionados: ['paso-clasificar', 'secciones-gasto'],
  },
  {
    id: 'secciones-gasto',
    titulo: 'Secciones de gastos del Anexo III',
    categoria: 'configuracion',
    resumen:
      'Cómo se elige qué secciones de gastos aparecen en el Estado de Resultados y en qué orden.',
    claves: [
      'configurar anexo iii',
      'secciones de gasto',
      'orden de los gastos',
      'ocultar seccion',
      'columnas del anexo',
    ],
    bloques: [
      p(
        'En el Anexo III, la configuración de secciones permite mostrar u ocultar cada sección en el Estado de Resultados y cambiar su orden. Sirve para las secciones de la RT 54 y para las propias.',
      ),
      lista(
        'Cada sección con gastos es una columna del Anexo III y una línea del Estado de Resultados.',
        'El total de cada sección del Estado de Resultados es el total de su columna en el Anexo III.',
      ),
    ],
    relacionados: ['paso-gastos', 'clasificaciones'],
  },
]
