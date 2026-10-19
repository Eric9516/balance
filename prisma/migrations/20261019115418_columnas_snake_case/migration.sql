-- Columnas en snake_case.
--
-- Problema: las columnas estaban en camelCase ("ejercicioId", "fechaCierre"). En SQL escrito a mano
-- eso obliga a poner comillas en cada nombre, y un olvido falla de forma confusa (PostgreSQL pasa
-- a minúsculas lo que no lleva comillas). Las reglas por fila, las restricciones CHECK y los
-- disparadores de la Fase 2 se escriben a mano, así que conviene la convención estándar de
-- PostgreSQL. Las tablas ya estaban en snake_case.
--
-- El código de la app no cambia: schema.prisma mapea cada campo con @map, y Prisma sigue usando
-- los nombres de siempre (ejercicioId, fechaCierre...).
--
-- Cómo: RENAME COLUMN es solo metadato. No reescribe ni copia datos, es instantáneo y conserva
-- índices, claves y valores por defecto. Se escribió a mano a propósito: si se deja que Prisma lo
-- genere, lo interpreta como "borrar columna y crear otra" y se pierden los datos. Después se
-- renombran los índices y claves foráneas al nombre que Prisma espera (generado con
-- `prisma migrate diff`), así el historial y el esquema no tienen deriva.
--
-- Los tipos enumerados ("EstadoEjercicio", ...) conservan su nombre.
--
-- Para revertir (en una migración nueva): los mismos RENAME en sentido inverso.

-- ─── Columnas ────────────────────────────────────────────────────────────────

