-- Una nota como fila del Estado de Resultados.
--
-- Qué resuelve: hay importes del ejercicio anterior (por ejemplo, "Otros ingresos y egresos") cuyas
-- cuentas no están en el balance de este año. Sin cuentas no tenían dónde ir en el Estado de
-- Resultados y el resultado del anterior no daba igual al balance presentado. Decisión del dueño del
-- producto (2026-11-01): se crea una nota con esos importes y se ubica en el estado con un "+".
--
-- Qué hace: notas_ejercicio.linea_eerr_debajo_de guarda debajo de qué línea del estado va la nota.
-- Null = la nota no es una fila del estado. Es la clave de la línea (INGRESOS, UTILIDAD_BRUTA, una
-- sección de gastos...), no un vínculo: las líneas no son una tabla.
--
-- Cómo revertir: ALTER TABLE notas_ejercicio DROP COLUMN linea_eerr_debajo_de.

ALTER TABLE public.notas_ejercicio
  ADD COLUMN linea_eerr_debajo_de text,
  ADD CONSTRAINT notas_ejercicio_linea_eerr_largo
    CHECK (linea_eerr_debajo_de IS NULL OR length(linea_eerr_debajo_de) BETWEEN 1 AND 200);
