/*
  Warnings:

  - You are about to drop the `patrimonio_neto_ejercicio` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoMovimientoPN" AS ENUM ('SALDO_INICIO', 'AJUSTE_INFLACION', 'MODIFICACION_INICIO', 'DISTRIB_HONORARIOS', 'DISTRIB_DIVIDENDOS', 'DISTRIB_RESERVA_LEGAL', 'DISTRIB_OTRAS_RESERVAS', 'DISTRIB_APORTES_IRREVOCABLES', 'RESULTADO_EJERCICIO');

-- DropForeignKey
ALTER TABLE "patrimonio_neto_ejercicio" DROP CONSTRAINT "patrimonio_neto_ejercicio_ejercicioId_fkey";

-- AlterTable
ALTER TABLE "bienes_de_uso_categorias" ADD COLUMN     "costoAjusteInflacion" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "depAjusteInflacion" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "flujo_caja_ejercicio" ADD COLUMN     "modificacionesEjAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "modificacionesEjAntAnt" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "patrimonio_neto_ejercicio";

-- CreateTable
CREATE TABLE "evolucion_pn_movimientos" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "tipo" "TipoMovimientoPN" NOT NULL,
    "orden" INTEGER NOT NULL,
    "capitalSuscripto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ajusteCapital" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aportesIrrevocables" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reservaLegal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otrasReservas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rdosNoAsignados" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evolucion_pn_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evolucion_pn_movimientos_ejercicioId_tipo_key" ON "evolucion_pn_movimientos"("ejercicioId", "tipo");

-- AddForeignKey
ALTER TABLE "evolucion_pn_movimientos" ADD CONSTRAINT "evolucion_pn_movimientos_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
