-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 04b — Créditos incluidos en un plan
-- Columna: producto_planes.creditos_por_unidad
--
-- EJECUTAR DESPUÉS de 04_producto_planes.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- Va con letra y no con número para no correr la numeración del plan:
-- el 06 sigue siendo nav_items, el 09 sigue siendo digitalizaciones.
--
-- ── POR QUÉ ────────────────────────────────────────────────────
-- Hasta acá los créditos emitidos eran iguales a la cantidad comprada.
-- Sirve para "Solo Software" (comprás 3 créditos, recibís 3), pero no
-- para un plan físico:
--
--   "Inicial" = 1 pizarra que INCLUYE 10 digitalizaciones
--   → cantidad comprada 1, pero créditos a emitir 10
--
-- Con esta columna:
--
--   créditos emitidos = cantidad comprada × creditos_por_unidad
--
--   Solo Software  → 3 × 1  = 3   (default, no cambia nada)
--   Inicial        → 1 × 10 = 10
--
-- ── ADITIVO ────────────────────────────────────────────────────
-- Una columna con default 1. Los 4 planes que ya existen quedan
-- exactamente como estaban. Correrlo dos veces no hace nada.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   alter table producto_planes drop column creditos_por_unidad;
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.producto_planes') is null then
    raise exception 'Falta correr 04_producto_planes.sql antes de este script.';
  end if;
end $$;

alter table producto_planes
  add column if not exists creditos_por_unidad integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'producto_planes_creditos_por_unidad_check') then
    alter table producto_planes
      add constraint producto_planes_creditos_por_unidad_check
      check (creditos_por_unidad >= 1);
  end if;
end $$;

comment on column producto_planes.creditos_por_unidad is
  'Créditos de digitalización que entrega cada unidad comprada. Solo se usa '
  'si otorga_creditos = true. Ej: "Inicial" vende 1 pizarra con 10 '
  'digitalizaciones incluidas → 10.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — "creditos_a_emitir" es lo que recibiría alguien que
-- compra la cantidad mínima de cada plan.
-- ═══════════════════════════════════════════════════════════════

select pl.orden,
       pl.nombre                                    as plan,
       pl.otorga_creditos                           as emite,
       pl.creditos_por_unidad                       as por_unidad,
       pl.cantidad_min || '-' || pl.cantidad_max    as cantidad,
       case when pl.otorga_creditos
            then (pl.cantidad_min * pl.creditos_por_unidad)::text
            else '—' end                            as creditos_a_emitir
from producto_planes pl
where pl.eliminado_en is null
order by pl.orden;
