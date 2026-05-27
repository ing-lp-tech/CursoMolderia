-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 2 DE 5 — Subcategorías de moldes
-- Tabla: moldes_subcategorias
--
-- EJECUTAR DESPUÉS de 01_categorias.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists moldes_subcategorias (
  id                  uuid        primary key default gen_random_uuid(),
  categoria_id        uuid        not null references moldes_categorias(id) on delete cascade,
  nombre              text        not null,
  slug                text        not null,
  orden               integer     not null default 0,
  activo              boolean     not null default true,
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,
  creado_en           timestamptz not null default now(),

  -- Slug único dentro de cada categoría (ej: "pantalones" puede existir en Mujer y en Varón)
  unique (categoria_id, slug)
);

-- Índice para cargar subcategorías de una categoría (usado en selector del formulario)
create index if not exists moldes_subcategorias_cat_idx
  on moldes_subcategorias (categoria_id, activo, eliminado_en, orden);

-- ─── Row Level Security ────────────────────────────────────────

alter table moldes_subcategorias enable row level security;

create policy "subcategorias_public_read"
  on moldes_subcategorias for select
  using (activo = true and eliminado_en is null);

create policy "subcategorias_admin_all"
  on moldes_subcategorias for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─── Datos iniciales ──────────────────────────────────────────
-- Usa subconsulta para resolver slug de categoría → id automáticamente

insert into moldes_subcategorias (categoria_id, nombre, slug, orden)
select c.id, s.nombre, s.slug, s.orden
from moldes_categorias c
join (values
  -- Mujer
  ('mujer', 'Pantalones', 'pantalones', 1),
  ('mujer', 'Buzos',      'buzos',      2),
  ('mujer', 'Vestidos',   'vestidos',   3),
  ('mujer', 'Camisas',    'camisas',    4),
  ('mujer', 'Faldas',     'faldas',     5),
  -- Varón
  ('varon', 'Pantalones', 'pantalones', 1),
  ('varon', 'Remeras',    'remeras',    2),
  ('varon', 'Camisas',    'camisas',    3),
  ('varon', 'Camperas',   'camperas',   4),
  -- Niñas
  ('ninas', 'Vestidos',   'vestidos',   1),
  ('ninas', 'Pantalones', 'pantalones', 2),
  ('ninas', 'Buzos',      'buzos',      3),
  -- Niños
  ('ninos', 'Pantalones', 'pantalones', 1),
  ('ninos', 'Remeras',    'remeras',    2),
  ('ninos', 'Buzos',      'buzos',      3),
  -- Nenas
  ('nenas', 'Vestidos',   'vestidos',   1),
  ('nenas', 'Conjuntos',  'conjuntos',  2),
  -- Nenes
  ('nenes', 'Pantalones', 'pantalones', 1),
  ('nenes', 'Conjuntos',  'conjuntos',  2),
  -- Bebés
  ('bebes', 'Bodies',     'bodies',     1),
  ('bebes', 'Ajuares',    'ajuares',    2),
  ('bebes', 'Mamelucos',  'mamelucos',  3)
) as s(cat_slug, nombre, slug, orden) on c.slug = s.cat_slug
on conflict (categoria_id, slug) do nothing;
