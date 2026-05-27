-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 3 DE 5 — Tabla de moldes
-- Tabla: moldes
--
-- EJECUTAR DESPUÉS de 01_categorias.sql y 02_subcategorias.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists moldes (
  id                  uuid         primary key default gen_random_uuid(),

  -- Clasificación
  categoria_id        uuid         references moldes_categorias(id)    on delete set null,
  subcategoria_id     uuid         references moldes_subcategorias(id) on delete set null,

  -- Contenido
  titulo              text         not null,
  descripcion         text,
  precio              numeric(10,2) not null check (precio >= 0),
  activo              boolean      not null default true,
  orden               integer      not null default 0,

  -- Archivos en Supabase Storage
  -- Bucket privado: moldes-archivos
  archivo_ads_path    text,        -- Ej: "moldes/uuid-molde/patron.ads"
  archivo_pdf_path    text,        -- Ej: "moldes/uuid-molde/patron.pdf"

  -- Bucket público: moldes-imagenes
  imagen_1_path       text,        -- Obligatoria (portada del molde)
  imagen_2_path       text,        -- Opcional
  imagen_3_path       text,        -- Opcional

  -- Soft delete (igual que recursos, alumnos, etc.)
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  -- Timestamps
  creado_en           timestamptz  not null default now(),
  actualizado_en      timestamptz  not null default now()
);

-- Índice principal para la página pública
create index if not exists moldes_publico_idx
  on moldes (activo, eliminado_en, categoria_id, subcategoria_id, orden);

-- Índice para el panel admin (incluye eliminados para la papelera)
create index if not exists moldes_admin_idx
  on moldes (eliminado_en, categoria_id, orden);

-- ─── Trigger: actualiza actualizado_en en cada UPDATE ─────────

create or replace function fn_set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_moldes_actualizado_en on moldes;
create trigger trg_moldes_actualizado_en
  before update on moldes
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────

alter table moldes enable row level security;

-- Público: solo lee moldes activos y no eliminados
create policy "moldes_public_read"
  on moldes for select
  using (activo = true and eliminado_en is null);

-- Admin autenticado: acceso completo (lee todo, incluyendo inactivos y eliminados)
create policy "moldes_admin_all"
  on moldes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
