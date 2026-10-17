-- CreateEnum
CREATE TYPE "SeccionFlujo" AS ENUM ('ACTIVIDADES_OPERATIVAS', 'ACTIVIDADES_INVERSION', 'ACTIVIDADES_FINANCIAMIENTO');

-- CreateTable
CREATE TABLE "flujo_caja_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "saldoInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoFinal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoInicialAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoFinalAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flujo_caja_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flujo_caja_items" (
    "id" TEXT NOT NULL,
    "flujoId" TEXT NOT NULL,
    "seccion" "SeccionFlujo" NOT NULL,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "esSubtotal" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flujo_caja_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bienes_de_uso_categorias" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "costoInicioReexpresado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "altas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bajas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoFinReexpresado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depAcumInicio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depEjercicio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depBajas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depAcumFin" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bienes_de_uso_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costo_ventas_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "existenciaInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "compras" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gastosFabricacion" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "existenciaFinal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costo_ventas_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_naturaleza" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "importeAdmin" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeComercial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeProduccion" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeAdminAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeComercialAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeProduccionAnt" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_naturaleza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flujo_caja_ejercicio_ejercicioId_key" ON "flujo_caja_ejercicio"("ejercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "bienes_de_uso_categorias_ejercicioId_categoria_key" ON "bienes_de_uso_categorias"("ejercicioId", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "costo_ventas_ejercicio_ejercicioId_key" ON "costo_ventas_ejercicio"("ejercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_naturaleza_ejercicioId_concepto_key" ON "gastos_naturaleza"("ejercicioId", "concepto");

-- AddForeignKey
ALTER TABLE "flujo_caja_ejercicio" ADD CONSTRAINT "flujo_caja_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flujo_caja_items" ADD CONSTRAINT "flujo_caja_items_flujoId_fkey" FOREIGN KEY ("flujoId") REFERENCES "flujo_caja_ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bienes_de_uso_categorias" ADD CONSTRAINT "bienes_de_uso_categorias_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costo_ventas_ejercicio" ADD CONSTRAINT "costo_ventas_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_naturaleza" ADD CONSTRAINT "gastos_naturaleza_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
