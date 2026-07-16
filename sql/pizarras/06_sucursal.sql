-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 6 — Columnas para la sucursal de destino elegida
-- Tabla: pizarras_compras
--
-- Necesario para servicios "a Sucursal" (ej: Correo Argentino a Sucursal),
-- que exigen un código de sucursal puntual al generar el envío.
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

alter table pizarras_compras
  add column if not exists sucursal_codigo    text,
  add column if not exists sucursal_nombre    text,
  add column if not exists sucursal_direccion text;
