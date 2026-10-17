import {
  Building2,
  Users,
  FileText,
  Upload,
  Tags,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Workflow,
  FolderOpen,
  Tag,
  ArrowRight,
} from 'lucide-react'

export const metadata = { title: 'Ayuda — BalanceRT' }

interface StepProps {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  details?: string[]
  pending?: boolean
  warning?: string
}

function Step({ number, icon, title, description, details, pending, warning }: StepProps) {
  return (
    <div className={`flex gap-5 ${pending ? 'opacity-50' : ''}`}>
      <div className="flex flex-col items-center">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
            pending
              ? 'border-slate-200 bg-white text-slate-400'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {pending ? <Clock className="h-4 w-4" /> : number}
        </div>
        <div className="mt-2 w-px flex-1 bg-slate-200" />
      </div>

      <div className="pb-8">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center ${pending ? 'text-slate-400' : 'text-blue-600'}`}
          >
            {icon}
          </span>
          <h3
            className={`text-base font-semibold ${pending ? 'text-slate-400' : 'text-slate-900'}`}
          >
            {title}
            {pending && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-400">
                Próximamente
              </span>
            )}
          </h3>
        </div>
        <p
          className={`mb-2 text-sm leading-relaxed ${pending ? 'text-slate-400' : 'text-slate-600'}`}
        >
          {description}
        </p>
        {details && details.length > 0 && (
          <ul className="mt-2 space-y-1">
            {details.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
        {warning && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AyudaPage() {
  return (
    <div className="max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Guía de uso</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          BalanceRT te ayuda a preparar los estados contables bajo{' '}
          <strong className="text-slate-700">Resolución Técnica N.° 54</strong> (FACPCE). Seguí este
          flujo paso a paso para cada ejercicio.
        </p>
      </div>

      {/* Estados del ejercicio */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Estados del ejercicio</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Cada ejercicio pasa por estos estados. El botón de avance aparece en la lista de
          ejercicios del cliente.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Borrador', desc: 'Recién creado', color: 'bg-slate-100 text-slate-600' },
            { label: '→', desc: '', color: 'text-slate-400' },
            {
              label: 'En proceso',
              desc: 'Se está completando',
              color: 'bg-blue-100 text-blue-700',
            },
            { label: '→', desc: '', color: 'text-slate-400' },
            {
              label: 'En revisión',
              desc: 'Listo para revisar',
              color: 'bg-amber-100 text-amber-700',
            },
            { label: '→', desc: '', color: 'text-slate-400' },
            { label: 'Cerrado', desc: 'Finalizado', color: 'bg-emerald-100 text-emerald-700' },
          ].map((item, i) =>
            item.desc === '' ? (
              <span key={i} className="text-lg font-light text-slate-300">
                →
              </span>
            ) : (
              <div key={i} className="text-center">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${item.color}`}
                >
                  {item.label}
                </span>
                <p className="mt-1 text-[10px] text-slate-400">{item.desc}</p>
              </div>
            ),
          )}
        </div>
        <div className="mt-4 space-y-1.5 text-xs text-slate-500">
          <p>
            <strong className="text-slate-700">Iniciar:</strong> pasa de Borrador a En proceso. A
            partir de aquí podés importar cuentas y trabajar el balance.
          </p>
          <p>
            <strong className="text-slate-700">A revisión:</strong> el balance está listo para que
            el auditor revise antes de firmar. Todavía se puede editar si es necesario.
          </p>
          <p>
            <strong className="text-slate-700">Reabrir:</strong> si en revisión encontrás un error,
            volvé a “En proceso” para corregir y después pasarlo nuevamente a revisión.
          </p>
          <p>
            <strong className="text-slate-700">Cerrar:</strong> balance aprobado y firmado. Una vez
            cerrado no se puede modificar.
          </p>
        </div>
      </div>

      {/* Clasificaciones */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Tags className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Secciones y clasificaciones</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Configuración → Clasificaciones
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          Antes de clasificar cuentas, configurá las secciones que va a usar el estudio. RT 54
          permite definir secciones propias además de las estándar.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">Sección</span>
            </div>
            <p className="text-xs leading-relaxed text-blue-700">
              Agrupador con <strong>nombre y sigla libres</strong> definidos por el contador. Ej:
              “Gastos Operativos / GTO”. Si se marca como <strong>gasto</strong>, aparece en el EERR
              y en el Anexo III automáticamente.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">Clasificación</span>
            </div>
            <p className="text-xs leading-relaxed text-emerald-700">
              El rubro específico al que se asignan las cuentas del balance de sumas y saldos. Va
              dentro de una sección. Ej: “Sueldos y jornales”, “Caja y Bancos”.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
            Sección
          </span>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            Clasificaciones
          </span>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            Cuentas contables
          </span>
        </div>

        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3.5">
          <p className="mb-1 text-xs font-semibold text-amber-800">
            ¿Es un gasto? → EERR + Anexo III automático
          </p>
          <p className="text-xs leading-relaxed text-amber-700">
            Al marcar una sección como gasto, sus clasificaciones generan automáticamente: una{' '}
            <strong>línea en el EERR</strong> con el total y una{' '}
            <strong>columna en el Anexo III</strong> con el detalle por clasificación, calculado
            desde las cuentas ya clasificadas. No hace falta cargar nada a mano.
          </p>
        </div>

        <div className="space-y-1.5 text-xs text-slate-500">
          <p>
            <strong className="text-slate-700">Nueva sección:</strong> Configuración →
            Clasificaciones → “Nueva sección”. Solo pedí nombre, sigla y si es gasto o no.
          </p>
          <p>
            <strong className="text-slate-700">Nueva clasificación:</strong> “Nueva clasificación” o
            el enlace “+ Agregar clasificación” dentro de cada sección.
          </p>
          <p>
            <strong className="text-slate-700">Configurar Anexo III:</strong> En el paso de Gastos
            del ejercicio, usá “Configurar secciones” para activar/desactivar qué secciones aparecen
            en el anexo.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div>
        <Step
          number={1}
          icon={<Building2 className="h-5 w-5" />}
          title="Registrar cliente"
          description="Antes de empezar, registrá la sociedad o persona física que va a ser el cliente del estudio. Cargá la razón social, CUIT, tipo societario, domicilio y todos los datos que van a aparecer en la carátula del balance."
          details={[
            'Accedé a Sociedades y hacé clic en "Nueva sociedad".',
            'Para SA: ingresá el tipo societario, matrícula PJ y plazo de duración.',
            'Para SRL: el tipo societario es "S.R.L." y la matrícula es la del Registro Público.',
            'Una sociedad desactivada no aparece en las listas pero conserva todos sus ejercicios.',
          ]}
        />

        <Step
          number={2}
          icon={<Users className="h-5 w-5" />}
          title="Configurar auditor"
          description="Registrá al contador o auditor que va a firmar los estados contables. La fecha del informe y los datos del contador se replican automáticamente en todos los estados, anexos, notas e informe para evitar inconsistencias."
          details={[
            'Accedé a Auditores y hacé clic en "Nuevo auditor".',
            'Cargá título profesional, matrícula, consejo profesional y universidad para el pie de firma.',
            'Marcá "predeterminado" al auditor que firma la mayoría de los balances.',
            'Podés subir la imagen de la firma digital para que aparezca en cada página del balance.',
          ]}
          warning="Si desactivás un auditor predeterminado, tenés que asignar uno nuevo antes de crear ejercicios."
        />

        <Step
          number={3}
          icon={<FileText className="h-5 w-5" />}
          title="Crear ejercicio (carátula)"
          description="Desde el cliente, creá el ejercicio contable. Este paso arma la carátula del balance: período, número de ejercicio e índices de inflación para el ajuste RT 6."
          details={[
            'Completá la fecha de inicio y cierre del ejercicio.',
            'La denominación se genera automáticamente: "Ejercicio al DD/MM/AAAA".',
            'Ingresá el índice IPC al cierre del ejercicio anterior y del ejercicio actual.',
            'El sistema calcula el coeficiente de ajuste anual (índice actual / índice anterior).',
            'Para vincular el comparativo: el ejercicio anterior tiene que estar cargado en el sistema primero (ver punto siguiente). Una vez cargado, editá este ejercicio y seleccionalo en "Ejercicio anterior / comparativo" — el selector muestra todos los ejercicios de ese mismo cliente.',
            'Desde Cuentas → Carátula podés ver y verificar la carátula completa en cualquier momento.',
          ]}
          warning="El IPC lo publica el INDEC. Usá la serie definida por la FACPCE en la Res. JG N° 539/2018 (nivel general, base diciembre 2016 = 100)."
        />

        <Step
          number={4}
          icon={<FileText className="h-5 w-5" />}
          title="Comparativo del ejercicio anterior"
          description="Para mostrar la columna del año anterior en los estados, el sistema necesita los saldos de ese período. Hay dos caminos según si tenés o no el balance anterior."
          details={[
            'Al crear o editar el ejercicio, aparece la pregunta "¿Contás con datos del período anterior?". Respondé según tu situación.',
            'SÍ tengo el balance anterior disponible: creá el ejercicio anterior en el sistema (ej: N°2), importá su balance, clasificá sus cuentas, y vinculalo desde Editar ejercicio en "Ejercicio anterior / comparativo". El sistema calcula los comparativos automáticamente aplicando el coeficiente de inflación.',
            'NO tengo el balance anterior: en el ejercicio actual aparece el paso "Comparativos" en el stepper. Desde ahí ingresás manualmente los importes del período anterior — podés hacerlo por sección (5 totales del SSP) o por rubro (detalle completo). También podés agregar rubros o gastos que existían antes y ya no existen hoy.',
            'El modo "por sección" es más rápido: Total Activo Corriente, Total Activo No Corriente, Total Pasivo Corriente, Total Pasivo No Corriente y Total Patrimonio Neto.',
            'El modo "por rubro" es más preciso: un importe por cada clasificación usada en el ejercicio actual, más la posibilidad de agregar ítems del período anterior que ya no existen.',
            'Los comparativos manuales se aplican automáticamente al SSP, EERR y Gastos cuando entrás a esas pantallas.',
          ]}
          warning="Si después conseguís el balance anterior y lo importás al sistema, podés cambiar la configuración desde Editar ejercicio — el sistema pedirá confirmación antes de borrar los comparativos manuales que ya ingresaste."
        />

        <Step
          number={5}
          icon={<Upload className="h-5 w-5" />}
          title="Importar balance de sumas y saldos"
          description="Cargá el balance de sumas y saldos desde el sistema contable del cliente (Tango, Bejerman, ContaNet, etc.) en formato Excel, o ingresá las cuentas manualmente si no tenés el archivo."
          details={[
            'Opción Excel: subí el archivo .xlsx, mapeá las columnas (código, nombre, debe, haber) y revisá las filas antes de confirmar.',
            'Opción manual: ingresá las cuentas directamente desde la pantalla de carga manual.',
            'Podés editar, eliminar o agregar filas en el paso de revisión antes de confirmar la importación.',
            'La barra de progreso en la pantalla de cuentas muestra en qué paso del flujo estás.',
            'Si reimportás, se reemplazan todas las cuentas y se pierde la clasificación existente.',
          ]}
          warning="Para el ejercicio anterior, los saldos los sacás del balance anterior impreso. Para el ejercicio actual, del balance de sumas y saldos del sistema contable."
        />

        <Step
          number={6}
          icon={<Tags className="h-5 w-5" />}
          title="Clasificar cuentas"
          description="Asigná cada cuenta contable al rubro del SSP o del EERR que le corresponde según RT 54. Esta clasificación determina dónde aparece cada cuenta en todos los estados y notas."
          details={[
            'Abrí el ejercicio → Cuentas → Clasificar cuentas.',
            'Para cada cuenta, seleccioná el rubro en el desplegable (agrupado por sección).',
            'Usá los filtros: Todas / Sin clasificar / Clasificadas para navegar.',
            'Seleccioná varias cuentas con el checkbox y asignalas en lote con la barra inferior.',
            'Las cuentas patrimoniales van a rubros del SSP; las de resultado, al EERR.',
            'Las cuentas de Patrimonio Neto (capital, reservas) van a los rubros PN.',
            'Las cuentas sin rubro asignado no aparecen en ningún estado. Clasificalas todas antes de emitir el balance.',
          ]}
          warning="Una clasificación incorrecta altera el cuadre del balance y los totales de las notas. Verificá especialmente que ingresos y costos vayan al EERR."
        />

        <Step
          number={7}
          icon={<BookOpen className="h-5 w-5" />}
          title="Notas de composición (Notas II)"
          description="Completá las notas con el detalle de cada rubro del balance. Las notas muestran exactamente de qué está compuesto cada rubro: qué cuentas lo integran y sus importes."
          details={[
            'Abrí el ejercicio → Cuentas → Notas.',
            'Configurá primero los criterios usando el botón "Configurar Nota I" en el encabezado de Notas — determinan qué criterio de medición aparece en cada nota.',
            'Usá "Regenerar desde rubros" para crear o actualizar todas las notas desde las cuentas clasificadas.',
            'Cada nota CUANTITATIVA muestra el criterio de medición, el texto de apertura y el detalle de cuentas con importes actual y anterior.',
            'Bienes de Uso genera una nota de solo texto que remite al Anexo I — no muestra cuentas individuales.',
            'Los gastos no generan notas — van directo al Anexo III y al EERR.',
            'Si borrás una nota, las restantes se renumeran automáticamente.',
            'La nota "Cambios en los Criterios Contables" siempre dice que se mantuvieron los mismos criterios.',
            'El total de cada nota debe coincidir con el saldo del rubro en el SSP o EERR.',
          ]}
          warning="Las notas se generan DESPUÉS de clasificar las cuentas y configurar los criterios. Si reimportás el balance de sumas y saldos, regenerá las notas."
        />

        <Step
          number={8}
          icon={<FileText className="h-5 w-5" />}
          title="Anexos (Bienes de Uso, Costo de Ventas, Gastos)"
          description="Completá los tres anexos del balance. Sus totales se trasladan automáticamente al SSP y al EERR."
          details={[
            'Anexo I — Bienes de Uso: cargá valor de origen, ajuste por inflación, altas, bajas y amortizaciones por categoría. El neto residual se calcula automáticamente. Para editar: hacé clic en el ícono de lápiz de la fila y luego guardá con ✓.',
            'Anexo II — Costo de Ventas: existencia inicial, compras, gastos y existencia final. El costo de mercaderías vendidas se calcula automáticamente y se traslada al EERR y a la Nota de Costo de Ventas. Para editar: hacé clic en "Editar" y luego "Guardar".',
            'Anexo III — Gastos: se genera automáticamente desde las cuentas clasificadas en secciones de gasto (esGasto=true). Las columnas son las secciones activas. No requiere carga manual.',
            'Para agregar una categoría en Bienes de Uso: botón "Agregar categoría" al pie de la tabla.',
            'Los totales del Anexo III se trasladan automáticamente al EERR como líneas de gasto.',
          ]}
          warning="En Bienes de Uso y Costo de Ventas los datos son de solo lectura hasta que hacés clic en Editar. Esto evita modificaciones accidentales."
        />

        <Step
          number={9}
          icon={<BarChart3 className="h-5 w-5" />}
          title="Estados contables (SSP y EERR)"
          description="El SSP y el EERR se generan automáticamente desde las cuentas clasificadas. Incluyen columna comparativa con el ejercicio anterior ajustado por inflación y referencias a notas y anexos."
          details={[
            'Abrí el ejercicio → Cuentas → Estados.',
            'El SSP muestra Activo / Pasivo / PN con sus secciones corriente y no corriente.',
            'El EERR muestra Ingresos − Costo = Utilidad Bruta, luego las líneas de gasto por sección y el resultado final.',
            'Cada rubro muestra el saldo actual y el comparativo del ejercicio anterior ajustado por inflación.',
            'El badge "Balance cuadrado ✓" confirma que Activo = Pasivo + PN.',
          ]}
        />

        <Step
          number={10}
          icon={<FileText className="h-5 w-5" />}
          title="Estado de Evolución del Patrimonio Neto"
          description="Tabla de movimientos del PN: saldo inicio, ajuste por inflación, distribuciones y resultado del ejercicio. El resultado viene automáticamente del EERR."
          pending
        />

        <Step
          number={11}
          icon={<FileText className="h-5 w-5" />}
          title="Estado de Flujo de Efectivo"
          description="Método directo. Muestra los cobros y pagos del período agrupados en actividades operativas, de inversión y de financiación."
          pending
        />

        <Step
          number={12}
          icon={<FileText className="h-5 w-5" />}
          title="Nota I — Bases de preparación y RT 54"
          description="Generación automática del texto completo de la Nota I: unidad de medida, criterios de medición, ajuste por inflación, adopción RT 54 y hechos posteriores al cierre."
          pending
        />

        <Step
          number={13}
          icon={<Users className="h-5 w-5" />}
          title="Informe del Auditor Independiente"
          description="Generado automáticamente desde los datos del auditor, la sociedad y los totales del balance. Solo se modifican las partes variables."
          pending
        />

        <Step
          number={14}
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Validación final y exportación"
          description="Tablero de control que verifica que el balance esté listo: activo = pasivo + PN, resultados coincidentes, efectivo coincidente, notas completas, auditor asignado. Una vez aprobado, exportá en Word editable o PDF."
          pending
        />
      </div>

      {/* Notas técnicas RT 54 */}
      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Notas técnicas — RT 54</h2>
        <ul className="space-y-2">
          {[
            'El ajuste por inflación (RT 6) usa el IPC según FACPCE Res. JG N° 539/2018 — NO el IPIM. El coeficiente = índice IPC al cierre actual / índice IPC al cierre anterior.',
            'El RECPAM (Resultado por Exposición a Cambios en el Poder Adquisitivo) surge del ajuste de las partidas monetarias y se expone en el EERR dentro de Resultados Financieros y por Tenencia.',
            'Todos los estados, anexos y notas deben ser comparativos con el ejercicio anterior ajustado por inflación. Sin la columna comparativa, el balance no está completo.',
            'La clasificación corriente / no corriente sigue el criterio de exigibilidad dentro de los 12 meses posteriores al cierre.',
            'La firma del contador y la fecha del informe deben ser idénticas en todos los estados, notas, anexos e informe del auditor.',
            'El activo debe coincidir con pasivo + PN. El resultado del ejercicio debe coincidir en el EERR, la Evolución del PN y el SSP. El efectivo final del flujo debe coincidir con Caja y Bancos del SSP.',
          ].map((note, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                {i + 1}
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
