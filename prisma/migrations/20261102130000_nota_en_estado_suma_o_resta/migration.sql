-- Elegir si una nota ubicada en el Estado de Resultados suma o resta.
--
-- Qué resuelve: hasta ahora lo decidía el signo con el que estaba cargada la nota, y una nota con un
-- importe en positivo no se podía restar sin volver a cargarla en negativo. Decisión del dueño del
-- producto (2026-11-01): se elige al agregar la fila; la que resta se ve entre paréntesis.
--
-- Qué hace: notas_ejercicio.linea_eerr_resta guarda la elección. Null = no se eligió (la nota no está
-- en el estado, o se ubicó antes de esta opción): vale el signo de la nota, como hasta ahora.
--
-- Cómo revertir: ALTER TABLE notas_ejercicio DROP COLUMN linea_eerr_resta.

ALTER TABLE public.notas_ejercicio
  ADD COLUMN linea_eerr_resta boolean,
  ADD CONSTRAINT notas_ejercicio_linea_eerr_resta_con_linea
    CHECK (linea_eerr_resta IS NULL OR linea_eerr_debajo_de IS NOT NULL);
