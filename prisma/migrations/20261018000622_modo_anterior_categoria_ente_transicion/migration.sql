/*
  Warnings:

  - You are about to alter the column `valor` on the `comparativo_manual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.

*/
-- CreateEnum
CREATE TYPE "ModoEjercicioAnterior" AS ENUM ('VINCULADO', 'MANUAL', 'SIN_ANTERIOR');

-- CreateEnum
CREATE TYPE "CategoriaEnteRT54" AS ENUM ('PEQUENA', 'MEDIANA', 'RESTANTE');

-- CreateEnum
CREATE TYPE "TipoAjusteTransicion" AS ENUM ('AJUSTE_MEDICION', 'RECLASIFICACION');

-- CreateEnum
CREATE TYPE "ComponentePN" AS ENUM ('CAPITAL_SUSCRIPTO', 'AJUSTE_CAPITAL', 'APORTES_IRREVOCABLES', 'RESERVA_LEGAL', 'OTRAS_RESERVAS', 'RDOS_NO_ASIGNADOS');

-- AlterTable
ALTER TABLE "comparativo_manual" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "ejercicios_contables" ADD COLUMN     "categoriaEnte" "CategoriaEnteRT54",
ADD COLUMN     "comparativoAutorizadoEn" TIMESTAMP(3),
ADD COLUMN     "comparativoAutorizadoPor" TEXT,
ADD COLUMN     "modoAnterior" "ModoEjercicioAnterior";

-- AlterTable
ALTER TABLE "sociedades" ADD COLUMN     "categoriaEnte" "CategoriaEnteRT54";

-- ─── Backfill: modoAnterior desde los flags legacy ────────────────────────────
-- Con vínculo → VINCULADO (el vínculo manda; filas manuales residuales quedan y el dominio las ignora).
-- Sin vínculo y "balance anterior no disponible" → MANUAL.
-- El resto queda NULL = pendiente de configurar (la UI lo pide antes de autorizar).
UPDATE "ejercicios_contables"
   SET "modoAnterior" = 'VINCULADO'
 WHERE "modoAnterior" IS NULL AND "ejercicioAnteriorId" IS NOT NULL;

UPDATE "ejercicios_contables"
   SET "modoAnterior" = 'MANUAL'
 WHERE "modoAnterior" IS NULL AND "ejercicioAnteriorId" IS NULL AND "balanceAnteriorDisponible" = false;

-- ─── Backfill: categoriaEnte desde el texto libre ─────────────────────────────
-- Textos históricos: ejercicio usaba 'Entidad pequeña' | 'PyME pequeña' | 'PyME mediana' | 'Otra entidad';
-- sociedad usaba 'Entidad Pequeña' | 'Entidad Mediana'. Se comparan en minúsculas.
UPDATE "ejercicios_contables"
   SET "categoriaEnte" = CASE
     WHEN lower("clasificacionEntidad") IN ('entidad pequeña', 'pyme pequeña', 'pequeña')  THEN 'PEQUENA'::"CategoriaEnteRT54"
     WHEN lower("clasificacionEntidad") IN ('entidad mediana', 'pyme mediana', 'mediana')  THEN 'MEDIANA'::"CategoriaEnteRT54"
     WHEN lower("clasificacionEntidad") IN ('otra entidad', 'entidad restante', 'restante') THEN 'RESTANTE'::"CategoriaEnteRT54"
   END
 WHERE "categoriaEnte" IS NULL AND "clasificacionEntidad" IS NOT NULL;

UPDATE "sociedades"
   SET "categoriaEnte" = CASE
     WHEN lower("clasificacionRT54") IN ('entidad pequeña', 'pyme pequeña', 'pequeña')  THEN 'PEQUENA'::"CategoriaEnteRT54"
     WHEN lower("clasificacionRT54") IN ('entidad mediana', 'pyme mediana', 'mediana')  THEN 'MEDIANA'::"CategoriaEnteRT54"
     WHEN lower("clasificacionRT54") IN ('otra entidad', 'entidad restante', 'restante') THEN 'RESTANTE'::"CategoriaEnteRT54"
   END
 WHERE "categoriaEnte" IS NULL AND "clasificacionRT54" IS NOT NULL;

-- CreateTable
CREATE TABLE "ajustes_transicion_rt54" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoAjusteTransicion" NOT NULL,
    "concepto" TEXT NOT NULL,
    "descripcion" TEXT,
    "componentePN" "ComponentePN",
    "importePN" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeResultadoAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rubroOrigen" TEXT,
    "rubroDestino" TEXT,
    "importeReclasificado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajustes_transicion_rt54_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajustes_transicion_rt54_ejercicioId_idx" ON "ajustes_transicion_rt54"("ejercicioId");

-- CreateIndex
CREATE INDEX "auditores_estudioId_idx" ON "auditores"("estudioId");

-- CreateIndex
CREATE INDEX "cuentas_contables_ejercicioId_rubroBaseId_idx" ON "cuentas_contables"("ejercicioId", "rubroBaseId");

-- CreateIndex
CREATE INDEX "detalles_nota_notaEjercicioId_idx" ON "detalles_nota"("notaEjercicioId");

-- CreateIndex
CREATE INDEX "ejercicios_contables_sociedadId_fechaCierre_idx" ON "ejercicios_contables"("sociedadId", "fechaCierre");

-- CreateIndex
CREATE INDEX "errores_validacion_ejercicioId_estado_idx" ON "errores_validacion"("ejercicioId", "estado");

-- CreateIndex
CREATE INDEX "notas_ejercicio_ejercicioId_idx" ON "notas_ejercicio"("ejercicioId");

-- CreateIndex
CREATE INDEX "sociedades_estudioId_idx" ON "sociedades"("estudioId");

-- AddForeignKey
ALTER TABLE "ajustes_transicion_rt54" ADD CONSTRAINT "ajustes_transicion_rt54_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
