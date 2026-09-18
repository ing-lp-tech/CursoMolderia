-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 06 — Navbar administrable
-- Tabla: nav_items
--
-- EJECUTAR DESPUÉS de 01_categorias.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Saca los links de la navbar del código y los pone en una tabla, para
-- poder mostrar, ocultar y reordenar desde /admin/navegacion sin deploy.
--
-- UNA SOLA LISTA ORDENADA: los links fijos (Inicio, Programa…) y los de
-- categoría (Pizarras, Plotters…) conviven en la misma tabla. Si hubiera
-- dos fuentes, se pelearían por el orden.
--
-- ── EL FALLBACK ────────────────────────────────────────────────
-- Navbar.jsx conserva su array de links como constante y lo usa mientras
-- la consulta viaja, o si Supabase no responde. Nunca hay un instante con
-- la navbar vacía, ni siquiera si esta tabla quedara sin filas.
--
-- ── OJO CON LA SEMILLA ─────────────────────────────────────────
-- "Tienda" y "Plotters" se cargan con visible = false a propósito: las
-- rutas /tienda y /tienda/plotters son de la Etapa 4 y todavía no existen.
-- Prenderlas antes dejaría dos links rotos en producción. Cuando la tienda
-- esté publicada, se prenden desde el panel con un clic.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop table nav_items;
--   (la navbar vuelve sola al array del código)
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.producto_categorias') is null then
    raise exception 'Falta correr 01_categorias.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA
-- ═══════════════════════════════════════════════════════════════

create table if not exists nav_items (
  id                    uuid        primary key default gen_random_uuid(),

  label                 text        not null,
  -- Ruta interna ('/tienda/plotters') o URL completa ('https://…')
  path                  text        not null,
  icono                 text,                      -- Material Symbols

  -- Si apunta a una categoría, este ítem ES el link de esa categoría.
  -- Sirve para que el switch "Mostrar en el navbar" del admin de
  -- categorías sepa qué fila prender o apagar.
  categoria_id          uuid        references producto_categorias(id) on delete set null,

  orden                 integer     not null default 0,
  visible               boolean     not null default true,
  abre_en_nueva_pestana boolean     not null default false,

  -- Soft delete
  eliminado_en          timestamptz,
  eliminado_por         uuid,
  eliminado_por_email   text,

  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create index if not exists nav_items_orden_idx
  on nav_items (visible, eliminado_en, orden);

create index if not exists nav_items_categoria_idx
  on nav_items (categoria_id)
  where categoria_id is not null;

drop trigger if exists trg_nav_items_actualizado_en on nav_items;
create trigger trg_nav_items_actualizado_en
  before update on nav_items
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────
-- El visitante ve solo los visibles; el admin ve y edita todo.

alter table nav_items enable row level security;

drop policy if exists "nav_items_select_public"     on nav_items;
drop policy if exists "nav_items_all_authenticated" on nav_items;

create policy "nav_items_select_public"
  on nav_items for select
  using (visible = true and eliminado_en is null);

create policy "nav_items_all_authenticated"
  on nav_items for all
  to authenticated
  using (true)
  with check (true);

grant select on table nav_items to anon;
grant all    on table nav_items to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- SEMILLA — los links de hoy, más los dos de la tienda apagados
-- Solo se insertan si la tabla está vacía: correr dos veces no duplica.
-- ═══════════════════════════════════════════════════════════════

insert into nav_items (label, path, icono, categoria_id, orden, visible)
select s.label, s.path, s.icono, c.id, s.orden, s.visible
from (values
  ('Inicio',      '/',                 'home',       null,       0, true ),
  ('Programa',    '/temario',          'tactic',     null,       1, true ),
  ('Beneficios',  '/ventajas',         'star',       null,       2, true ),
  ('Moldes',      '/moldes',           'straighten', null,       3, true ),
  ('Tienda',      '/tienda',           'storefront', null,       4, false),
  ('Pizarras',    '/pizarras',         'draw',       'pizarras', 5, true ),
  ('Plotters',    '/tienda/plotters',  'print',      'plotters', 6, false),
  ('Inscribirse', '/inscripcion',      'payments',   null,       7, true )
) as s(label, path, icono, slug, orden, visible)
left join producto_categorias c on c.slug = s.slug
where not exists (select 1 from nav_items);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — los 8 links, con Tienda y Plotters en oculto
-- ═══════════════════════════════════════════════════════════════

select n.orden,
       n.label,
       n.path,
       n.icono,
       case when n.visible then 'visible' else 'oculto' end as estado,
       coalesce(c.nombre, '—')                             as categoria
from nav_items n
left join producto_categorias c on c.id = n.categoria_id
where n.eliminado_en is null
order by n.orden;