ALTER TABLE "rubros_grupo" RENAME COLUMN "esGasto" TO "es_gasto";
ALTER TABLE "rubros_grupo" RENAME COLUMN "aparecEnEERR" TO "aparec_en_eerr";
ALTER TABLE "rubros_grupo" RENAME COLUMN "estadoDestino" TO "estado_destino";
ALTER TABLE "rubros_grupo" RENAME COLUMN "seccionSSP" TO "seccion_ssp";
ALTER TABLE "rubros_grupo" RENAME COLUMN "seccionEERR" TO "seccion_eerr";
ALTER TABLE "rubros_grupo" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "rubros_grupo" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "rubros_base" RENAME COLUMN "rubroGrupoId" TO "rubro_grupo_id";
ALTER TABLE "rubros_base" RENAME COLUMN "estadoDestino" TO "estado_destino";
ALTER TABLE "rubros_base" RENAME COLUMN "seccionSSP" TO "seccion_ssp";
ALTER TABLE "rubros_base" RENAME COLUMN "seccionEERR" TO "seccion_eerr";
ALTER TABLE "rubros_base" RENAME COLUMN "naturalezaEsperada" TO "naturaleza_esperada";
ALTER TABLE "rubros_base" RENAME COLUMN "generaNotaInformativa" TO "genera_nota_informativa";
ALTER TABLE "rubros_base" RENAME COLUMN "esEfectivo" TO "es_efectivo";
ALTER TABLE "rubros_base" RENAME COLUMN "textoNotaDefault" TO "texto_nota_default";
ALTER TABLE "rubros_base" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "rubros_base" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "rubros_activos_estudio" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "rubros_activos_estudio" RENAME COLUMN "rubroId" TO "rubro_id";
ALTER TABLE "rubros_activos_estudio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "estudios" RENAME COLUMN "razonSocial" TO "razon_social";
ALTER TABLE "estudios" RENAME COLUMN "tipoPersona" TO "tipo_persona";
ALTER TABLE "estudios" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "estudios" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "logoUrl" TO "logo_url";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "colorPrimario" TO "color_primario";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "densidadTablas" TO "densidad_tablas";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "monedaDisplay" TO "moneda_display";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "decimalesDisplay" TO "decimales_display";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "mostrarNotasEnPreview" TO "mostrar_notas_en_preview";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "firmaDigitalHabilitada" TO "firma_digital_habilitada";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "estudio_configuracion" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "usuarios_estudio" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "usuarios_estudio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "usuarios_estudio" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "sociedades" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "sociedades" RENAME COLUMN "razonSocial" TO "razon_social";
ALTER TABLE "sociedades" RENAME COLUMN "tipoPersona" TO "tipo_persona";
ALTER TABLE "sociedades" RENAME COLUMN "tipoSocietario" TO "tipo_societario";
ALTER TABLE "sociedades" RENAME COLUMN "condicionFiscal" TO "condicion_fiscal";
ALTER TABLE "sociedades" RENAME COLUMN "domicilioLegal" TO "domicilio_legal";
ALTER TABLE "sociedades" RENAME COLUMN "codigoPostal" TO "codigo_postal";
ALTER TABLE "sociedades" RENAME COLUMN "actividadPpal" TO "actividad_ppal";
ALTER TABLE "sociedades" RENAME COLUMN "actividadSecundaria" TO "actividad_secundaria";
ALTER TABLE "sociedades" RENAME COLUMN "clasificacionRT54" TO "clasificacion_rt54";
ALTER TABLE "sociedades" RENAME COLUMN "categoriaEnte" TO "categoria_ente";
ALTER TABLE "sociedades" RENAME COLUMN "fechaInscripcion" TO "fecha_inscripcion";
ALTER TABLE "sociedades" RENAME COLUMN "matriculaPJ" TO "matricula_pj";
ALTER TABLE "sociedades" RENAME COLUMN "plazoDuracion" TO "plazo_duracion";
ALTER TABLE "sociedades" RENAME COLUMN "composicionCapital" TO "composicion_capital";
ALTER TABLE "sociedades" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "sociedades" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "auditores" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "auditores" RENAME COLUMN "tituloProfesional" TO "titulo_profesional";
ALTER TABLE "auditores" RENAME COLUMN "consejoProfesional" TO "consejo_profesional";
ALTER TABLE "auditores" RENAME COLUMN "localidadInforme" TO "localidad_informe";
ALTER TABLE "auditores" RENAME COLUMN "textoFirma" TO "texto_firma";
ALTER TABLE "auditores" RENAME COLUMN "firmaImagenUrl" TO "firma_imagen_url";
ALTER TABLE "auditores" RENAME COLUMN "esDefault" TO "es_default";
ALTER TABLE "auditores" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "auditores" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "sociedadId" TO "sociedad_id";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "auditorId" TO "auditor_id";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "ejercicioAnteriorId" TO "ejercicio_anterior_id";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "numeroEjercicio" TO "numero_ejercicio";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "fechaInicio" TO "fecha_inicio";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "fechaCierre" TO "fecha_cierre";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "fechaInformeAuditor" TO "fecha_informe_auditor";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "clasificacionEntidad" TO "clasificacion_entidad";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "indiceInflacionAnterior" TO "indice_inflacion_anterior";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "indiceInflacionActual" TO "indice_inflacion_actual";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "adopcionRT54" TO "adopcion_rt54";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "criteriosBienesCambio" TO "criterios_bienes_cambio";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "hechosPosterioress" TO "hechos_posterioress";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "hechosPosterioressTexto" TO "hechos_posterioress_texto";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "pnConfirmado" TO "pn_confirmado";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "estadosConfirmado" TO "estados_confirmado";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "modoAnterior" TO "modo_anterior";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "comparativoAutorizadoEn" TO "comparativo_autorizado_en";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "comparativoAutorizadoPor" TO "comparativo_autorizado_por";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "categoriaEnte" TO "categoria_ente";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "balanceAnteriorDisponible" TO "balance_anterior_disponible";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "nivelComparativoSSP" TO "nivel_comparativo_ssp";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "auditorSnapshot" TO "auditor_snapshot";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ejercicios_contables" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "mapeos_excel" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "mapeos_excel" RENAME COLUMN "columnasCodigo" TO "columnas_codigo";
ALTER TABLE "mapeos_excel" RENAME COLUMN "columnasNombre" TO "columnas_nombre";
ALTER TABLE "mapeos_excel" RENAME COLUMN "columnasDeudor" TO "columnas_deudor";
ALTER TABLE "mapeos_excel" RENAME COLUMN "columnasAcreedor" TO "columnas_acreedor";
ALTER TABLE "mapeos_excel" RENAME COLUMN "filasOmitir" TO "filas_omitir";
ALTER TABLE "mapeos_excel" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "mapeos_excel" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "importaciones_excel" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "importaciones_excel" RENAME COLUMN "mapeoExcelId" TO "mapeo_excel_id";
ALTER TABLE "importaciones_excel" RENAME COLUMN "nombreArchivo" TO "nombre_archivo";
ALTER TABLE "importaciones_excel" RENAME COLUMN "hashArchivo" TO "hash_archivo";
ALTER TABLE "importaciones_excel" RENAME COLUMN "mapeoSnapshot" TO "mapeo_snapshot";
ALTER TABLE "importaciones_excel" RENAME COLUMN "totalFilas" TO "total_filas";
ALTER TABLE "importaciones_excel" RENAME COLUMN "filasImportadas" TO "filas_importadas";
ALTER TABLE "importaciones_excel" RENAME COLUMN "filasError" TO "filas_error";
ALTER TABLE "importaciones_excel" RENAME COLUMN "erroresDetalle" TO "errores_detalle";
ALTER TABLE "importaciones_excel" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "importaciones_excel" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "cuentas_contables" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "cuentas_contables" RENAME COLUMN "importacionExcelId" TO "importacion_excel_id";
ALTER TABLE "cuentas_contables" RENAME COLUMN "rubroBaseId" TO "rubro_base_id";
ALTER TABLE "cuentas_contables" RENAME COLUMN "notaEjercicioId" TO "nota_ejercicio_id";
ALTER TABLE "cuentas_contables" RENAME COLUMN "saldoDeudor" TO "saldo_deudor";
ALTER TABLE "cuentas_contables" RENAME COLUMN "saldoAcreedor" TO "saldo_acreedor";
ALTER TABLE "cuentas_contables" RENAME COLUMN "saldoFinal" TO "saldo_final";
ALTER TABLE "cuentas_contables" RENAME COLUMN "clasificadaManual" TO "clasificada_manual";
ALTER TABLE "cuentas_contables" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "cuentas_contables" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "plantillas_nota" RENAME COLUMN "estudioId" TO "estudio_id";
ALTER TABLE "plantillas_nota" RENAME COLUMN "criterioMedicion" TO "criterio_medicion";
ALTER TABLE "plantillas_nota" RENAME COLUMN "textoApertura" TO "texto_apertura";
ALTER TABLE "plantillas_nota" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "plantillas_nota" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "plantillaNotaId" TO "plantilla_nota_id";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "criterioMedicion" TO "criterio_medicion";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "textoApertura" TO "texto_apertura";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "notas_ejercicio" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "detalles_nota" RENAME COLUMN "notaEjercicioId" TO "nota_ejercicio_id";
ALTER TABLE "detalles_nota" RENAME COLUMN "importeActual" TO "importe_actual";
ALTER TABLE "detalles_nota" RENAME COLUMN "importeAnterior" TO "importe_anterior";
ALTER TABLE "detalles_nota" RENAME COLUMN "esTotal" TO "es_total";
ALTER TABLE "detalles_nota" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "detalles_nota" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "capitalSuscripto" TO "capital_suscripto";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "ajusteCapital" TO "ajuste_capital";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "aportesIrrevocables" TO "aportes_irrevocables";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "reservaLegal" TO "reserva_legal";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "otrasReservas" TO "otras_reservas";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "rdosNoAsignados" TO "rdos_no_asignados";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "totalAnterior" TO "total_anterior";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "evolucion_pn_movimientos" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "saldoInicial" TO "saldo_inicial";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "modificacionesEjAnt" TO "modificaciones_ej_ant";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "saldoFinal" TO "saldo_final";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "saldoInicialAnterior" TO "saldo_inicial_anterior";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "modificacionesEjAntAnt" TO "modificaciones_ej_ant_ant";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "saldoFinalAnterior" TO "saldo_final_anterior";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "flujo_caja_ejercicio" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "flujo_caja_items" RENAME COLUMN "flujoId" TO "flujo_id";
ALTER TABLE "flujo_caja_items" RENAME COLUMN "importeAnterior" TO "importe_anterior";
ALTER TABLE "flujo_caja_items" RENAME COLUMN "esSubtotal" TO "es_subtotal";
ALTER TABLE "flujo_caja_items" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "flujo_caja_items" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "costoInicioReexpresado" TO "costo_inicio_reexpresado";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "costoAjusteInflacion" TO "costo_ajuste_inflacion";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "costoFinReexpresado" TO "costo_fin_reexpresado";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "depAcumInicio" TO "dep_acum_inicio";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "depAjusteInflacion" TO "dep_ajuste_inflacion";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "depEjercicio" TO "dep_ejercicio";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "depBajas" TO "dep_bajas";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "depAcumFin" TO "dep_acum_fin";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "netoResidualAnteriorManual" TO "neto_residual_anterior_manual";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "bienes_de_uso_categorias" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "existenciaInicial" TO "existencia_inicial";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "gastosFabricacion" TO "gastos_fabricacion";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "existenciaFinal" TO "existencia_final";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "costo_ventas_ejercicio" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "errores_validacion" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "errores_validacion" RENAME COLUMN "resueltaEn" TO "resuelta_en";
ALTER TABLE "errores_validacion" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "errores_validacion" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "errores_tecnicos_log" RENAME COLUMN "stackHash" TO "stack_hash";
ALTER TABLE "errores_tecnicos_log" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "comparativo_manual" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "comparativo_manual" RENAME COLUMN "esHuerfano" TO "es_huerfano";
ALTER TABLE "documentos_ejercicio" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "documentos_ejercicio" RENAME COLUMN "reglaClave" TO "regla_clave";
ALTER TABLE "documentos_ejercicio" RENAME COLUMN "saldoAlAceptar" TO "saldo_al_aceptar";
ALTER TABLE "documentos_ejercicio" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "documentos_ejercicio" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "ejercicioId" TO "ejercicio_id";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "componentePN" TO "componente_pn";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "importePN" TO "importe_pn";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "importeResultadoAnterior" TO "importe_resultado_anterior";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "rubroOrigen" TO "rubro_origen";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "rubroDestino" TO "rubro_destino";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "importeReclasificado" TO "importe_reclasificado";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ajustes_transicion_rt54" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "gasto_seccion_config" RENAME COLUMN "aparecEnEERR" TO "aparec_en_eerr";

