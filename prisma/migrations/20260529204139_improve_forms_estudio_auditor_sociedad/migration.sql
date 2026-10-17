-- AlterTable
ALTER TABLE "auditores" ADD COLUMN     "esDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "localidadInforme" TEXT,
ADD COLUMN     "textoFirma" TEXT,
ADD COLUMN     "tituloProfesional" TEXT;

-- AlterTable
ALTER TABLE "estudios" ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "provincia" TEXT;

-- AlterTable
ALTER TABLE "sociedades" ADD COLUMN     "clasificacionRT54" TEXT,
ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "condicionFiscal" TEXT;
