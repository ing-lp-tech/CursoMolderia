-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 04 — Planes de un producto
-- Tabla: producto_planes (+ 3 columnas en producto_compras)
--
-- EJECUTAR DESPUÉS de 03_producto_compras.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Crea la tabla de planes y le carga los 4 de la pizarra. Desde acá
-- en adelante los precios de los planes se editan desde el panel,
-- sin deploy.
--
-- El plan "Solo Software" es el que otorga créditos: el comprador
-- elige cuántos (1 crédito = 1 digitalización) y el código se genera
-- al aprobar el pago.
--
-- Es un script ADITIVO: crea una tabla nueva, agrega 3 columnas
-- nullable a producto_compras y afloja el NOT NULL de las 4 columnas
-- de dirección (un plan sin envío no tiene dirección que guardar).
-- No modifica ninguna fila existente.
--
-- Se puede correr dos veces sin efecto: la tabla no se recrea, los
-- planes no se duplican y aflojar un NOT NULL ya aflojado no hace nada.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   alter table producto_compras drop column plan_id,
--     drop column titulo_plan, drop column precio_base_plan;
--   drop table producto_planes;
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.producto_compras') is null then
    raise exception 'Falta correr 03_producto_compras.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA — producto_planes
-- ═══════════════════════════════════════════════════════════════

create table if not exists producto_planes (
  id                  uuid          primary key default gen_random_uuid(),
  producto_id         uuid          not null references productos(id) on delete cascade,

  nombre              text          not null,
  descripcion         text,
  incluye             text,                        -- un ítem por línea

  precio              numeric(10,2) not null check (precio >= 0),
  -- Texto que acompaña al precio. Ej: "por crédito" → "$3.000 por crédito".
  -- null = precio normal, sin aclaración.
  precio_sufijo       text,

  -- false = no se despacha (licencias, créditos): el checkout saltea
  -- la dirección y no cobra envío
  requiere_envio      boolean       not null default true,

  -- true = al aprobar la compra se genera un código de digitalización
  -- con tantos créditos como unidades haya comprado
  otorga_creditos     boolean       not null default false,

  -- Rango que puede elegir el comprador (1..1 = cantidad fija)
  cantidad_min        integer       not null default 1 check (cantidad_min >= 1),
  cantidad_max        integer       not null default 1,

  destacado           boolean       not null default false,
  orden               integer       not null default 0,
  activo              boolean       not null default true,

  -- Soft delete
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  creado_en           timestamptz   not null default now(),
  actualizado_en      timestamptz   not null default now(),

  constraint producto_planes_cantidad_check check (cantidad_max >= cantidad_min)
);

create index if not exists producto_planes_producto_idx
  on producto_planes (producto_id, activo, eliminado_en, orden);

drop trigger if exists trg_producto_planes_actualizado_en on producto_planes;
create trigger trg_producto_planes_actualizado_en
  before update on producto_planes
  for each row execute function fn_set_actualizado_en();

-- ─── Row Level Security ────────────────────────────────────────

alter table producto_planes enable row level security;

drop policy if exists "producto_planes_select_public"     on producto_planes;
drop policy if exists "producto_planes_all_authenticated" on producto_planes;

create policy "producto_planes_select_public"
  on producto_planes for select
  using (activo = true and eliminado_en is null);

create policy "producto_planes_all_authenticated"
  on producto_planes for all
  to authenticated
  using (true)
  with check (true);

grant select on table producto_planes to anon;
grant all    on table producto_planes to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- COLUMNAS EN producto_compras
--
-- Snapshots: editar el precio de un plan hoy no puede reescribir
-- la historia de una venta de ayer.
-- ═══════════════════════════════════════════════════════════════

