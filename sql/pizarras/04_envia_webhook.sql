-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 4 DE 4 — Columnas para el estado del envío (webhook envia.com)
-- Tabla: pizarras_compras
--
-- EJECUTAR DESPUÉS de 02_pizarras_compras.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

alter table pizarras_compras
  add column if not exists envia_estado                text,          -- último estado recibido de envia.com (ej: "picked_up", "in_transit", "delivered")
  add column if not exists envia_estado_actualizado_en  timestamptz,
  add column if not exists envia_webhook_raw            jsonb;         -- último payload crudo recibido, útil para depurar

create index if not exists pizarras_compras_shipment_idx
  on pizarras_compras (envia_shipment_id)
  where envia_shipment_id is not null;
