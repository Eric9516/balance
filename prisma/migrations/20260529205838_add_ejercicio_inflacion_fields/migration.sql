-- AlterTable
ALTER TABLE "ejercicios_contables" ADD COLUMN     "clasificacionEntidad" TEXT,
ADD COLUMN     "indiceInflacionActual" DECIMAL(10,6),
ADD COLUMN     "indiceInflacionAnterior" DECIMAL(10,6);
