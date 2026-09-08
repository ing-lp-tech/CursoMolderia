-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 1 DE 1 — Sorteos del curso (ruleta de ganadores)
-- Tabla: sorteos
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

create table if not exists sorteos (
  id                  uuid          primary key default gen_random_uuid(),

  -- Contenido
  titulo              text          not null,
  premio              text          not null default 'Curso gratuito de Audaces',
  periodo             text,         -- ej. 'Septiembre 2026' — se muestra en la portada
  descripcion         text,

  -- Configuración del sorteo
  cantidad_ganadores  integer       not null default 1 check (cantidad_ganadores between 1 and 50),
  participantes       jsonb         not null default '[]'::jsonb,  -- array de strings (nombres o números)

  -- Contador público: la portada muestra "entre N participantes" sin exponer los nombres
  total_participantes integer generated always as (jsonb_array_length(participantes)) stored,

  -- Resultado
  ganadores           jsonb         not null default '[]'::jsonb,  -- array de strings, en orden de sorteo
  estado              text          not null default 'pendiente' check (estado in ('pendiente','realizado')),
  realizado_en        timestamptz,

  -- Publicación en la landing (solo uno a la vez queda publicado)
  publicado           boolean       not null default false,

  -- Soft delete (igual que moldes / pizarras)
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  -- Timestamps
  creado_en           timestamptz   not null default now(),
  actualizado_en      timestamptz   not null default now()
);

create index if not exists sorteos_publico_idx
  on sorteos (publicado, estado, eliminado_en, realizado_en desc);

create index if not exists sorteos_admin_idx
  on sorteos (eliminado_en, creado_en desc);

drop trigger if exists trg_sorteos_actualizado_en on sorteos;
create trigger trg_sorteos_actualizado_en
  before update on sorteos
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────

alter table sorteos enable row level security;

drop policy if exists "sorteos_select_public"     on sorteos;
drop policy if exists "sorteos_all_authenticated" on sorteos;

-- El público solo ve el sorteo ya realizado y marcado como publicado
create policy "sorteos_select_public"
  on sorteos for select
  using (publicado = true and estado = 'realizado' and eliminado_en is null);

create policy "sorteos_all_authenticated"
  on sorteos for all
  to authenticated
  using (true)
  with check (true);

-- Privilegios por columna: el visitante anónimo NUNCA puede leer `participantes`
-- (los nombres cargados en el sorteo). Solo ve el resultado y el total.
revoke all on table sorteos from anon;
grant select (
  id, titulo, premio, periodo, descripcion,
  cantidad_ganadores, ganadores, estado, publicado,
  realizado_en, total_participantes
) on table sorteos to anon;

grant all on table sorteos to authenticated;
