-- CreateEnum
CREATE TYPE "DensidadTablas" AS ENUM ('COMODA', 'COMPACTA');

-- AlterTable
ALTER TABLE "estudio_configuracion" ADD COLUMN     "densidadTablas" "DensidadTablas" NOT NULL DEFAULT 'COMODA',
ALTER COLUMN "colorPrimario" SET DEFAULT '#2F6B55';

-- AlterTable
ALTER TABLE "rubros_base" ADD COLUMN     "esEfectivo" BOOLEAN NOT NULL DEFAULT false;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Acento: los estudios que nunca eligieron color (default viejo) pasan al nuevo.
UPDATE "estudio_configuracion" SET "colorPrimario" = '#2F6B55' WHERE lower("colorPrimario") = '#1a1a2e';

-- Efectivo y equivalentes: "Caja y Bancos" del catálogo RT 54.
UPDATE "rubros_base" SET "esEfectivo" = true WHERE "codigo" = 'ACT-CTE-01';
