-- Índices para todas las claves foráneas que no tenían uno.
--
-- Problema (medido el 2026-10-19 con `pnpm rendimiento`, ver docs/RENDIMIENTO.md): 10 claves foráneas
-- no eran el comienzo de ningún índice. Las dos de cuentas_contables (rubroBaseId, importacionExcelId)
-- son las graves: borrar o reasignar un rubro, borrar una importación o validar si un rubro está en
-- uso obligaba a recorrer TODAS las cuentas del estudio (1,6 millones en la escala media) y a
-- bloquearlas mientras tanto. Las otras ocho son tablas chicas: se indexan igual para que la regla
-- "toda clave foránea lleva índice" se cumpla sin excepciones y la medición pueda exigirla.
--
-- Hoy la base de producción es chica, así que CREATE INDEX es instantáneo. Sobre tablas grandes,
-- un índice nuevo se crea con CREATE INDEX CONCURRENTLY en una migración propia (ver CLAUDE.md).
--
-- Para revertir (en una migración nueva): DROP INDEX de cada uno de los nombres de abajo.

-- CreateIndex
CREATE INDEX "cuentas_contables_rubroBaseId_idx" ON "cuentas_contables"("rubroBaseId");

-- CreateIndex
CREATE INDEX "cuentas_contables_importacionExcelId_idx" ON "cuentas_contables"("importacionExcelId");

-- CreateIndex
CREATE INDEX "ejercicios_contables_auditorId_idx" ON "ejercicios_contables"("auditorId");

-- CreateIndex
CREATE INDEX "importaciones_excel_mapeoExcelId_idx" ON "importaciones_excel"("mapeoExcelId");

-- CreateIndex
CREATE INDEX "mapeos_excel_estudioId_idx" ON "mapeos_excel"("estudioId");

-- CreateIndex
CREATE INDEX "notas_ejercicio_plantillaNotaId_idx" ON "notas_ejercicio"("plantillaNotaId");

-- CreateIndex
CREATE INDEX "plantillas_nota_estudioId_idx" ON "plantillas_nota"("estudioId");

-- CreateIndex
CREATE INDEX "rubros_activos_estudio_rubroId_idx" ON "rubros_activos_estudio"("rubroId");

-- CreateIndex
CREATE INDEX "rubros_base_rubroGrupoId_idx" ON "rubros_base"("rubroGrupoId");

-- CreateIndex
CREATE INDEX "usuarios_estudio_estudioId_idx" ON "usuarios_estudio"("estudioId");
