/*
  Warnings:

  - You are about to drop the column `importeComercial` on the `gastos_naturaleza` table. All the data in the column will be lost.
  - You are about to drop the column `importeComercialAnt` on the `gastos_naturaleza` table. All the data in the column will be lost.
  - You are about to drop the column `importeProduccion` on the `gastos_naturaleza` table. All the data in the column will be lost.
  - You are about to drop the column `importeProduccionAnt` on the `gastos_naturaleza` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoValidacion" ADD VALUE 'REEXPRESION_FALTANTE';
ALTER TYPE "TipoValidacion" ADD VALUE 'ANEXO_INCONSISTENTE';

-- AlterTable
ALTER TABLE "gastos_naturaleza" DROP COLUMN "importeComercial",
DROP COLUMN "importeComercialAnt",
DROP COLUMN "importeProduccion",
DROP COLUMN "importeProduccionAnt",
ADD COLUMN     "importeBancario" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importeBancarioAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importeImpuestos" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importeImpuestosAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importeOperativo" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "importeOperativoAnt" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "notas_ejercicio" ADD COLUMN     "criterioMedicion" TEXT,
ADD COLUMN     "textoApertura" TEXT;

-- AlterTable
ALTER TABLE "plantillas_nota" ADD COLUMN     "criterioMedicion" TEXT,
ADD COLUMN     "textoApertura" TEXT;
