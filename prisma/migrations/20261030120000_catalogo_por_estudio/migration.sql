-- Fase 1a, etapa 1 (docs/decisiones/0011): cada estudio con su propio catálogo de clasificaciones.
--
-- Qué resuelve: las clasificaciones (rubros_base), las secciones (rubros_grupo) y la configuración de
-- las secciones de gastos (gasto_seccion_config) eran comunes a todos los estudios, y la app deja
-- crearlas, cambiarlas y borrarlas. Con una sola base, lo que cambiaba un estudio le cambiaba el
-- balance a todos los demás. Decisión del dueño del producto (2026-10-30): cada estudio tiene su
-- propio catálogo.
--
-- Qué hace:
-- 1) catalogo_rubros: el catálogo oficial de la RT 54 (57 clasificaciones). Es de la plataforma, no
--    de un estudio: la app no lo lee ni lo cambia. Una incorporación oficial es una migración nueva
--    que la agrega acá y en el catálogo de cada estudio (INSERT ... SELECT desde estudios).
-- 2) estudio_id en las tres tablas del catálogo, obligatorio y con su clave foránea a estudios.
--    Lo que ya había queda del estudio en uso (el activo más antiguo: el mismo que elige hoy la app
--    en src/lib/estudio-context.ts), con todo lo que se le haya cambiado. Cada uno de los otros
--    estudios recibe una copia, y sus cuentas, su comparativo y sus rubros activos pasan a apuntar a
--    su copia. Sin estudios, el catálogo viejo se borra: no lo usa ninguna cuenta.
-- 3) El código y el orden de una clasificación son únicos dentro de su estudio; la configuración de
--    gastos se identifica por estudio y clave.
-- 4) Cada estudio nuevo recibe el catálogo oficial al crearse (disparador "catalogo" en estudios).
-- 5) _estudio_en_la_tabla, antes de armar el control de una tabla, revisa que lo que ya está lo
--    cumpla (si no, se detiene y dice dónde). Se vuelve a armar el control de todas las tablas con
--    estudio: ahora una cuenta no puede usar la clasificación de otro estudio, ni una clasificación
--    la sección de otro.
--
-- Volumen: el catálogo de un estudio son unas 60 filas. Las cuentas se reescriben solo en los
-- estudios que no son el que está en uso.
--
-- Cómo revertir: DROP TRIGGER catalogo ON estudios y DROP FUNCTION
-- public._catalogo_del_estudio_nuevo(); en las tres tablas, dejar solo las filas del estudio en uso
-- (antes, las cuentas, el comparativo y los rubros activos de los otros estudios vuelven a apuntar a
-- ellas por código), quitar estudio_id, volver a los únicos por código y por orden y a la clave
-- primaria por clave; DROP TABLE public.catalogo_rubros y volver a correr
-- SELECT public._estudio_en_la_tabla(...) en las tablas con estudio.

