-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 03 — pizarras_compras → producto_compras
-- Tabla: producto_compras + vista de compatibilidad `pizarras_compras`
--
-- EJECUTAR DESPUÉS de 02_productos.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Renombra la tabla de ventas y tres de sus columnas. Toda la
-- maquinaria de envío (dirección, carrier, sucursal, tracking,
-- etiqueta, webhook, coordinar por WhatsApp) queda intacta.
--
-- ── RED DE SEGURIDAD ───────────────────────────────────────────
-- Crea la vista `pizarras_compras` con los nombres viejos de columna,
-- así el endpoint que hoy está deployado sigue registrando compras
-- sin perder una sola venta. Se borra con el script 10.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop view if exists pizarras_compras;
--   alter table producto_compras rename to pizarras_compras;
--   alter table pizarras_compras rename column producto_id to pizarra_id;
--   alter table pizarras_compras rename column titulo_producto to titulo_pizarra;
--   alter table pizarras_compras rename column precio_base_producto to precio_base_pizarra;
--   alter table pizarras_compras drop column categoria_producto, drop column cantidad;
-- ═══════════════════════════════════════════════════════════════

-- ─── Guardas de seguridad ──────────────────────────────────────

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL % no soporta security_invoker. PARAR y avisar.',
      current_setting('server_version');
  end if;

  if to_regclass('public.productos') is null then
    raise exception 'Falta correr 02_productos.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 1 — Renombrar la tabla
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pizarras_compras' and c.relkind = 'r'
  ) then
    alter table pizarras_compras rename to producto_compras;
    raise notice 'Tabla pizarras_compras renombrada a producto_compras';
  else
    raise notice 'La tabla pizarras_compras ya fue renombrada — se saltea el paso 1';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 2 — Renombrar las tres columnas que nombran a la pizarra
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'producto_compras'
               and column_name = 'pizarra_id') then
    alter table producto_compras rename column pizarra_id to producto_id;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'producto_compras'
               and column_name = 'titulo_pizarra') then
    alter table producto_compras rename column titulo_pizarra to titulo_producto;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'producto_compras'
               and column_name = 'precio_base_pizarra') then
    alter table producto_compras rename column precio_base_pizarra to precio_base_producto;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 3 — Renombrar la constraint FK
--
-- Esto NO es cosmético: el panel usa el nombre literal de la constraint
-- para traer el producto junto con la compra
-- (`productos!producto_compras_producto_id_fkey(...)`).
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'pizarras_compras_pizarra_id_fkey') then
    alter table producto_compras
      rename constraint pizarras_compras_pizarra_id_fkey to producto_compras_producto_id_fkey;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 4 — Renombrar índices y policies
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_class where relname = 'pizarras_compras_pkey' and relkind = 'i') then
    alter index pizarras_compras_pkey rename to producto_compras_pkey;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_compras_estado_idx' and relkind = 'i') then
    alter index pizarras_compras_estado_idx rename to producto_compras_estado_idx;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_compras_metodo_idx' and relkind = 'i') then
    alter index pizarras_compras_metodo_idx rename to producto_compras_metodo_idx;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_compras_pizarra_idx' and relkind = 'i') then
    alter index pizarras_compras_pizarra_idx rename to producto_compras_producto_idx;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_compras_shipment_idx' and relkind = 'i') then
    alter index pizarras_compras_shipment_idx rename to producto_compras_shipment_idx;
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'producto_compras' and policyname = 'pizarras_compras_insert_public') then
    alter policy "pizarras_compras_insert_public" on producto_compras
      rename to "producto_compras_insert_public";
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'producto_compras' and policyname = 'pizarras_compras_all_authenticated') then
    alter policy "pizarras_compras_all_authenticated" on producto_compras
      rename to "producto_compras_all_authenticated";
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 5 — Columnas nuevas
--
-- `cantidad` es lo que hace posible "elijo 3 créditos y pago $9.000".
-- Arranca en 1 para todas las compras que ya existen.
-- ═══════════════════════════════════════════════════════════════

alter table producto_compras
  add column if not exists categoria_producto text,
  add column if not exists cantidad           integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producto_compras_cantidad_check') then
    alter table producto_compras
      add constraint producto_compras_cantidad_check check (cantidad > 0);
  end if;
