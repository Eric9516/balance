-- Una nota como fila del Estado de Situación Patrimonial.
--
-- Qué resuelve: igual que en el Estado de Resultados (20261102120000), hay importes del ejercicio
-- anterior cuyas cuentas no están en el balance de este año. Decisión del dueño del producto
-- (2026-11-02): también se ubican con un "+" en el Activo o el Pasivo, y una nota se usa una sola vez:
-- en un estado o en el otro.
--
-- Qué hace:
--   linea_ssp_seccion   sección donde va (el Patrimonio Neto no: sale del E.E.P.N.). Null = no está.
--   linea_ssp_debajo_de fila que queda arriba (un rubro o una fila del anterior); null = al principio
--                       de la sección. Es la clave de la fila en la pantalla, no un vínculo.
--   linea_ssp_resta     si resta de la sección (se ve entre paréntesis).
-- La base no deja que una nota esté en los dos estados a la vez.
--
-- Cómo revertir: ALTER TABLE notas_ejercicio DROP CONSTRAINT notas_ejercicio_un_solo_estado,
--   DROP CONSTRAINT notas_ejercicio_linea_ssp_completa, DROP CONSTRAINT notas_ejercicio_linea_ssp_seccion,
--   DROP COLUMN linea_ssp_resta, DROP COLUMN linea_ssp_debajo_de, DROP COLUMN linea_ssp_seccion.

ALTER TABLE public.notas_ejercicio
  ADD COLUMN linea_ssp_seccion text,
  ADD COLUMN linea_ssp_debajo_de text,
  ADD COLUMN linea_ssp_resta boolean,
  ADD CONSTRAINT notas_ejercicio_linea_ssp_seccion
    CHECK (linea_ssp_seccion IS NULL OR linea_ssp_seccion IN
      ('ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE', 'PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE')),
  ADD CONSTRAINT notas_ejercicio_linea_ssp_completa
    CHECK (
      (linea_ssp_seccion IS NULL AND linea_ssp_debajo_de IS NULL AND linea_ssp_resta IS NULL)
      OR (linea_ssp_seccion IS NOT NULL AND linea_ssp_resta IS NOT NULL
          AND (linea_ssp_debajo_de IS NULL OR length(linea_ssp_debajo_de) BETWEEN 1 AND 200))
    ),
  ADD CONSTRAINT notas_ejercicio_un_solo_estado
    CHECK (linea_eerr_debajo_de IS NULL OR linea_ssp_seccion IS NULL);