-- ─── Índices y claves foráneas (nombres que deriva Prisma) ──────────────────

-- RenameForeignKey
ALTER TABLE "ajustes_transicion_rt54" RENAME CONSTRAINT "ajustes_transicion_rt54_ejercicioId_fkey" TO "ajustes_transicion_rt54_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "auditores" RENAME CONSTRAINT "auditores_estudioId_fkey" TO "auditores_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "bienes_de_uso_categorias" RENAME CONSTRAINT "bienes_de_uso_categorias_ejercicioId_fkey" TO "bienes_de_uso_categorias_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "comparativo_manual" RENAME CONSTRAINT "comparativo_manual_ejercicioId_fkey" TO "comparativo_manual_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "costo_ventas_ejercicio" RENAME CONSTRAINT "costo_ventas_ejercicio_ejercicioId_fkey" TO "costo_ventas_ejercicio_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "cuentas_contables" RENAME CONSTRAINT "cuentas_contables_ejercicioId_fkey" TO "cuentas_contables_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "cuentas_contables" RENAME CONSTRAINT "cuentas_contables_importacionExcelId_fkey" TO "cuentas_contables_importacion_excel_id_fkey";

-- RenameForeignKey
ALTER TABLE "cuentas_contables" RENAME CONSTRAINT "cuentas_contables_notaEjercicioId_fkey" TO "cuentas_contables_nota_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "cuentas_contables" RENAME CONSTRAINT "cuentas_contables_rubroBaseId_fkey" TO "cuentas_contables_rubro_base_id_fkey";

