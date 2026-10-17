-- CreateEnum
CREATE TYPE "EstadoDestino" AS ENUM ('SSP', 'EERR', 'PN');

-- CreateEnum
CREATE TYPE "SeccionSSP" AS ENUM ('ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE', 'PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE', 'PATRIMONIO_NETO');

-- CreateEnum
CREATE TYPE "SeccionEERR" AS ENUM ('INGRESOS', 'COSTO_VENTAS', 'GASTOS_ADM', 'GASTOS_COM', 'RESULTADOS_FINANCIEROS', 'IMPUESTO_GANANCIAS');

-- CreateEnum
CREATE TYPE "NaturalezaEsperada" AS ENUM ('DEUDORA', 'ACREEDORA');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "EstadoEjercicio" AS ENUM ('BORRADOR', 'EN_PROCESO', 'REVISION', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoImportacion" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'CON_ERRORES', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ModoImportacion" AS ENUM ('REEMPLAZAR', 'AGREGAR', 'SIMULAR');

-- CreateEnum
CREATE TYPE "EstadoValidacion" AS ENUM ('ACTIVA', 'RESUELTA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "SeveridadValidacion" AS ENUM ('ERROR', 'ADVERTENCIA', 'INFO');

-- CreateEnum
CREATE TYPE "TipoValidacion" AS ENUM ('CUADRE_BALANCE', 'SALDO_NEGATIVO', 'CUENTA_SIN_CLASIFICAR', 'CONSISTENCIA_EJERCICIO', 'NOTA_INCOMPLETA', 'PATRIMONIO_NETO');

-- CreateEnum
CREATE TYPE "RolEstudio" AS ENUM ('ADMIN', 'CONTADOR', 'JUNIOR');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('INFORMATIVA', 'CUANTITATIVA', 'POLITICA_CONTABLE');

-- CreateEnum
CREATE TYPE "TipoErrorTecnico" AS ENUM ('DATABASE', 'VALIDACION', 'IMPORTACION', 'CALCULO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "SeveridadError" AS ENUM ('CRITICO', 'ALTO', 'MEDIO', 'BAJO');

-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('RUBROS', 'CUENTAS', 'IMPORTACION', 'CLASIFICACION', 'VALIDACION', 'NOTAS', 'ESTADOS_CONTABLES', 'PATRIMONIO_NETO', 'PREVIEW', 'EXPORTACION', 'SOCIEDADES', 'AUDITORES', 'EJERCICIOS', 'CONFIGURACION_ESTUDIO');

-- CreateTable
CREATE TABLE "rubros_base" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estadoDestino" "EstadoDestino" NOT NULL,
    "seccionSSP" "SeccionSSP",
    "seccionEERR" "SeccionEERR",
    "naturalezaEsperada" "NaturalezaEsperada" NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubros_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubros_activos_estudio" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubros_activos_estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "domicilio" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estudios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudio_configuracion" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "colorPrimario" TEXT NOT NULL DEFAULT '#1a1a2e',
    "monedaDisplay" TEXT NOT NULL DEFAULT 'ARS',
    "decimalesDisplay" INTEGER NOT NULL DEFAULT 0,
    "mostrarNotasEnPreview" BOOLEAN NOT NULL DEFAULT true,
    "firmaDigitalHabilitada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estudio_configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_estudio" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolEstudio" NOT NULL DEFAULT 'JUNIOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sociedades" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "tipoPersona" "TipoPersona" NOT NULL DEFAULT 'JURIDICA',
    "domicilioLegal" TEXT,
    "actividadPpal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sociedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditores" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "matricula" TEXT,
    "consejoProfesional" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auditores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejercicios_contables" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "sociedadId" TEXT NOT NULL,
    "auditorId" TEXT,
    "ejercicioAnteriorId" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "denominacion" TEXT NOT NULL,
    "estado" "EstadoEjercicio" NOT NULL DEFAULT 'BORRADOR',
    "auditorSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejercicios_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeos_excel" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "columnasCodigo" TEXT[],
    "columnasNombre" TEXT[],
    "columnasDeudor" TEXT[],
    "columnasAcreedor" TEXT[],
    "filasOmitir" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeos_excel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones_excel" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "mapeoExcelId" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "hashArchivo" TEXT NOT NULL,
    "estado" "EstadoImportacion" NOT NULL DEFAULT 'PENDIENTE',
    "modo" "ModoImportacion" NOT NULL DEFAULT 'REEMPLAZAR',
    "mapeoSnapshot" JSONB,
    "totalFilas" INTEGER,
    "filasImportadas" INTEGER,
    "filasError" INTEGER,
    "erroresDetalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "importaciones_excel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "importacionExcelId" TEXT,
    "rubroBaseId" TEXT,
    "notaEjercicioId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "saldoDeudor" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoAcreedor" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoFinal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clasificadaManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_nota" (
    "id" TEXT NOT NULL,
    "estudioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoNota" NOT NULL,
    "contenido" TEXT,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "plantillaNotaId" TEXT,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoNota" NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_nota" (
    "id" TEXT NOT NULL,
    "notaEjercicioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "importeActual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "importeAnterior" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "esTotal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detalles_nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrimonio_neto_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ajusteCapital" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reservas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "resultadosNoAsignados" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "resultadoEjercicio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coeficienteREI" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrimonio_neto_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "errores_validacion" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "tipo" "TipoValidacion" NOT NULL,
    "severidad" "SeveridadValidacion" NOT NULL,
    "estado" "EstadoValidacion" NOT NULL DEFAULT 'ACTIVA',
    "mensaje" TEXT NOT NULL,
    "detalle" JSONB,
    "resueltaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "errores_validacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "errores_tecnicos_log" (
    "id" TEXT NOT NULL,
    "tipo" "TipoErrorTecnico" NOT NULL,
    "severidad" "SeveridadError" NOT NULL,
    "modulo" "ModuloSistema",
    "mensaje" TEXT NOT NULL,
    "stack" TEXT,
    "stackHash" TEXT,
    "contexto" JSONB,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "errores_tecnicos_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rubros_base_codigo_key" ON "rubros_base"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rubros_base_orden_key" ON "rubros_base"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "rubros_activos_estudio_estudioId_rubroId_key" ON "rubros_activos_estudio"("estudioId", "rubroId");

-- CreateIndex
CREATE UNIQUE INDEX "estudios_cuit_key" ON "estudios"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "estudio_configuracion_estudioId_key" ON "estudio_configuracion"("estudioId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_estudio_email_key" ON "usuarios_estudio"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sociedades_cuit_key" ON "sociedades"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "auditores_cuit_key" ON "auditores"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "ejercicios_contables_ejercicioAnteriorId_key" ON "ejercicios_contables"("ejercicioAnteriorId");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_contables_ejercicioId_codigo_key" ON "cuentas_contables"("ejercicioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "patrimonio_neto_ejercicio_ejercicioId_key" ON "patrimonio_neto_ejercicio"("ejercicioId");

-- CreateIndex
CREATE INDEX "errores_tecnicos_log_stackHash_idx" ON "errores_tecnicos_log"("stackHash");

-- CreateIndex
CREATE INDEX "errores_tecnicos_log_tipo_severidad_idx" ON "errores_tecnicos_log"("tipo", "severidad");

-- AddForeignKey
ALTER TABLE "rubros_activos_estudio" ADD CONSTRAINT "rubros_activos_estudio_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubros_activos_estudio" ADD CONSTRAINT "rubros_activos_estudio_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "rubros_base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudio_configuracion" ADD CONSTRAINT "estudio_configuracion_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_estudio" ADD CONSTRAINT "usuarios_estudio_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sociedades" ADD CONSTRAINT "sociedades_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditores" ADD CONSTRAINT "auditores_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_contables" ADD CONSTRAINT "ejercicios_contables_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_contables" ADD CONSTRAINT "ejercicios_contables_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "auditores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_contables" ADD CONSTRAINT "ejercicios_contables_ejercicioAnteriorId_fkey" FOREIGN KEY ("ejercicioAnteriorId") REFERENCES "ejercicios_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapeos_excel" ADD CONSTRAINT "mapeos_excel_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_excel" ADD CONSTRAINT "importaciones_excel_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones_excel" ADD CONSTRAINT "importaciones_excel_mapeoExcelId_fkey" FOREIGN KEY ("mapeoExcelId") REFERENCES "mapeos_excel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_importacionExcelId_fkey" FOREIGN KEY ("importacionExcelId") REFERENCES "importaciones_excel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_rubroBaseId_fkey" FOREIGN KEY ("rubroBaseId") REFERENCES "rubros_base"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_notaEjercicioId_fkey" FOREIGN KEY ("notaEjercicioId") REFERENCES "notas_ejercicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_nota" ADD CONSTRAINT "plantillas_nota_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_ejercicio" ADD CONSTRAINT "notas_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_ejercicio" ADD CONSTRAINT "notas_ejercicio_plantillaNotaId_fkey" FOREIGN KEY ("plantillaNotaId") REFERENCES "plantillas_nota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_nota" ADD CONSTRAINT "detalles_nota_notaEjercicioId_fkey" FOREIGN KEY ("notaEjercicioId") REFERENCES "notas_ejercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrimonio_neto_ejercicio" ADD CONSTRAINT "patrimonio_neto_ejercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "errores_validacion" ADD CONSTRAINT "errores_validacion_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
