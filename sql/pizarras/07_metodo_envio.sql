-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 7 — Método de envío: automático (envia.com) o coordinar por WhatsApp
-- Tabla: pizarras_compras
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

alter table pizarras_compras
  add column if not exists metodo_envio text not null default 'envia'
    check (metodo_envio in ('envia', 'coordinar'));
