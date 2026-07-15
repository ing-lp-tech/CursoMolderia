-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 1 DE 3 — Tabla de pizarras digitalizadoras (catálogo)
-- Tabla: pizarras
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists pizarras (
  id                  uuid          primary key default gen_random_uuid(),

  -- Contenido
  titulo              text          not null,
  descripcion         text,
  especificaciones    text,         -- lista de características, una por línea
  precio              numeric(10,2) not null check (precio >= 0),
  stock               integer       not null default 0 check (stock >= 0),
  activo              boolean       not null default true,
  orden               integer       not null default 0,

  -- Dimensiones y peso del paquete — necesarios para cotizar envío con envia.com
  peso_kg             numeric(6,2)  not null default 1,
  alto_cm             numeric(6,2)  not null default 10,
  ancho_cm            numeric(6,2)  not null default 40,
  largo_cm            numeric(6,2)  not null default 60,

  -- Bucket público: pizarras-imagenes
  imagen_1_path       text,        -- Obligatoria (portada)
  imagen_2_path       text,        -- Opcional
  imagen_3_path       text,        -- Opcional

  -- Soft delete (igual que moldes)
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  -- Timestamps
  creado_en           timestamptz  not null default now(),
  actualizado_en      timestamptz  not null default now()
);

create index if not exists pizarras_publico_idx
  on pizarras (activo, eliminado_en, orden);

create index if not exists pizarras_admin_idx
  on pizarras (eliminado_en, orden);

drop trigger if exists trg_pizarras_actualizado_en on pizarras;
create trigger trg_pizarras_actualizado_en
  before update on pizarras
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────

alter table pizarras enable row level security;

drop policy if exists "pizarras_select_public"     on pizarras;
drop policy if exists "pizarras_all_authenticated" on pizarras;

create policy "pizarras_select_public"
  on pizarras for select
  using (activo = true and eliminado_en is null);

create policy "pizarras_all_authenticated"
  on pizarras for all
  to authenticated
  using (true)
  with check (true);

grant select on table pizarras to anon;
grant all    on table pizarras to authenticated;

-- ─── Seed: producto inicial ────────────────────────────────────

insert into pizarras (titulo, descripcion, especificaciones, precio, stock, activo, orden, peso_kg, alto_cm, ancho_cm, largo_cm)
select
  'Pizarra Digitalizadora Profesional',
  '¿Cansada de trabajar con moldes en cartón? Con nuestra Pizarra Digitalizadora, pasá tus moldes físicos a digital usando solo la cámara de tu celular.',
  E'Velocidad: digitalización en segundos\nPrecisión: resultados profesionales\nSimplicidad: muy fácil de configurar\nCompatible con Audaces y otros CAD de moldería\nGarantía de fábrica',
  400000,
  10,
  true,
  0,
  4,
  10,
  50,
  80
where not exists (select 1 from pizarras);
