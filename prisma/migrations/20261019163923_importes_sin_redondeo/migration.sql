-- Importes e índices de inflación sin redondeo al guardar.
--
-- Problema: las columnas de importes eran numeric(18,2) y las de índices de inflación numeric(18,6).
-- PostgreSQL redondea en silencio cualquier valor con más decimales al guardarlo: un importe
-- reexpresado por el coeficiente (1.000,01 × 1,25 = 1.250,0125) quedaba guardado como 1.250,01.
-- Regla primordial de BalanceRT: jamás se redondea nada (CLAUDE.md y docs/decisiones/0009).
--
-- Cambio:
-- - Las 42 columnas pasan a numeric sin escala, que guarda exactamente el valor que recibe.
-- - No se reescribe ninguna tabla ni cambia ningún dato guardado: quitar la escala de un numeric
--   solo cambia la definición de la columna.
-- - Se conserva el tope de tamaño que imponía la definición anterior con un CHECK por columna:
--   menos de 16 dígitos enteros en importes y menos de 12 en índices. El CHECK además rechaza NaN e
--   infinito, que no son importes.
--
-- Cómo revertir: quitar los CHECK "<tabla>_<columna>_rango" y volver cada columna a numeric(18,2),
-- o numeric(18,6) en los índices. Al volver, PostgreSQL redondea los valores guardados con más
-- decimales, así que antes hay que decidir qué hacer con ellos.

ALTER TABLE "ajustes_transicion_rt54"
  ALTER COLUMN "importe_pn" SET DATA TYPE DECIMAL,
  ALTER COLUMN "importe_resultado_anterior" SET DATA TYPE DECIMAL,
  ALTER COLUMN "importe_reclasificado" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "ajustes_transicion_rt54_importe_pn_rango" CHECK (abs("importe_pn") < 1e16),
  ADD CONSTRAINT "ajustes_transicion_rt54_importe_resultado_anterior_rango" CHECK (abs("importe_resultado_anterior") < 1e16),
  ADD CONSTRAINT "ajustes_transicion_rt54_importe_reclasificado_rango" CHECK (abs("importe_reclasificado") < 1e16);