-- RenameForeignKey
ALTER TABLE "detalles_nota" RENAME CONSTRAINT "detalles_nota_notaEjercicioId_fkey" TO "detalles_nota_nota_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "documentos_ejercicio" RENAME CONSTRAINT "documentos_ejercicio_ejercicioId_fkey" TO "documentos_ejercicio_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "ejercicios_contables" RENAME CONSTRAINT "ejercicios_contables_auditorId_fkey" TO "ejercicios_contables_auditor_id_fkey";

-- RenameForeignKey
ALTER TABLE "ejercicios_contables" RENAME CONSTRAINT "ejercicios_contables_ejercicioAnteriorId_fkey" TO "ejercicios_contables_ejercicio_anterior_id_fkey";

-- RenameForeignKey
ALTER TABLE "ejercicios_contables" RENAME CONSTRAINT "ejercicios_contables_sociedadId_fkey" TO "ejercicios_contables_sociedad_id_fkey";

-- RenameForeignKey
ALTER TABLE "errores_validacion" RENAME CONSTRAINT "errores_validacion_ejercicioId_fkey" TO "errores_validacion_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "estudio_configuracion" RENAME CONSTRAINT "estudio_configuracion_estudioId_fkey" TO "estudio_configuracion_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "evolucion_pn_movimientos" RENAME CONSTRAINT "evolucion_pn_movimientos_ejercicioId_fkey" TO "evolucion_pn_movimientos_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "flujo_caja_ejercicio" RENAME CONSTRAINT "flujo_caja_ejercicio_ejercicioId_fkey" TO "flujo_caja_ejercicio_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "flujo_caja_items" RENAME CONSTRAINT "flujo_caja_items_flujoId_fkey" TO "flujo_caja_items_flujo_id_fkey";

