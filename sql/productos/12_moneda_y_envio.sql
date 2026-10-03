-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 12 — Moneda por producto y modo de envío
-- Tabla: productos
--
-- EJECUTAR DESPUÉS de 02_productos.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- (El 11 —borrar el bucket viejo— todavía no está escrito: no se puede
-- correr hasta resubir las fotos. Este no lo espera.)
--
-- ── POR QUÉ ────────────────────────────────────────────────────
-- Dos cosas que el catálogo daba por sentadas y no son ciertas para
-- todo lo que se vende:
--
-- 1. QUE TODO SE COBRA EN PESOS. Un plotter importado se cotiza en
--    dólares. Hasta hoy el precio era un número sin moneda y se asumía
--    ARS en todos lados.
--
-- 2. QUE TODO SE PUEDE COTIZAR ONLINE. Un plotter de tizada mide
--    2,4 × 0,9 × 0,7 m. Envios.com directamente no lo cotiza, y aunque
--    lo hiciera, el flete de algo así cambia tanto según la dirección
--    que un número automático sería mentira.
--
-- ── LAS TRES COLUMNAS NUEVAS ───────────────────────────────────
--
--   moneda      'ARS' | 'USD'
--               En qué moneda está escrito `precio`.
--
--   cobro_modo  'online' | 'coordinar'
--               online    → checkout normal (MercadoPago / transferencia)
--               coordinar → no se paga en la web: el botón lleva a
--                           WhatsApp. Para lo que se cierra hablando.
--
--   envio_modo  'cotizar' | 'coordinar' | 'incluido'
--               cotizar   → lo de hoy: el comprador elige entre
--                           cotización automática y coordinar
--               coordinar → no se ofrece cotización automática, porque
--                           no la hay (el plotter)
--               incluido  → sin cargo, ya está en el precio
--
-- Los tres defaults son exactamente el comportamiento actual, así que
-- los productos que ya están cargados no cambian en nada.
--
-- ── EN DÓLARES NO SE PAGA ONLINE, Y LA BASE LO EXIGE ───────────
-- MercadoPago Argentina cobra SOLO en pesos. Se evaluó convertir a
-- pesos con una cotización cargada a mano, y se descartó: una
-- cotización que hay que acordarse de actualizar es una forma elegante
-- de vender barato el día que te olvidás.
--
-- Entonces la regla es: un producto en USD se coordina por WhatsApp,
-- siempre. No es una convención del frontend —que se puede saltear
-- pegándole al endpoint— sino una constraint: `productos_usd_coordina_check`
-- hace imposible guardar un producto en dólares con cobro online.
--
-- Por eso tampoco hay columnas de moneda en `producto_compras`: una
-- venta en dólares nunca llega al checkout, así que no habría qué
-- guardar ahí.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   alter table productos
--     drop column moneda, drop column cobro_modo, drop column envio_modo;
--   (no se pierde nada: son columnas nuevas con default, y ninguna
--    venta ni ningún producto viejo depende de ellas)
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.productos') is null then
    raise exception 'Falta correr 02_productos.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- COLUMNAS
-- ═══════════════════════════════════════════════════════════════

alter table productos
  add column if not exists moneda     text not null default 'ARS',
  add column if not exists cobro_modo text not null default 'online',
  add column if not exists envio_modo text not null default 'cotizar';

-- Las constraints van aparte de la columna: `add column if not exists`
-- con check inline no vuelve a aplicarse si la columna ya existía, así
-- que el script dejaría de garantizar lo que dice garantizar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_moneda_check') then
    alter table productos add constraint productos_moneda_check
      check (moneda in ('ARS', 'USD'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'productos_cobro_modo_check') then
    alter table productos add constraint productos_cobro_modo_check
      check (cobro_modo in ('online', 'coordinar'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'productos_envio_modo_check') then
    alter table productos add constraint productos_envio_modo_check
      check (envio_modo in ('cotizar', 'coordinar', 'incluido'));
  end if;

  -- La regla del negocio, en la base y no en el navegador.
  if not exists (select 1 from pg_constraint where conname = 'productos_usd_coordina_check') then
    alter table productos add constraint productos_usd_coordina_check
      check (moneda = 'ARS' or cobro_modo = 'coordinar');
  end if;
end $$;

comment on column productos.moneda     is 'Moneda en la que está escrito `precio`: ARS o USD. En USD el cobro es siempre coordinado.';
comment on column productos.cobro_modo is 'online = checkout web · coordinar = el botón lleva a WhatsApp, no se paga acá.';
comment on column productos.envio_modo is 'cotizar = el comprador elige · coordinar = sin cotización automática · incluido = sin cargo.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- Las columnas creadas, las constraints puestas y el catálogo intacto:
-- todo lo que ya estaba cargado tiene que seguir en ARS / online /
-- cotizar, que es como se comportaba antes de este script.
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Columnas nuevas en productos' as chequeo,
         (select count(*)::text from information_schema.columns
           where table_schema = 'public' and table_name = 'productos'
             and column_name in ('moneda', 'cobro_modo', 'envio_modo')) || ' de 3' as valor
  union all select 2, 'Constraints nuevas',
         (select count(*)::text from pg_constraint
           where conname in ('productos_moneda_check', 'productos_cobro_modo_check',
                             'productos_envio_modo_check', 'productos_usd_coordina_check')) || ' de 4'
  union all select 3, 'Productos como antes (ARS · online · cotizar)',
         (select count(*)::text from productos
           where moneda = 'ARS' and cobro_modo = 'online' and envio_modo = 'cotizar')
  union all select 4, 'Productos en dólares',
         (select count(*)::text from productos where moneda = 'USD')
  union all select 5, 'Productos que no se cotizan online',
         (select count(*)::text from productos where envio_modo <> 'cotizar')
) t order by orden;
