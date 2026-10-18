/*
  Warnings:

  - You are about to alter the column `saldoAlAceptar` on the `documentos_ejercicio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.

*/
-- AlterTable
ALTER TABLE "documentos_ejercicio" ALTER COLUMN "saldoAlAceptar" SET DATA TYPE DECIMAL(18,2);

-- CreateIndex
CREATE INDEX "cuentas_contables_notaEjercicioId_idx" ON "cuentas_contables"("notaEjercicioId");

-- CreateIndex
CREATE INDEX "flujo_caja_items_flujoId_idx" ON "flujo_caja_items"("flujoId");

-- CreateIndex
CREATE INDEX "importaciones_excel_ejercicioId_idx" ON "importaciones_excel"("ejercicioId");