-- RenameForeignKey
ALTER TABLE "importaciones_excel" RENAME CONSTRAINT "importaciones_excel_ejercicioId_fkey" TO "importaciones_excel_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "importaciones_excel" RENAME CONSTRAINT "importaciones_excel_mapeoExcelId_fkey" TO "importaciones_excel_mapeo_excel_id_fkey";

-- RenameForeignKey
ALTER TABLE "mapeos_excel" RENAME CONSTRAINT "mapeos_excel_estudioId_fkey" TO "mapeos_excel_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "notas_ejercicio" RENAME CONSTRAINT "notas_ejercicio_ejercicioId_fkey" TO "notas_ejercicio_ejercicio_id_fkey";

-- RenameForeignKey
ALTER TABLE "notas_ejercicio" RENAME CONSTRAINT "notas_ejercicio_plantillaNotaId_fkey" TO "notas_ejercicio_plantilla_nota_id_fkey";

-- RenameForeignKey
ALTER TABLE "plantillas_nota" RENAME CONSTRAINT "plantillas_nota_estudioId_fkey" TO "plantillas_nota_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "rubros_activos_estudio" RENAME CONSTRAINT "rubros_activos_estudio_estudioId_fkey" TO "rubros_activos_estudio_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "rubros_activos_estudio" RENAME CONSTRAINT "rubros_activos_estudio_rubroId_fkey" TO "rubros_activos_estudio_rubro_id_fkey";

-- RenameForeignKey
ALTER TABLE "rubros_base" RENAME CONSTRAINT "rubros_base_rubroGrupoId_fkey" TO "rubros_base_rubro_grupo_id_fkey";

-- RenameForeignKey
ALTER TABLE "sociedades" RENAME CONSTRAINT "sociedades_estudioId_fkey" TO "sociedades_estudio_id_fkey";

-- RenameForeignKey
ALTER TABLE "usuarios_estudio" RENAME CONSTRAINT "usuarios_estudio_estudioId_fkey" TO "usuarios_estudio_estudio_id_fkey";

-- RenameIndex
ALTER INDEX "ajustes_transicion_rt54_ejercicioId_idx" RENAME TO "ajustes_transicion_rt54_ejercicio_id_idx";

-- RenameIndex
ALTER INDEX "auditores_estudioId_idx" RENAME TO "auditores_estudio_id_idx";

-- RenameIndex
ALTER INDEX "bienes_de_uso_categorias_ejercicioId_categoria_key" RENAME TO "bienes_de_uso_categorias_ejercicio_id_categoria_key";

-- RenameIndex
ALTER INDEX "comparativo_manual_ejercicioId_modulo_clave_key" RENAME TO "comparativo_manual_ejercicio_id_modulo_clave_key";

-- RenameIndex
ALTER INDEX "costo_ventas_ejercicio_ejercicioId_key" RENAME TO "costo_ventas_ejercicio_ejercicio_id_key";

-- RenameIndex
ALTER INDEX "cuentas_contables_ejercicioId_codigo_key" RENAME TO "cuentas_contables_ejercicio_id_codigo_key";

-- RenameIndex
ALTER INDEX "cuentas_contables_ejercicioId_rubroBaseId_idx" RENAME TO "cuentas_contables_ejercicio_id_rubro_base_id_idx";

