-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 01 — Categorías y subcategorías de producto
-- Tablas: producto_categorias · producto_subcategorias
--
-- EJECUTAR PRIMERO (después del 00, que solo verifica).
-- Los scripts 02, 04 y 05 dependen de estas tablas.
--
-- Este script es 100% ADITIVO: crea dos tablas nuevas y no toca
-- ninguna tabla, fila ni policy existente.
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

-- Trigger de actualizado_en (ya existe si corriste los scripts de moldes;
-- se recrea acá para que este script sea autosuficiente)
create or replace function fn_set_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- TABLA 1 — producto_categorias
-- ═══════════════════════════════════════════════════════════════

create table if not exists producto_categorias (
  id                  uuid        primary key default gen_random_uuid(),

  nombre              text        not null,
  slug                text        not null unique,   -- arma la URL: /tienda/plotters
  icono               text        not null default 'category',
  color               text        not null default 'text-primary',
  descripcion         text,                          -- bajada del encabezado de la categoría

  orden               integer     not null default 0,
  activo              boolean     not null default true,

  -- Vos elegís qué categorías se ven en el navbar del sitio.
  -- El switch del panel escribe acá y sincroniza la fila de nav_items (script 05).
  visible_en_navbar   boolean     not null default false,

  -- Soft delete (igual que moldes / pizarras / sorteos)
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

create index if not exists producto_categorias_publico_idx
  on producto_categorias (activo, eliminado_en, orden);

create index if not exists producto_categorias_navbar_idx
  on producto_categorias (visible_en_navbar, activo, eliminado_en, orden);

drop trigger if exists trg_producto_categorias_actualizado_en on producto_categorias;
create trigger trg_producto_categorias_actualizado_en
  before update on producto_categorias
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────

alter table producto_categorias enable row level security;

drop policy if exists "producto_categorias_select_public"     on producto_categorias;
drop policy if exists "producto_categorias_all_authenticated" on producto_categorias;

create policy "producto_categorias_select_public"
  on producto_categorias for select
  using (activo = true and eliminado_en is null);

create policy "producto_categorias_all_authenticated"
  on producto_categorias for all
  to authenticated
  using (true)
  with check (true);

grant select on table producto_categorias to anon;
grant all    on table producto_categorias to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- TABLA 2 — producto_subcategorias
-- Ej: dentro de Plotters → Papel para plotter, Cartuchos y tintas
-- ═══════════════════════════════════════════════════════════════

create table if not exists producto_subcategorias (
  id                  uuid        primary key default gen_random_uuid(),
  categoria_id        uuid        not null references producto_categorias(id) on delete cascade,

  nombre              text        not null,
  slug                text        not null,
  icono               text        not null default 'label',

  orden               integer     not null default 0,
  activo              boolean     not null default true,

  -- Soft delete
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  creado_en           timestamptz not null default now(),

  -- Slug único dentro de cada categoría ("repuestos" puede existir en Plotters y en PCs)
  unique (categoria_id, slug)
);

create index if not exists producto_subcategorias_cat_idx
  on producto_subcategorias (categoria_id, activo, eliminado_en, orden);

-- ─── Row Level Security ────────────────────────────────────────

alter table producto_subcategorias enable row level security;

drop policy if exists "producto_subcategorias_select_public"     on producto_subcategorias;
drop policy if exists "producto_subcategorias_all_authenticated" on producto_subcategorias;

create policy "producto_subcategorias_select_public"
  on producto_subcategorias for select
  using (activo = true and eliminado_en is null);

create policy "producto_subcategorias_all_authenticated"
  on producto_subcategorias for all
  to authenticated
  using (true)
  with check (true);

grant select on table producto_subcategorias to anon;
grant all    on table producto_subcategorias to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- DATOS INICIALES — categorías
--
-- "Pizarras" queda visible en el navbar porque hoy ya está ahí.
-- El resto arranca oculto: los prendés desde el panel cuando tengas
-- productos cargados en esa categoría.
-- ═══════════════════════════════════════════════════════════════

insert into producto_categorias (nombre, slug, icono, color, descripcion, orden, visible_en_navbar) values
  ('Pizarras',   'pizarras',   'draw',     'text-primary',   'Pizarras digitalizadoras para pasar tus moldes de cartón a digital.', 1, true),
  ('Plotters',   'plotters',   'print',    'text-secondary', 'Plotters de tizada, papel, cartuchos y repuestos.',                   2, false),
  ('PCs',        'pcs',        'computer', 'text-tertiary',  'Equipos listos para trabajar con Audaces y moldería digital.',        3, false),
  ('Accesorios', 'accesorios', 'category', 'text-primary',   'Insumos y herramientas para tu taller.',                              4, false)
on conflict (slug) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- DATOS INICIALES — subcategorías
-- Resuelve el slug de la categoría → id automáticamente
-- ═══════════════════════════════════════════════════════════════

insert into producto_subcategorias (categoria_id, nombre, slug, icono, orden)
select c.id, s.nombre, s.slug, s.icono, s.orden
from producto_categorias c
join (values
  -- Pizarras
  ('pizarras',   'Pizarra digitalizadora',   'pizarra-digitalizadora', 'draw',        1),
  ('pizarras',   'Accesorios de pizarra',    'accesorios-pizarra',     'handyman',    2),
  -- Plotters
  ('plotters',   'Plotters de tizada',       'plotters-de-tizada',     'print',       1),
  ('plotters',   'Papel para plotter',       'papel-para-plotter',     'description', 2),
  ('plotters',   'Cartuchos y tintas',       'cartuchos-y-tintas',     'water_drop',  3),
  ('plotters',   'Repuestos',                'repuestos',              'build',       4),
  -- PCs
  ('pcs',        'PCs armadas',              'pcs-armadas',            'computer',    1),
  ('pcs',        'Notebooks',                'notebooks',              'laptop_mac',  2),
  ('pcs',        'Periféricos',              'perifericos',            'mouse',       3),
  -- Accesorios
  ('accesorios', 'Insumos de taller',        'insumos-de-taller',      'inventory_2', 1),
  ('accesorios', 'Herramientas de moldería', 'herramientas-molderia',  'straighten',  2)
) as s(cat_slug, nombre, slug, icono, orden) on c.slug = s.cat_slug
on conflict (categoria_id, slug) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — tiene que devolver 4 categorías y 11 subcategorías
-- ═══════════════════════════════════════════════════════════════

select c.orden,
       c.nombre                         as categoria,
       c.slug,
       c.visible_en_navbar              as en_navbar,
       count(s.id)                      as subcategorias,
       string_agg(s.nombre, ' · ' order by s.orden) as detalle
from producto_categorias c
left join producto_subcategorias s on s.categoria_id = c.id
where c.eliminado_en is null
group by c.id, c.orden, c.nombre, c.slug, c.visible_en_navbar
order by c.orden;
