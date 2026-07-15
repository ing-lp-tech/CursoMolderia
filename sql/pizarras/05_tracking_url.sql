-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 5 DE 5 — Columna para el link de rastreo del envío
-- Tabla: pizarras_compras
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

alter table pizarras_compras
  add column if not exists envia_tracking_url text; -- link público de rastreo (trackUrl de envia.com)
