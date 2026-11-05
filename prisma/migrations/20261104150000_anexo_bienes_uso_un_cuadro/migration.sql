-- El Anexo de Bienes de Uso del documento, en un solo cuadro o en dos.
--
-- Qué resuelve: un cliente pidió el formato tradicional, con valor de origen, amortizaciones y los
-- netos residuales en la misma fila de cada rubro, en un solo cuadro. El dueño del producto
-- (2026-11-04) decidió ofrecer las dos vistas como preferencia de cada estudio: un solo cuadro (por
-- defecto) o dos cuadros, uno debajo del otro, como hasta ahora. Las dos salen de los mismos
-- números: solo cambia cómo se dibuja la tabla.
--
-- Qué hace: el tipo "FormatoAnexoBienesUso" y la columna estudio_configuracion.anexo_bienes_uso,
-- con 'UN_CUADRO' para todos los estudios (también los que ya existen).
--
-- Cómo revertir: ALTER TABLE estudio_configuracion DROP COLUMN anexo_bienes_uso;
-- DROP TYPE "FormatoAnexoBienesUso";

CREATE TYPE "FormatoAnexoBienesUso" AS ENUM ('UN_CUADRO', 'DOS_CUADROS');

ALTER TABLE estudio_configuracion
  ADD COLUMN anexo_bienes_uso "FormatoAnexoBienesUso" NOT NULL DEFAULT 'UN_CUADRO';
