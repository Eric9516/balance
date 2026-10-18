-- Regularización del historial de migraciones.
--
-- El schema.prisma creció después de la última migración (mayo 2026) y esas
-- diferencias se aplicaron con `prisma db push`. Esta migración lleva el
-- historial al estado real del schema y es IDEMPOTENTE: sobre una base que ya
-- tiene estos objetos no hace nada; sobre una base limpia los crea.
--
-- Si la base destino NUNCA corrió `prisma migrate` (no existe la tabla
-- _prisma_migrations), antes de `migrate deploy` hay que marcar como aplicadas
-- las migraciones previas con `prisma migrate resolve --applied <nombre>`.
-- Ver README, sección "Base de datos: migraciones".

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdopcionRT54') THEN
    CREATE TYPE "AdopcionRT54" AS ENUM ('PRIMERA_ADOPCION', 'APLICACION_CONTINUADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CriteriosBienesCambio') THEN
    CREATE TYPE "CriteriosBienesCambio" AS ENUM ('COSTO_ADQUISICION', 'ULTIMA_COMPRA', 'COSTO_REPOSICION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NivelComparativoSSP') THEN
    CREATE TYPE "NivelComparativoSSP" AS ENUM ('SECCION', 'RUBRO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoDocumento') THEN
    CREATE TYPE "TipoDocumento" AS ENUM ('ANEXO', 'NOTA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDocumento') THEN
    CREATE TYPE "EstadoDocumento" AS ENUM ('SUGERIDO', 'ACEPTADO', 'DESCARTADO', 'NO_APLICA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenDocumento') THEN
    CREATE TYPE "OrigenDocumento" AS ENUM ('AUTOMATICO', 'MANUAL');
  END IF;
END $$;

-- ─── Tabla legacy gastos_naturaleza (reemplazada por rubros_grupo) ───────────

ALTER TABLE IF EXISTS "gastos_naturaleza" DROP CONSTRAINT IF EXISTS "gastos_naturaleza_ejercicioId_fkey";
DROP TABLE IF EXISTS "gastos_naturaleza";

-- ─── auditores: cuit opcional y sin unique ───────────────────────────────────

DROP INDEX IF EXISTS "auditores_cuit_key";
ALTER TABLE "auditores" ALTER COLUMN "cuit" DROP NOT NULL;

-- ─── ejercicios_contables ────────────────────────────────────────────────────

ALTER TABLE "ejercicios_contables"
  ADD COLUMN IF NOT EXISTS "adopcionRT54" "AdopcionRT54",
  ADD COLUMN IF NOT EXISTS "balanceAnteriorDisponible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "criteriosBienesCambio" "CriteriosBienesCambio",
  ADD COLUMN IF NOT EXISTS "estadosConfirmado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hechosPosterioress" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hechosPosterioressTexto" TEXT,
  ADD COLUMN IF NOT EXISTS "nivelComparativoSSP" "NivelComparativoSSP",
  ADD COLUMN IF NOT EXISTS "pnConfirmado" BOOLEAN NOT NULL DEFAULT false;

-- ─── rubros_base ─────────────────────────────────────────────────────────────

ALTER TABLE "rubros_base"
  ADD COLUMN IF NOT EXISTS "generaNotaInformativa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rubroGrupoId" TEXT,
  ADD COLUMN IF NOT EXISTS "textoNotaDefault" TEXT;

-- ─── Tablas nuevas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rubros_grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sigla" TEXT,
    "esGasto" BOOLEAN NOT NULL DEFAULT false,
    "aparecEnEERR" BOOLEAN NOT NULL DEFAULT true,
    "estadoDestino" "EstadoDestino",
    "seccionSSP" "SeccionSSP",
    "seccionEERR" "SeccionEERR",
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubros_grupo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comparativo_manual" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "esHuerfano" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comparativo_manual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "documentos_ejercicio" (
    "id" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "reglaClave" TEXT,
    "tipo" "TipoDocumento" NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'SUGERIDO',
    "origen" "OrigenDocumento" NOT NULL DEFAULT 'AUTOMATICO',
    "saldoAlAceptar" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_ejercicio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gasto_seccion_config" (
    "clave" TEXT NOT NULL,
    "aparecEnEERR" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 9999,

    CONSTRAINT "gasto_seccion_config_pkey" PRIMARY KEY ("clave")
);

-- ─── Índices ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "comparativo_manual_ejercicioId_modulo_clave_key" ON "comparativo_manual"("ejercicioId", "modulo", "clave");
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_ejercicio_ejercicioId_reglaClave_key" ON "documentos_ejercicio"("ejercicioId", "reglaClave");

-- ─── Claves foráneas ─────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rubros_base_rubroGrupoId_fkey') THEN
    ALTER TABLE "rubros_base" ADD CONSTRAINT "rubros_base_rubroGrupoId_fkey"
      FOREIGN KEY ("rubroGrupoId") REFERENCES "rubros_grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comparativo_manual_ejercicioId_fkey') THEN
    ALTER TABLE "comparativo_manual" ADD CONSTRAINT "comparativo_manual_ejercicioId_fkey"
      FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_ejercicio_ejercicioId_fkey') THEN
    ALTER TABLE "documentos_ejercicio" ADD CONSTRAINT "documentos_ejercicio_ejercicioId_fkey"
      FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
