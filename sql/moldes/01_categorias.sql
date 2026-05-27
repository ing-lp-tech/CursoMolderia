-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 1 DE 5 — Categorías de moldes
-- Tabla: moldes_categorias
--
-- EJECUTAR PRIMERO. Los scripts 02, 03 y 04 dependen de esta tabla.
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists moldes_categorias (
  id                  uuid        primary key default gen_random_uuid(),
  nombre              text        not null,
  slug                text        not null unique,
  icono               text        not null default 'category',
  color               text        not null default 'text-primary',
  orden               integer     not null default 0,
  activo              boolean     not null default true,
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,
  creado_en           timestamptz not null default now()
);

-- Índice para consultas públicas (activas, no eliminadas, ordenadas)
create index if not exists moldes_categorias_activo_idx
  on moldes_categorias (activo, eliminado_en, orden);

-- ─── Row Level Security ────────────────────────────────────────

alter table moldes_categorias enable row level security;

-- Público: solo lee categorías activas y no eliminadas
create policy "categorias_public_read"
  on moldes_categorias for select
  using (activo = true and eliminado_en is null);

-- Admin autenticado: acceso completo (insert, update, delete, read total)
create policy "categorias_admin_all"
  on moldes_categorias for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─── Datos iniciales ──────────────────────────────────────────

insert into moldes_categorias (nombre, slug, icono, color, orden) values
  ('Mujer',  'mujer',  'person',                  'text-primary',   1),
  ('Varón',  'varon',  'man',                     'text-secondary', 2),
  ('Niñas',  'ninas',  'girl',                    'text-tertiary',  3),
  ('Niños',  'ninos',  'boy',                     'text-tertiary',  4),
  ('Nenas',  'nenas',  'child_care',              'text-primary',   5),
  ('Nenes',  'nenes',  'child_care',              'text-secondary', 6),
  ('Bebés',  'bebes',  'baby_changing_station',   'text-tertiary',  7)
on conflict (slug) do nothing;
