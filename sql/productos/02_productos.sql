-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 02 — pizarras → productos
-- Tabla: productos (ex pizarras) + vista de compatibilidad `pizarras`
--
-- EJECUTAR DESPUÉS de 01_categorias.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Renombra la tabla (NO copia datos, NO borra nada) y le agrega las
-- columnas de categoría. Los ids de los productos NO cambian, así que
-- las ventas que ya existen siguen apuntando a la misma fila.
--
-- ── RED DE SEGURIDAD ───────────────────────────────────────────
-- Crea una vista llamada `pizarras` con la forma vieja de la tabla.
-- El navegador de un cliente que tenga la página cacheada de antes del
-- deploy sigue viendo el catálogo como si nada.
-- Esa vista se borra con el script 10, a las 24-48 hs.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop view if exists pizarras;
--   alter table productos rename to pizarras;
--   alter table pizarras drop column categoria_id, drop column subcategoria_id,
--     drop column requiere_envio, drop column thumb_1_path,
--     drop column thumb_2_path, drop column thumb_3_path;
--   (y los renombres inversos de índices, trigger y policies)
-- ═══════════════════════════════════════════════════════════════

-- ─── Guarda de seguridad ───────────────────────────────────────
-- security_invoker necesita PostgreSQL 15+. Sin eso, la vista de
-- compatibilidad saltearía el RLS y un visitante anónimo podría leer
-- filas inactivas o borradas. Preferimos cortar antes que eso pase.

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL % no soporta security_invoker. PARAR y avisar.',
      current_setting('server_version');
  end if;

  if to_regclass('public.producto_categorias') is null then
    raise exception 'Falta correr 01_categorias.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 1 — Renombrar la tabla
-- Guardado por relkind = 'r' (tabla real): si el script se corre dos
-- veces, la segunda no confunde la VISTA `pizarras` con la tabla.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pizarras' and c.relkind = 'r'
  ) then
    alter table pizarras rename to productos;
    raise notice 'Tabla pizarras renombrada a productos';
  else
    raise notice 'La tabla pizarras ya fue renombrada — se saltea el paso 1';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 2 — Renombrar índices, trigger y policies
-- Son metadatos: no mueven datos ni interrumpen consultas.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_class where relname = 'pizarras_publico_idx' and relkind = 'i') then
    alter index pizarras_publico_idx rename to productos_publico_idx;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_admin_idx' and relkind = 'i') then
    alter index pizarras_admin_idx rename to productos_admin_idx;
  end if;

  if exists (select 1 from pg_class where relname = 'pizarras_pkey' and relkind = 'i') then
    alter index pizarras_pkey rename to productos_pkey;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_pizarras_actualizado_en'
      and tgrelid = 'public.productos'::regclass
  ) then
    alter trigger trg_pizarras_actualizado_en on productos
      rename to trg_productos_actualizado_en;
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'productos' and policyname = 'pizarras_select_public') then
    alter policy "pizarras_select_public" on productos rename to "productos_select_public";
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'productos' and policyname = 'pizarras_all_authenticated') then
    alter policy "pizarras_all_authenticated" on productos rename to "productos_all_authenticated";
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- PASO 3 — Columnas nuevas (todas nullable o con default:
-- ninguna fila existente se cae ni se modifica)
-- ═══════════════════════════════════════════════════════════════

alter table productos
  add column if not exists categoria_id    uuid,
  add column if not exists subcategoria_id uuid,
  -- false = producto que no se despacha (licencias, créditos de software):
  -- el checkout saltea dirección y cotización de envío
  add column if not exists requiere_envio  boolean not null default true,
  -- Miniaturas para el catálogo: la tarjeta carga ~25 KB en vez de ~250 KB
  add column if not exists thumb_1_path    text,
  add column if not exists thumb_2_path    text,
  add column if not exists thumb_3_path    text;

-- Claves foráneas (add constraint no tiene "if not exists": se guarda a mano)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_categoria_id_fkey') then
    alter table productos
      add constraint productos_categoria_id_fkey
      foreign key (categoria_id) references producto_categorias(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'productos_subcategoria_id_fkey') then
    alter table productos
      add constraint productos_subcategoria_id_fkey
      foreign key (subcategoria_id) references producto_subcategorias(id) on delete set null;
  end if;
end $$;

create index if not exists productos_categoria_idx
  on productos (categoria_id, subcategoria_id, activo, eliminado_en, orden);

-- ═══════════════════════════════════════════════════════════════
-- PASO 4 — Clasificar lo que ya existe como "Pizarras"
-- Solo toca filas sin categoría: correrlo dos veces no pisa nada.
-- ═══════════════════════════════════════════════════════════════

update productos
set categoria_id = (select id from producto_categorias where slug = 'pizarras')
where categoria_id is null;

update productos
set subcategoria_id = (
  select s.id from producto_subcategorias s
  join producto_categorias c on c.id = s.categoria_id
  where c.slug = 'pizarras' and s.slug = 'pizarra-digitalizadora'
)
where subcategoria_id is null
  and categoria_id = (select id from producto_categorias where slug = 'pizarras');

-- ═══════════════════════════════════════════════════════════════
-- PASO 5 — Vista de compatibilidad `pizarras`
--
-- Expone exactamente las columnas que tenía la tabla vieja, ni una más:
-- el código viejo hace `select *` y tiene que seguir viendo la misma forma.
--
-- security_invoker = on → la vista respeta el RLS de `productos` usando
-- los permisos de quien consulta, no los del dueño de la vista.
--
-- NOTA: un INSERT hecho a través de esta vista (solo posible desde el panel
-- viejo cacheado) crea el producto sin categoría. Si llegara a pasar, se le
-- asigna la categoría desde el panel nuevo. Es una ventana de 24-48 hs.
-- ═══════════════════════════════════════════════════════════════

drop view if exists pizarras;

create view pizarras with (security_invoker = on) as
  select
    id, titulo, descripcion, especificaciones,
    precio, stock, activo, orden,
    peso_kg, alto_cm, ancho_cm, largo_cm,
    imagen_1_path, imagen_2_path, imagen_3_path,
    eliminado_en, eliminado_por, eliminado_por_email,
    creado_en, actualizado_en
  from productos
  where categoria_id = (select id from producto_categorias where slug = 'pizarras');

comment on view pizarras is
  'TEMPORAL — compatibilidad con el frontend cacheado previo a la migración a productos. Borrar con 10_drop_vistas_compat.sql';

grant select on pizarras to anon;
grant all    on pizarras to authenticated;
grant all    on pizarras to service_role;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- "productos" y "vista pizarras" tienen que dar 1 y 1.
-- Los controles de finanzas (91) y alumnos (83) tienen que dar igual
-- que en el script 00.
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'productos — filas totales' as chequeo,
         (select count(*)::text from productos) as valor
  union all select 2, 'productos — con categoría asignada',
         (select count(*)::text from productos where categoria_id is not null)
  union all select 3, 'vista pizarras — filas visibles',
         (select count(*)::text from pizarras)
  union all select 4, 'Policies en productos',
         (select string_agg(policyname::text, ' · ' order by policyname::text)
          from pg_policies where schemaname = 'public' and tablename = 'productos')
  union all select 5, 'Índices en productos',
         (select string_agg(indexname::text, ' · ' order by indexname::text)
          from pg_indexes where schemaname = 'public' and tablename = 'productos')
  union all select 6, 'CONTROL — finanzas_movimientos (tenía 91)',
         (select count(*)::text from finanzas_movimientos)
  union all select 7, 'CONTROL — perfiles (tenía 83)',
         (select count(*)::text from perfiles)
) t order by orden;