end $$;

-- Completa la categoría de las compras que ya existen, mirando el producto
update producto_compras pc
set categoria_producto = c.nombre
from productos p
join producto_categorias c on c.id = p.categoria_id
where pc.producto_id = p.id
  and pc.categoria_producto is null;

-- ═══════════════════════════════════════════════════════════════
-- PASO 6 — Vista de compatibilidad `pizarras_compras`
--
-- Devuelve los nombres viejos de columna. Es una vista simple sobre una
-- sola tabla, así que PostgreSQL la hace auto-actualizable: el endpoint
-- `create-pizarra` que está deployado ahora mismo sigue pudiendo INSERTAR
-- compras a través de ella.
-- ═══════════════════════════════════════════════════════════════

drop view if exists pizarras_compras;

create view pizarras_compras with (security_invoker = on) as
  select
    id,
    producto_id          as pizarra_id,
    titulo_producto      as titulo_pizarra,
    precio_base_producto as precio_base_pizarra,
    descuento_aplicado_pct,
    monto_producto,
    monto_envio,
    monto_cobrado,
    metodo_pago,
    mp_preference_id,
    mp_payment_id,
    estado,
    rechazo_motivo,
    nombre,
    whatsapp,
    email,
    direccion_calle,
    direccion_numero,
    direccion_piso_depto,
    direccion_ciudad,
    direccion_provincia,
    direccion_codigo_postal,
    direccion_referencia,
    metodo_envio,
    envia_carrier,
    envia_service,
    envia_service_descripcion,
    envia_shipment_id,
    envia_tracking_number,
    envia_tracking_url,
    envia_label_url,
    envia_generado_en,
    envia_estado,
    envia_estado_actualizado_en,
    envia_webhook_raw,
    sucursal_codigo,
    sucursal_nombre,
    sucursal_direccion,
    creado_en,
    finanzas_mov_id,
    eliminado_en,
    eliminado_por,
    eliminado_por_email
  from producto_compras;

comment on view pizarras_compras is
  'TEMPORAL — compatibilidad con el endpoint y el panel previos a la migración a producto_compras. Borrar con 10_drop_vistas_compat.sql';

grant insert on pizarras_compras to anon;
grant all    on pizarras_compras to authenticated;
grant all    on pizarras_compras to service_role;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
--
-- Lo importante:
--   · compras totales = 2 (igual que antes de migrar)
--   · la vista devuelve las mismas 2
--   · "columnas que la vista NO expone" tiene que decir exactamente
--     "cantidad · categoria_producto". Si aparece cualquier otra,
--     me la pasás: significa que a la vista le falta una columna.
--   · finanzas 91 y alumnos 83
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'producto_compras — filas totales' as chequeo,
         (select count(*)::text from producto_compras) as valor
  union all select 2, 'vista pizarras_compras — filas',
         (select count(*)::text from pizarras_compras)
  union all select 3, 'compras con producto_id apuntando a un producto real',
         (select count(*)::text from producto_compras pc
          join productos p on p.id = pc.producto_id)
  union all select 4, 'Columnas que la vista NO expone (esperado: cantidad · categoria_producto)',
         (select coalesce(string_agg(t.column_name::text, ' · ' order by t.column_name::text), 'ninguna')
          from information_schema.columns t
          where t.table_schema = 'public' and t.table_name = 'producto_compras'
            and t.column_name not in ('producto_id', 'titulo_producto', 'precio_base_producto')
            and t.column_name not in (
              select v.column_name from information_schema.columns v
              where v.table_schema = 'public' and v.table_name = 'pizarras_compras'))
  union all select 5, 'Constraint de la FK',
         (select string_agg(conname::text, ' · ') from pg_constraint
          where conrelid = 'public.producto_compras'::regclass and contype = 'f')
  union all select 6, 'Policies en producto_compras',
         (select string_agg(policyname::text, ' · ' order by policyname::text)
          from pg_policies where schemaname = 'public' and tablename = 'producto_compras')
  union all select 7, 'CONTROL — finanzas_movimientos (tenía 91)',
         (select count(*)::text from finanzas_movimientos)
  union all select 8, 'CONTROL — perfiles (tenía 83)',
         (select count(*)::text from perfiles)
) t order by orden;