-- RenameIndex
ALTER INDEX "cuentas_contables_importacionExcelId_idx" RENAME TO "cuentas_contables_importacion_excel_id_idx";

-- RenameIndex
ALTER INDEX "cuentas_contables_notaEjercicioId_idx" RENAME TO "cuentas_contables_nota_ejercicio_id_idx";

-- RenameIndex
ALTER INDEX "cuentas_contables_rubroBaseId_idx" RENAME TO "cuentas_contables_rubro_base_id_idx";

-- RenameIndex
ALTER INDEX "detalles_nota_notaEjercicioId_idx" RENAME TO "detalles_nota_nota_ejercicio_id_idx";

-- RenameIndex
ALTER INDEX "documentos_ejercicio_ejercicioId_reglaClave_key" RENAME TO "documentos_ejercicio_ejercicio_id_regla_clave_key";

-- RenameIndex
ALTER INDEX "ejercicios_contables_auditorId_idx" RENAME TO "ejercicios_contables_auditor_id_idx";

-- RenameIndex
ALTER INDEX "ejercicios_contables_ejercicioAnteriorId_key" RENAME TO "ejercicios_contables_ejercicio_anterior_id_key";

-- RenameIndex
ALTER INDEX "ejercicios_contables_sociedadId_fechaCierre_idx" RENAME TO "ejercicios_contables_sociedad_id_fecha_cierre_idx";

-- RenameIndex
ALTER INDEX "errores_tecnicos_log_stackHash_idx" RENAME TO "errores_tecnicos_log_stack_hash_idx";

-- RenameIndex
ALTER INDEX "errores_validacion_ejercicioId_estado_idx" RENAME TO "errores_validacion_ejercicio_id_estado_idx";

-- RenameIndex
ALTER INDEX "estudio_configuracion_estudioId_key" RENAME TO "estudio_configuracion_estudio_id_key";

-- RenameIndex
ALTER INDEX "evolucion_pn_movimientos_ejercicioId_tipo_key" RENAME TO "evolucion_pn_movimientos_ejercicio_id_tipo_key";

-- RenameIndex
ALTER INDEX "flujo_caja_ejercicio_ejercicioId_key" RENAME TO "flujo_caja_ejercicio_ejercicio_id_key";

-- RenameIndex
ALTER INDEX "flujo_caja_items_flujoId_idx" RENAME TO "flujo_caja_items_flujo_id_idx";

-- RenameIndex
ALTER INDEX "importaciones_excel_ejercicioId_idx" RENAME TO "importaciones_excel_ejercicio_id_idx";

-- RenameIndex
ALTER INDEX "importaciones_excel_mapeoExcelId_idx" RENAME TO "importaciones_excel_mapeo_excel_id_idx";

-- RenameIndex
ALTER INDEX "mapeos_excel_estudioId_idx" RENAME TO "mapeos_excel_estudio_id_idx";

-- RenameIndex
ALTER INDEX "notas_ejercicio_ejercicioId_idx" RENAME TO "notas_ejercicio_ejercicio_id_idx";

-- RenameIndex
ALTER INDEX "notas_ejercicio_plantillaNotaId_idx" RENAME TO "notas_ejercicio_plantilla_nota_id_idx";

-- RenameIndex
ALTER INDEX "plantillas_nota_estudioId_idx" RENAME TO "plantillas_nota_estudio_id_idx";

-- RenameIndex
ALTER INDEX "rubros_activos_estudio_estudioId_rubroId_key" RENAME TO "rubros_activos_estudio_estudio_id_rubro_id_key";

-- RenameIndex
ALTER INDEX "rubros_activos_estudio_rubroId_idx" RENAME TO "rubros_activos_estudio_rubro_id_idx";

-- RenameIndex
ALTER INDEX "rubros_base_rubroGrupoId_idx" RENAME TO "rubros_base_rubro_grupo_id_idx";

-- RenameIndex
ALTER INDEX "sociedades_estudioId_idx" RENAME TO "sociedades_estudio_id_idx";

-- RenameIndex
ALTER INDEX "usuarios_estudio_estudioId_idx" RENAME TO "usuarios_estudio_estudio_id_idx";