alter table producto_compras
  add column if not exists plan_id          uuid,
  add column if not exists titulo_plan      text,
  add column if not exists precio_base_plan numeric(10,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producto_compras_plan_id_fkey') then
    alter table producto_compras
      add constraint producto_compras_plan_id_fkey
      foreign key (plan_id) references producto_planes(id) on delete set null;
  end if;
end $$;

create index if not exists producto_compras_plan_idx
  on producto_compras (plan_id)
  where plan_id is not null;

-- ── Dirección opcional ─────────────────────────────────────────
-- Un plan con requiere_envio = false (créditos de software) no se
-- despacha: no hay dirección que pedirle al comprador. Estas cuatro
-- columnas venían NOT NULL de cuando la única compra posible era una
-- pizarra física.
--
-- Aflojar un NOT NULL no toca ni una fila: las compras que ya están
-- guardadas siguen con su dirección completa, y las nuevas compras
-- físicas la siguen exigiendo desde el checkout.
alter table producto_compras
  alter column direccion_calle         drop not null,
  alter column direccion_ciudad        drop not null,
  alter column direccion_provincia     drop not null,
  alter column direccion_codigo_postal drop not null;

-- ═══════════════════════════════════════════════════════════════
-- DATOS INICIALES — los 4 planes de la pizarra
--
-- Se cuelgan del producto de la categoría "Pizarras".
-- Los textos de "incluye" son un borrador: editalos desde el panel.
-- Solo se insertan si la tabla está vacía (correr dos veces no duplica).
-- ═══════════════════════════════════════════════════════════════

with pizarra as (
  select p.id
  from productos p
  join producto_categorias c on c.id = p.categoria_id
  where c.slug = 'pizarras' and p.eliminado_en is null
  order by p.orden
  limit 1
)
insert into producto_planes
  (producto_id, nombre, descripcion, incluye, precio, precio_sufijo,
   requiere_envio, otorga_creditos, cantidad_min, cantidad_max, destacado, orden)
select pz.id, s.nombre, s.descripcion, s.incluye, s.precio, s.precio_sufijo,
       s.requiere_envio, s.otorga_creditos, s.cantidad_min, s.cantidad_max, s.destacado, s.orden
from pizarra pz
cross join (values
  (
    'Inicial',
    'Para arrancar a digitalizar tus moldes.',
    E'Pizarra digitalizadora\nSoftware de digitalización\nSoporte de instalación',
    250000, null::text, true, false, 1, 1, false, 0
  ),
  (
    'Combo Taller',
    'La pizarra más el curso completo de moldería digital.',
    E'Todo lo del plan Inicial\nCurso de moldería digital\nAcompañamiento personalizado',
    400000, null, true, false, 1, 1, true, 1
  ),
  (
    'Fábrica / Profesional',
    'Para talleres que producen todos los días.',
    E'Todo lo del Combo Taller\nLicencia profesional\nPrioridad en soporte',
    700000, null, true, false, 1, 1, false, 2
  ),
  (
    'Solo Software',
    'Ya tenés la pizarra: comprá solo créditos de digitalización.',
    E'Acceso al software\nCréditos de digitalización\n1 crédito = 1 digitalización\nSin envío: recibís tu código por WhatsApp',
    3000, 'por crédito', false, true, 1, 100, false, 3
  )
) as s(nombre, descripcion, incluye, precio, precio_sufijo,
       requiere_envio, otorga_creditos, cantidad_min, cantidad_max, destacado, orden)
where not exists (select 1 from producto_planes);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — tienen que aparecer los 4 planes, colgados de la
-- "Pizarra Digitalizadora Profesional"
-- ═══════════════════════════════════════════════════════════════

select pl.orden,
       pl.nombre                                            as plan,
       to_char(pl.precio, 'FM999G999G999')                  as precio,
       coalesce(pl.precio_sufijo, '—')                      as sufijo,
       pl.requiere_envio                                    as envia,
       pl.otorga_creditos                                   as creditos,
       pl.cantidad_min || '-' || pl.cantidad_max            as cantidad,
       p.titulo                                             as producto
from producto_planes pl
join productos p on p.id = pl.producto_id
where pl.eliminado_en is null
order by pl.orden;
