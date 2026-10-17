-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SeccionEERR" ADD VALUE 'GASTOS_BANCARIOS';
ALTER TYPE "SeccionEERR" ADD VALUE 'IMPUESTOS_CONTRIBUCIONES';

-- AlterTable
ALTER TABLE "auditores" ADD COLUMN     "universidad" TEXT;

-- AlterTable
ALTER TABLE "ejercicios_contables" ADD COLUMN     "fechaInformeAuditor" TIMESTAMP(3),
ADD COLUMN     "numeroEjercicio" INTEGER;

-- AlterTable
ALTER TABLE "sociedades" ADD COLUMN     "actividadSecundaria" TEXT,
ADD COLUMN     "composicionCapital" TEXT,
ADD COLUMN     "fechaInscripcion" TIMESTAMP(3),
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "matriculaPJ" TEXT,
ADD COLUMN     "plazoDuracion" TIMESTAMP(3),
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "tipoSocietario" TEXT;
