-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 03b — Guía de envío anulada
-- Columnas: producto_compras.envia_cancelado_en / _por_email
--
-- EJECUTAR DESPUÉS de 03_producto_compras.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- Va con letra y no con número para no correr la numeración del plan.
--
-- ── POR QUÉ ────────────────────────────────────────────────────
-- Una guía se puede anular en envia.com (por error de dirección, o
-- porque la venta se cayó). Hasta ahora el panel seguía mostrando
-- "Envío generado" con su tracking y su etiqueta, como si estuviera
-- vigente, y no dejaba generar una nueva porque ya había shipment_id.
--
-- Con estas dos columnas la anulación queda registrada, la ficha lo
-- muestra, y se puede volver a generar la guía.
--
-- No se borra el tracking ni la etiqueta vieja: son el rastro de que
-- esa guía existió, y sirven si después hay que reclamarle algo al
-- correo.
--
-- ── ADITIVO ────────────────────────────────────────────────────
-- Dos columnas nullable. Ninguna fila existente cambia. Correrlo dos
-- veces no hace nada.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   alter table producto_compras
--     drop column envia_cancelado_en, drop column envia_cancelado_por_email;
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.producto_compras') is null then
    raise exception 'Falta correr 03_producto_compras.sql antes de este script.';
  end if;
end $$;

alter table producto_compras
  add column if not exists envia_cancelado_en       timestamptz,
  add column if not exists envia_cancelado_por_email text;

comment on column producto_compras.envia_cancelado_en is
  'Cuándo se anuló la guía de envia.com. null = la guía vigente es la que '
  'figura en envia_shipment_id. Se limpia al generar una guía nueva.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'producto_compras'
  and column_name in ('envia_cancelado_en', 'envia_cancelado_por_email')
order by column_name;
