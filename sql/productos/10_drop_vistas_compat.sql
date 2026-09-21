-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 10 — Borrar las vistas de compatibilidad
-- Vistas: pizarras, pizarras_compras
--
-- ⚠ FUERA DE ORDEN A PROPÓSITO: se corre a las 24-48 hs de la Etapa 1,
-- con el Checkpoint 1 ya verificado. No espera a los scripts 06-09.
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Los scripts 02 y 03 renombraron `pizarras` → `productos` y
-- `pizarras_compras` → `producto_compras`, y dejaron dos vistas con los
-- nombres viejos como red de seguridad. El deploy de Vercel y la
-- migración no ocurren en el mismo instante: sin las vistas, un cliente
-- con la página cacheada habría visto el catálogo vacío, y un POST del
-- endpoint viejo habría perdido la compra.
--
-- Esa ventana ya pasó. Las vistas solo agregan una capa que confunde a
-- quien lea el esquema dentro de seis meses.
--
-- ── LO QUE NO BORRA ────────────────────────────────────────────
-- Ninguna fila y ninguna tabla. Una vista es una consulta guardada: los
-- datos viven en `productos` y `producto_compras` y no se tocan.
--
-- ── ANTES DE CORRER ────────────────────────────────────────────
-- El bloque de verificación de abajo se aborta solo si encuentra algo
-- que todavía dependa de las vistas. Corré el script entero: si aborta,
-- no borró nada.
--
-- Los dos rewrites de `vercel.json` (/api/create-pizarra y
-- /api/pizarra-admin) son otra cosa y NO se tocan acá: apuntan a los
-- endpoints nuevos y no dependen de estas vistas.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
-- Volver a correr el bloque `create view` del final de 02_productos.sql
-- y de 03_producto_compras.sql. Las vistas se reconstruyen en un
-- segundo porque no guardan datos propios.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- GUARDA — que las tablas nuevas existan y tengan los datos
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  v_productos integer;
  v_compras   integer;
  v_dependen  integer;
begin
  if to_regclass('public.productos') is null
     or to_regclass('public.producto_compras') is null then
    raise exception 'Faltan las tablas nuevas: no corras esto sin 02 y 03.';
  end if;

  select count(*) into v_productos from productos;
  select count(*) into v_compras   from producto_compras;
  raise notice 'productos: % filas · producto_compras: % filas', v_productos, v_compras;

  -- Si alguien construyó otra vista, una función o una FK encima de las
  -- de compatibilidad, borrarlas en cascada se llevaría eso puesto.
  select count(*) into v_dependen
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class   c on c.oid = r.ev_class
  where d.refobjid in ('public.pizarras'::regclass, 'public.pizarras_compras'::regclass)
    and c.relname not in ('pizarras', 'pizarras_compras');

  if v_dependen > 0 then
    raise exception
      'Hay % objeto(s) dependiendo de las vistas de compatibilidad. Revisalos antes de borrarlas.',
      v_dependen;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- BORRADO
-- Sin `cascade` a propósito: si algo dependiera de ellas, preferimos que
-- falle acá y no enterarnos cuando ya se llevó puesto otro objeto.
-- ═══════════════════════════════════════════════════════════════

drop view if exists pizarras;
drop view if exists pizarras_compras;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — las vistas no están y las tablas siguen intactas
-- ═══════════════════════════════════════════════════════════════

select
  to_regclass('public.pizarras')          is null as vista_pizarras_borrada,
  to_regclass('public.pizarras_compras')  is null as vista_compras_borrada,
  (select count(*) from productos)                as productos,
  (select count(*) from producto_compras)         as compras;
