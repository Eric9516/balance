-- Nota 1 (bases de preparación) generada y editable.
--
-- Problema: la Nota 1 salía como "pendiente". Ahora la app la genera con los datos del ejercicio
-- (adopción de la RT 54, categoría del ente, índices, transición) y el contador puede reemplazarla
-- por su propio texto.
--
-- Cambio:
-- - nota_uno_texto: el texto que escribió el contador; null = se usa el generado, que se mantiene
--   al día solo si cambian los datos.
-- - nota_uno_editada_en: cuándo lo escribió. Los dos van juntos (CHECK) y el texto tiene un largo
--   razonable (CHECK): la base es la última barrera.
-- - Columnas nuevas que admiten null: no se reescribe la tabla ni cambia ningún dato.
--
-- Revertir:
--   ALTER TABLE "ejercicios_contables" DROP COLUMN "nota_uno_texto", DROP COLUMN "nota_uno_editada_en";

ALTER TABLE "ejercicios_contables"
  ADD COLUMN "nota_uno_texto" TEXT,
  ADD COLUMN "nota_uno_editada_en" TIMESTAMPTZ(3);

ALTER TABLE "ejercicios_contables"
  ADD CONSTRAINT "ejercicios_contables_nota_uno_juntos"
    CHECK (("nota_uno_texto" IS NULL) = ("nota_uno_editada_en" IS NULL)),
  ADD CONSTRAINT "ejercicios_contables_nota_uno_texto_largo"
    CHECK ("nota_uno_texto" IS NULL OR char_length("nota_uno_texto") BETWEEN 1 AND 50000);