-- 1) El catálogo oficial
CREATE TABLE public.catalogo_rubros (
  id uuid NOT NULL DEFAULT uuidv7(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  estado_destino "EstadoDestino" NOT NULL,
  seccion_ssp "SeccionSSP",
  seccion_eerr "SeccionEERR",
  naturaleza_esperada "NaturalezaEsperada" NOT NULL,
  orden integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  genera_nota_informativa boolean NOT NULL DEFAULT false,
  es_efectivo boolean NOT NULL DEFAULT false,
  texto_nota_default text,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT catalogo_rubros_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX catalogo_rubros_codigo_key ON public.catalogo_rubros (codigo);
CREATE UNIQUE INDEX catalogo_rubros_orden_key ON public.catalogo_rubros (orden);
-- Nace cerrada (migración 20261019001827_cerrar_acceso_anonimo)
ALTER TABLE public.catalogo_rubros ENABLE ROW LEVEL SECURITY;

INSERT INTO public.catalogo_rubros (codigo, nombre, descripcion, estado_destino, seccion_ssp,
  seccion_eerr, naturaleza_esperada, orden, activo, genera_nota_informativa, es_efectivo,
  texto_nota_default, updated_at)
SELECT codigo, nombre, descripcion, estado_destino::"EstadoDestino", seccion_ssp::"SeccionSSP",
  seccion_eerr::"SeccionEERR", naturaleza_esperada::"NaturalezaEsperada", orden, activo,
  genera_nota_informativa, es_efectivo, texto_nota_default, now()
FROM (VALUES
  ('ACT-CTE-01', 'Caja y Bancos', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 100, true, false, true, NULL),
  ('ACT-CTE-02', 'Inversiones Financieras', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 110, true, false, false, NULL),
  ('ACT-CTE-03', 'Cuentas por cobrar a clientes en moneda', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 120, true, false, false, NULL),
  ('ACT-CTE-04', 'Cuentas por cobrar a clientes en especie', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 130, true, false, false, NULL),
  ('ACT-CTE-05', 'Créditos impositivos', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 140, true, false, false, NULL),
  ('ACT-CTE-06', 'Créditos con partes relacionadas', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 150, true, false, false, NULL),
  ('ACT-CTE-07', 'Otras cuentas por cobrar en moneda', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 160, true, false, false, NULL),
  ('ACT-CTE-08', 'Otras cuentas por cobrar en especie', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 170, true, false, false, NULL),
  ('ACT-CTE-09', 'Bienes de cambio', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 180, true, false, false, NULL),
  ('ACT-CTE-10', 'Otras Inversiones', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 190, true, false, false, NULL),
  ('ACT-CTE-11', 'Otros activos', NULL, 'SSP', 'ACTIVO_CORRIENTE', NULL, 'DEUDORA', 200, true, false, false, NULL),
  ('ACT-NCTE-01', 'Inversiones Financieras', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 300, true, false, false, NULL),
  ('ACT-NCTE-02', 'Cuentas por cobrar a clientes en moneda', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 310, true, false, false, NULL),
  ('ACT-NCTE-03', 'Cuentas por cobrar a clientes en especie', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 320, true, false, false, NULL),
  ('ACT-NCTE-04', 'Créditos impositivos', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 330, true, false, false, NULL),
  ('ACT-NCTE-05', 'Créditos con partes relacionadas en Moneda', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 340, true, false, false, NULL),
  ('ACT-NCTE-06', 'Otras cuentas por cobrar en moneda', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 350, true, false, false, NULL),
  ('ACT-NCTE-07', 'Otras cuentas por cobrar en especie', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 360, true, false, false, NULL),
  ('ACT-NCTE-08', 'Bienes de cambio', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 370, true, false, false, NULL),
  ('ACT-NCTE-09', 'Bienes de uso', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 380, true, true, false, 'La composición y evolución del rubro se expone en el Anexo I, que forma parte integrante de los presentes estados contables.

Los bienes de uso se miden por el modelo de costo, sobre la base de su costo de adquisición reexpresado en moneda de cierre, neto de las depreciaciones acumuladas correspondientes.

Las depreciaciones se calculan por el método lineal, considerando la vida útil estimada de los bienes.

La sociedad no aplica el modelo de revaluación para la medición de sus bienes de uso.'),
  ('ACT-NCTE-10', 'Propiedades de inversión', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 390, true, false, false, NULL),
  ('ACT-NCTE-11', 'Otras inversiones', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 400, true, false, false, NULL),
  ('ACT-NCTE-12', 'Activos intangibles', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 410, true, false, false, NULL),
  ('ACT-NCTE-13', 'Otros activos', NULL, 'SSP', 'ACTIVO_NO_CORRIENTE', NULL, 'DEUDORA', 420, true, false, false, NULL),
  ('PAS-CTE-01', 'Deudas con Proveedores de Bienes y Servicios', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 500, true, false, false, NULL),
  ('PAS-CTE-02', 'Préstamos y Otros Pasivos Financieros', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 510, true, false, false, NULL),
  ('PAS-CTE-03', 'Deudas fiscales', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 520, true, false, false, NULL),
  ('PAS-CTE-04', 'Deudas Laborales y Previsionales', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 530, true, false, false, NULL),
  ('PAS-CTE-05', 'Deudas en Especie', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 540, true, false, false, NULL),
  ('PAS-CTE-06', 'Deudas con Partes Relacionadas', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 550, true, false, false, NULL),
  ('PAS-CTE-07', 'Otras deudas', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 560, true, false, false, NULL),
  ('PAS-CTE-08', 'Subsidios y otras Ayudas Gubernamentales', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 570, true, false, false, NULL),
  ('PAS-CTE-09', 'Previsiones', NULL, 'SSP', 'PASIVO_CORRIENTE', NULL, 'ACREEDORA', 580, true, false, false, NULL),
  ('PAS-NCTE-01', 'Deudas con Proveedores de Bienes y Servicios', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 600, true, false, false, NULL),
  ('PAS-NCTE-02', 'Préstamos y Otros Pasivos Financieros', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 610, true, false, false, NULL),
  ('PAS-NCTE-03', 'Deudas fiscales', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 620, true, false, false, NULL),
  ('PAS-NCTE-04', 'Deudas Laborales y Previsionales', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 630, true, false, false, NULL),
  ('PAS-NCTE-05', 'Deudas en Especie', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 640, true, false, false, NULL),
  ('PAS-NCTE-06', 'Deudas con Partes Relacionadas en Moneda', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 650, true, false, false, NULL),
  ('PAS-NCTE-07', 'Otras deudas', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 660, true, false, false, NULL),
  ('PAS-NCTE-08', 'Subsidios y otras Ayudas Gubernamentales', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 670, true, false, false, NULL),
  ('PAS-NCTE-09', 'Pasivo Neto por Impuesto Diferido', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 680, true, false, false, NULL),
  ('PAS-NCTE-10', 'Previsiones', NULL, 'SSP', 'PASIVO_NO_CORRIENTE', NULL, 'ACREEDORA', 690, true, false, false, NULL),
  ('PN-01', 'Capital social', NULL, 'PN', 'PATRIMONIO_NETO', NULL, 'ACREEDORA', 800, true, false, false, NULL),
  ('PN-02', 'Ajuste de capital', NULL, 'PN', 'PATRIMONIO_NETO', NULL, 'ACREEDORA', 810, true, false, false, NULL),
  ('PN-03', 'Reservas', NULL, 'PN', 'PATRIMONIO_NETO', NULL, 'ACREEDORA', 820, true, false, false, NULL),
  ('PN-04', 'Resultados no asignados', NULL, 'PN', 'PATRIMONIO_NETO', NULL, 'ACREEDORA', 830, true, false, false, NULL),
  ('PN-05', 'Resultado del ejercicio', NULL, 'PN', 'PATRIMONIO_NETO', NULL, 'ACREEDORA', 840, true, false, false, NULL),
  ('EERR-ING-01', 'Ventas netas', NULL, 'EERR', NULL, 'INGRESOS', 'ACREEDORA', 900, true, false, false, NULL),
  ('EERR-CST-01', 'Costo de mercaderías vendidas', NULL, 'EERR', NULL, 'COSTO_VENTAS', 'DEUDORA', 910, true, false, false, NULL),
  ('EERR-GADM-01', 'Gastos de administración', NULL, 'EERR', NULL, 'GASTOS_ADM', 'DEUDORA', 920, true, false, false, NULL),
  ('EERR-GCOM-01', 'Gastos de comercialización', NULL, 'EERR', NULL, 'GASTOS_COM', 'DEUDORA', 930, true, false, false, NULL),
  ('EERR-GBAN-01', 'Gastos bancarios', NULL, 'EERR', NULL, 'GASTOS_BANCARIOS', 'DEUDORA', 940, true, false, false, NULL),
  ('EERR-IICC-01', 'Impuestos y contribuciones', NULL, 'EERR', NULL, 'IMPUESTOS_CONTRIBUCIONES', 'DEUDORA', 950, true, false, false, NULL),
  ('EERR-RFIN-01', 'Resultados financieros y por tenencia', NULL, 'EERR', NULL, 'RESULTADOS_FINANCIEROS', 'ACREEDORA', 960, true, false, false, NULL),
  ('EERR-RFIN-02', 'RECPAM', NULL, 'EERR', NULL, 'RESULTADOS_FINANCIEROS', 'ACREEDORA', 970, true, false, false, NULL),
  ('EERR-IMP-01', 'Impuesto a las ganancias', NULL, 'EERR', NULL, 'IMPUESTO_GANANCIAS', 'DEUDORA', 980, true, false, false, NULL)
) AS v (codigo, nombre, descripcion, estado_destino, seccion_ssp, seccion_eerr,
  naturaleza_esperada, orden, activo, genera_nota_informativa, es_efectivo, texto_nota_default);

-- 2) y 3) El estudio en el catálogo
ALTER TABLE public.rubros_grupo ADD COLUMN estudio_id uuid;
ALTER TABLE public.rubros_base ADD COLUMN estudio_id uuid;
ALTER TABLE public.gasto_seccion_config ADD COLUMN estudio_id uuid;

-- Lo único de toda la base pasa a ser único por estudio (se crea más abajo, después de las copias)
DROP INDEX public.rubros_base_codigo_key;
DROP INDEX public.rubros_base_orden_key;
ALTER TABLE public.gasto_seccion_config DROP CONSTRAINT gasto_seccion_config_pkey;

DO $$
DECLARE
  v_en_uso uuid;
BEGIN
  SELECT id INTO v_en_uso FROM public.estudios ORDER BY activo DESC, created_at, id LIMIT 1;

  IF v_en_uso IS NULL THEN
    DELETE FROM public.gasto_seccion_config;
    DELETE FROM public.rubros_base;
    DELETE FROM public.rubros_grupo;
    RETURN;
  END IF;

  UPDATE public.rubros_grupo SET estudio_id = v_en_uso;
  UPDATE public.rubros_base SET estudio_id = v_en_uso;
  UPDATE public.gasto_seccion_config SET estudio_id = v_en_uso;

  -- La copia de cada uno de los otros estudios: qué id nuevo le toca a cada sección y clasificación
  CREATE TEMP TABLE _copia_catalogo (estudio_id uuid, viejo uuid, nuevo uuid, es_grupo boolean);
  INSERT INTO _copia_catalogo
  SELECT e.id, g.id, public.uuidv7(), true
  FROM public.estudios e CROSS JOIN public.rubros_grupo g WHERE e.id <> v_en_uso;
  INSERT INTO _copia_catalogo
  SELECT e.id, r.id, public.uuidv7(), false
  FROM public.estudios e CROSS JOIN public.rubros_base r WHERE e.id <> v_en_uso;

  INSERT INTO public.rubros_grupo (id, estudio_id, nombre, sigla, es_gasto, aparec_en_eerr,
    estado_destino, seccion_ssp, seccion_eerr, orden, activo, created_at, updated_at)
  SELECT c.nuevo, c.estudio_id, g.nombre, g.sigla, g.es_gasto, g.aparec_en_eerr,
    g.estado_destino, g.seccion_ssp, g.seccion_eerr, g.orden, g.activo, g.created_at, g.updated_at
  FROM _copia_catalogo c JOIN public.rubros_grupo g ON g.id = c.viejo
  WHERE c.es_grupo;

  INSERT INTO public.rubros_base (id, estudio_id, rubro_grupo_id, codigo, nombre, descripcion,
    estado_destino, seccion_ssp, seccion_eerr, naturaleza_esperada, orden, activo,
    genera_nota_informativa, es_efectivo, texto_nota_default, created_at, updated_at)
  SELECT c.nuevo, c.estudio_id, cg.nuevo, r.codigo, r.nombre, r.descripcion,
    r.estado_destino, r.seccion_ssp, r.seccion_eerr, r.naturaleza_esperada, r.orden, r.activo,
    r.genera_nota_informativa, r.es_efectivo, r.texto_nota_default, r.created_at, r.updated_at
  FROM _copia_catalogo c
  JOIN public.rubros_base r ON r.id = c.viejo
  LEFT JOIN _copia_catalogo cg
    ON cg.es_grupo AND cg.estudio_id = c.estudio_id AND cg.viejo = r.rubro_grupo_id
  WHERE NOT c.es_grupo;

  INSERT INTO public.gasto_seccion_config (estudio_id, clave, aparec_en_eerr, orden)
  SELECT e.id, g.clave, g.aparec_en_eerr, g.orden
  FROM public.estudios e CROSS JOIN public.gasto_seccion_config g
  WHERE e.id <> v_en_uso AND g.estudio_id = v_en_uso;

  -- Lo de los otros estudios pasa a apuntar a su copia. El comparativo guarda el id de la
  -- clasificación (SSP, EERR) o de la sección (grupo:<id>:<cuenta>, gastos) dentro de la clave.
  UPDATE public.cuentas_contables t SET rubro_base_id = c.nuevo
  FROM _copia_catalogo c
  WHERE NOT c.es_grupo AND c.estudio_id = t.estudio_id AND c.viejo = t.rubro_base_id;
  UPDATE public.rubros_activos_estudio t SET rubro_id = c.nuevo
  FROM _copia_catalogo c
  WHERE NOT c.es_grupo AND c.estudio_id = t.estudio_id AND c.viejo = t.rubro_id;
  UPDATE public.comparativo_manual t SET clave = replace(t.clave, c.viejo::text, c.nuevo::text)
  FROM _copia_catalogo c
  WHERE c.estudio_id = t.estudio_id AND strpos(t.clave, c.viejo::text) > 0;

  DROP TABLE _copia_catalogo;
END
$$;

ALTER TABLE public.rubros_grupo
  ALTER COLUMN estudio_id SET NOT NULL,
  ALTER COLUMN estudio_id SET DEFAULT public.estudio_de_la_sesion();
ALTER TABLE public.rubros_base
  ALTER COLUMN estudio_id SET NOT NULL,
  ALTER COLUMN estudio_id SET DEFAULT public.estudio_de_la_sesion();
ALTER TABLE public.gasto_seccion_config
  ALTER COLUMN estudio_id SET NOT NULL,
  ALTER COLUMN estudio_id SET DEFAULT public.estudio_de_la_sesion();

ALTER TABLE public.gasto_seccion_config
  ADD CONSTRAINT gasto_seccion_config_pkey PRIMARY KEY (estudio_id, clave);
CREATE UNIQUE INDEX rubros_base_estudio_id_codigo_key ON public.rubros_base (estudio_id, codigo);
CREATE UNIQUE INDEX rubros_base_estudio_id_orden_key ON public.rubros_base (estudio_id, orden);
-- Las secciones se leen por estudio y en orden
CREATE INDEX rubros_grupo_estudio_id_orden_idx ON public.rubros_grupo (estudio_id, orden);

ALTER TABLE public.rubros_grupo ADD CONSTRAINT rubros_grupo_estudio_id_fkey
  FOREIGN KEY (estudio_id) REFERENCES public.estudios (id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.rubros_base ADD CONSTRAINT rubros_base_estudio_id_fkey
  FOREIGN KEY (estudio_id) REFERENCES public.estudios (id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.gasto_seccion_config ADD CONSTRAINT gasto_seccion_config_estudio_id_fkey
  FOREIGN KEY (estudio_id) REFERENCES public.estudios (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) El catálogo oficial para cada estudio nuevo
CREATE FUNCTION public._catalogo_del_estudio_nuevo() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.rubros_base (estudio_id, codigo, nombre, descripcion, estado_destino,
    seccion_ssp, seccion_eerr, naturaleza_esperada, orden, activo, genera_nota_informativa,
    es_efectivo, texto_nota_default, updated_at)
  SELECT NEW.id, c.codigo, c.nombre, c.descripcion, c.estado_destino, c.seccion_ssp,
    c.seccion_eerr, c.naturaleza_esperada, c.orden, c.activo, c.genera_nota_informativa,
    c.es_efectivo, c.texto_nota_default, now()
  FROM public.catalogo_rubros c;
  RETURN NULL;
END
$$;
CREATE TRIGGER catalogo AFTER INSERT ON public.estudios
FOR EACH ROW EXECUTE FUNCTION public._catalogo_del_estudio_nuevo();

-- 5) El control de cada tabla con estudio, que ahora revisa antes lo que ya está
CREATE OR REPLACE FUNCTION public._estudio_en_la_tabla(p_tabla regclass) RETURNS void
LANGUAGE plpgsql SET search_path = ''
AS $gen$
DECLARE
  v_tabla text := (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_funcion text := '_estudio_de_' || (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_cuerpo text := '';
  v_columnas text[] := ARRAY['estudio_id'];
  v_cruzadas bigint;
  v record;
  v_rol text;
BEGIN
  -- Cada clave foránea de una columna hacia otra tabla que también lleva el estudio
  FOR v IN
    SELECT a.attname AS columna, pc.relname AS padre
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class pc ON pc.oid = c.confrelid
    WHERE c.conrelid = p_tabla AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid
                  AND x.attname = 'estudio_id' AND NOT x.attisdropped)
    ORDER BY a.attname
  LOOP
    -- Lo que ya está tiene que cumplirlo: si no, se detiene y dice dónde (hay que mirarlo)
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN public.%I p ON p.id = t.%I WHERE p.estudio_id <> t.estudio_id',
      p_tabla, v.padre, v.columna) INTO v_cruzadas;
    IF v_cruzadas > 0 THEN
      RAISE EXCEPTION 'En %, % filas de % apuntan a un dato de otro estudio.',
        v_tabla, v_cruzadas, v.columna USING ERRCODE = '23514';
    END IF;

    v_columnas := v_columnas || v.columna::text;
    v_cuerpo := v_cuerpo || format($b$
  IF NEW.%1$I IS NOT NULL THEN
    SELECT p.estudio_id INTO v_estudio FROM public.%2$I p WHERE p.id = NEW.%1$I;
    IF NEW.estudio_id IS NULL THEN
      NEW.estudio_id := v_estudio;
    ELSIF v_estudio IS DISTINCT FROM NEW.estudio_id THEN
      RAISE EXCEPTION 'En %3$s, %1$s apunta a un dato de otro estudio.' USING ERRCODE = '23514';
    END IF;
  END IF;$b$, v.columna, v.padre, v_tabla);
  END LOOP;

  EXECUTE format($f$
CREATE OR REPLACE FUNCTION public.%1$I() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $cuerpo$
DECLARE
  v_estudio uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estudio_id IS DISTINCT FROM OLD.estudio_id THEN
    RAISE EXCEPTION 'El estudio de una fila de %2$s no se cambia.' USING ERRCODE = '23514';
  END IF;%3$s
  RETURN NEW;
END
$cuerpo$$f$, v_funcion, v_tabla, v_cuerpo);

  EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC', v_funcion);
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM %I', v_funcion, v_rol);
    END IF;
  END LOOP;

  EXECUTE format('DROP TRIGGER IF EXISTS estudio ON %s', p_tabla);
  EXECUTE format(
    'CREATE TRIGGER estudio BEFORE INSERT OR UPDATE OF %s ON %s FOR EACH ROW EXECUTE FUNCTION public.%I()',
    (SELECT string_agg(quote_ident(c), ', ') FROM unnest(v_columnas) c), p_tabla, v_funcion);
END
$gen$;

SELECT public._estudio_en_la_tabla(c.oid::regclass)
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
              AND a.attname = 'estudio_id' AND NOT a.attisdropped)
ORDER BY c.relname;

-- Las funciones nuevas o rehechas, cerradas
REVOKE EXECUTE ON FUNCTION public._catalogo_del_estudio_nuevo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM PUBLIC;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._catalogo_del_estudio_nuevo() FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON TABLE public.catalogo_rubros FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