ALTER TABLE "bienes_de_uso_categorias"
  ALTER COLUMN "costo_inicio_reexpresado" SET DATA TYPE DECIMAL,
  ALTER COLUMN "altas" SET DATA TYPE DECIMAL,
  ALTER COLUMN "bajas" SET DATA TYPE DECIMAL,
  ALTER COLUMN "costo_fin_reexpresado" SET DATA TYPE DECIMAL,
  ALTER COLUMN "dep_acum_inicio" SET DATA TYPE DECIMAL,
  ALTER COLUMN "dep_ejercicio" SET DATA TYPE DECIMAL,
  ALTER COLUMN "dep_bajas" SET DATA TYPE DECIMAL,
  ALTER COLUMN "dep_acum_fin" SET DATA TYPE DECIMAL,
  ALTER COLUMN "costo_ajuste_inflacion" SET DATA TYPE DECIMAL,
  ALTER COLUMN "dep_ajuste_inflacion" SET DATA TYPE DECIMAL,
  ALTER COLUMN "neto_residual_anterior_manual" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "bienes_de_uso_categorias_costo_inicio_reexpresado_rango" CHECK (abs("costo_inicio_reexpresado") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_altas_rango" CHECK (abs("altas") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_bajas_rango" CHECK (abs("bajas") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_costo_fin_reexpresado_rango" CHECK (abs("costo_fin_reexpresado") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_dep_acum_inicio_rango" CHECK (abs("dep_acum_inicio") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_dep_ejercicio_rango" CHECK (abs("dep_ejercicio") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_dep_bajas_rango" CHECK (abs("dep_bajas") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_dep_acum_fin_rango" CHECK (abs("dep_acum_fin") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_costo_ajuste_inflacion_rango" CHECK (abs("costo_ajuste_inflacion") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_dep_ajuste_inflacion_rango" CHECK (abs("dep_ajuste_inflacion") < 1e16),
  ADD CONSTRAINT "bienes_de_uso_categorias_neto_residual_anterior_manual_rango" CHECK (abs("neto_residual_anterior_manual") < 1e16);

ALTER TABLE "comparativo_manual"
  ALTER COLUMN "valor" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "comparativo_manual_valor_rango" CHECK (abs("valor") < 1e16);

ALTER TABLE "costo_ventas_ejercicio"
  ALTER COLUMN "existencia_inicial" SET DATA TYPE DECIMAL,
  ALTER COLUMN "compras" SET DATA TYPE DECIMAL,
  ALTER COLUMN "gastos_fabricacion" SET DATA TYPE DECIMAL,
  ALTER COLUMN "existencia_final" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "costo_ventas_ejercicio_existencia_inicial_rango" CHECK (abs("existencia_inicial") < 1e16),
  ADD CONSTRAINT "costo_ventas_ejercicio_compras_rango" CHECK (abs("compras") < 1e16),
  ADD CONSTRAINT "costo_ventas_ejercicio_gastos_fabricacion_rango" CHECK (abs("gastos_fabricacion") < 1e16),
  ADD CONSTRAINT "costo_ventas_ejercicio_existencia_final_rango" CHECK (abs("existencia_final") < 1e16);

ALTER TABLE "cuentas_contables"
  ALTER COLUMN "saldo_deudor" SET DATA TYPE DECIMAL,
  ALTER COLUMN "saldo_acreedor" SET DATA TYPE DECIMAL,
  ALTER COLUMN "saldo_final" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "cuentas_contables_saldo_deudor_rango" CHECK (abs("saldo_deudor") < 1e16),
  ADD CONSTRAINT "cuentas_contables_saldo_acreedor_rango" CHECK (abs("saldo_acreedor") < 1e16),
  ADD CONSTRAINT "cuentas_contables_saldo_final_rango" CHECK (abs("saldo_final") < 1e16);

ALTER TABLE "detalles_nota"
  ALTER COLUMN "importe_actual" SET DATA TYPE DECIMAL,
  ALTER COLUMN "importe_anterior" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "detalles_nota_importe_actual_rango" CHECK (abs("importe_actual") < 1e16),
  ADD CONSTRAINT "detalles_nota_importe_anterior_rango" CHECK (abs("importe_anterior") < 1e16);

ALTER TABLE "documentos_ejercicio"
  ALTER COLUMN "saldo_al_aceptar" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "documentos_ejercicio_saldo_al_aceptar_rango" CHECK (abs("saldo_al_aceptar") < 1e16);

ALTER TABLE "ejercicios_contables"
  ALTER COLUMN "indice_inflacion_actual" SET DATA TYPE DECIMAL,
  ALTER COLUMN "indice_inflacion_anterior" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "ejercicios_contables_indice_inflacion_actual_rango" CHECK (abs("indice_inflacion_actual") < 1e12),
  ADD CONSTRAINT "ejercicios_contables_indice_inflacion_anterior_rango" CHECK (abs("indice_inflacion_anterior") < 1e12);

ALTER TABLE "evolucion_pn_movimientos"
  ALTER COLUMN "capital_suscripto" SET DATA TYPE DECIMAL,
  ALTER COLUMN "ajuste_capital" SET DATA TYPE DECIMAL,
  ALTER COLUMN "aportes_irrevocables" SET DATA TYPE DECIMAL,
  ALTER COLUMN "reserva_legal" SET DATA TYPE DECIMAL,
  ALTER COLUMN "otras_reservas" SET DATA TYPE DECIMAL,
  ALTER COLUMN "rdos_no_asignados" SET DATA TYPE DECIMAL,
  ALTER COLUMN "total_anterior" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "evolucion_pn_movimientos_capital_suscripto_rango" CHECK (abs("capital_suscripto") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_ajuste_capital_rango" CHECK (abs("ajuste_capital") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_aportes_irrevocables_rango" CHECK (abs("aportes_irrevocables") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_reserva_legal_rango" CHECK (abs("reserva_legal") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_otras_reservas_rango" CHECK (abs("otras_reservas") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_rdos_no_asignados_rango" CHECK (abs("rdos_no_asignados") < 1e16),
  ADD CONSTRAINT "evolucion_pn_movimientos_total_anterior_rango" CHECK (abs("total_anterior") < 1e16);

ALTER TABLE "flujo_caja_ejercicio"
  ALTER COLUMN "saldo_inicial" SET DATA TYPE DECIMAL,
  ALTER COLUMN "saldo_final" SET DATA TYPE DECIMAL,
  ALTER COLUMN "saldo_inicial_anterior" SET DATA TYPE DECIMAL,
  ALTER COLUMN "saldo_final_anterior" SET DATA TYPE DECIMAL,
  ALTER COLUMN "modificaciones_ej_ant" SET DATA TYPE DECIMAL,
  ALTER COLUMN "modificaciones_ej_ant_ant" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "flujo_caja_ejercicio_saldo_inicial_rango" CHECK (abs("saldo_inicial") < 1e16),
  ADD CONSTRAINT "flujo_caja_ejercicio_saldo_final_rango" CHECK (abs("saldo_final") < 1e16),
  ADD CONSTRAINT "flujo_caja_ejercicio_saldo_inicial_anterior_rango" CHECK (abs("saldo_inicial_anterior") < 1e16),
  ADD CONSTRAINT "flujo_caja_ejercicio_saldo_final_anterior_rango" CHECK (abs("saldo_final_anterior") < 1e16),
  ADD CONSTRAINT "flujo_caja_ejercicio_modificaciones_ej_ant_rango" CHECK (abs("modificaciones_ej_ant") < 1e16),
  ADD CONSTRAINT "flujo_caja_ejercicio_modificaciones_ej_ant_ant_rango" CHECK (abs("modificaciones_ej_ant_ant") < 1e16);

ALTER TABLE "flujo_caja_items"
  ALTER COLUMN "importe" SET DATA TYPE DECIMAL,
  ALTER COLUMN "importe_anterior" SET DATA TYPE DECIMAL,
  ADD CONSTRAINT "flujo_caja_items_importe_rango" CHECK (abs("importe") < 1e16),
  ADD CONSTRAINT "flujo_caja_items_importe_anterior_rango" CHECK (abs("importe_anterior") < 1e16);
