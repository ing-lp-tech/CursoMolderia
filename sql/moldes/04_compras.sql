-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 4 DE 5 — Tabla de compras de moldes
-- Tabla: moldes_compras
--
-- EJECUTAR DESPUÉS de 03_moldes.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists moldes_compras (
  id                       uuid          primary key default gen_random_uuid(),

  -- ── REFERENCIA AL PRODUCTO ─────────────────────────────────
  -- Se guardan FKs + snapshots de texto por si el molde se edita o borra

  molde_id                 uuid          references moldes(id)                on delete set null,
  categoria_id             uuid          references moldes_categorias(id)     on delete set null,
  subcategoria_id          uuid          references moldes_subcategorias(id)  on delete set null,

  -- Snapshots en el momento de la compra (historial inmutable)
  titulo_molde             text          not null,
  precio_base_molde        numeric(10,2) not null,
  descuento_aplicado_pct   numeric(5,2)  not null default 0,  -- 0 si MP, N si transferencia
  monto_cobrado            numeric(10,2) not null,            -- precio con descuento aplicado

  -- ── MÉTODO Y ESTADO DE PAGO ────────────────────────────────

  metodo_pago              text          not null
                             check (metodo_pago in ('mercadopago', 'transferencia')),

  -- Solo se completan si metodo_pago = 'mercadopago'
  mp_preference_id         text,
  mp_payment_id            text,

  -- Estado global de la compra
  -- Toda compra empieza en 'en_verificacion', el admin cambia manualmente
  estado                   text          not null default 'en_verificacion'
                             check (estado in ('en_verificacion', 'aprobado', 'rechazado')),
  rechazo_motivo           text,         -- nota del admin al rechazar (opcional)

  -- ── DATOS DEL COMPRADOR ────────────────────────────────────
  -- Se guardan completos para análisis de negocio y contacto post-venta

  nombre                   text          not null,
  email                    text          not null,
  whatsapp                 text          not null,  -- con código de país: 5491112345678
  provincia                text,
  ciudad                   text,
  como_llego               text          check (
                             como_llego in ('instagram','google','referido','whatsapp','otro')
                           ),
  como_llego_detalle       text,         -- campo libre si eligió "otro"

  -- ── METADATA ───────────────────────────────────────────────

  creado_en                timestamptz   not null default now(),
  ip_hash                  text,          -- hash del IP, no el IP real (privacidad)
  user_agent_resumen       text,          -- 'mobile-android' | 'desktop-windows' | etc.

  -- Se completa cuando el admin aprueba (para trazabilidad con Finanzas)
  finanzas_mov_id          uuid,

  -- ── SOFT DELETE ────────────────────────────────────────────

  eliminado_en             timestamptz,
  eliminado_por            uuid,
  eliminado_por_email      text
);

-- ─── Índices ──────────────────────────────────────────────────

-- Panel admin: listado de compras pendientes de aprobación
create index if not exists compras_estado_idx
  on moldes_compras (estado, eliminado_en, creado_en desc);

-- Filtro por método de pago
create index if not exists compras_metodo_idx
  on moldes_compras (metodo_pago, estado, eliminado_en);

-- Trazabilidad: compras de un molde específico
create index if not exists compras_molde_idx
  on moldes_compras (molde_id, estado);

-- Finanzas: búsqueda cruzada
create index if not exists compras_finanzas_mov_idx
  on moldes_compras (finanzas_mov_id)
  where finanzas_mov_id is not null;

-- ─── Row Level Security ────────────────────────────────────────

alter table moldes_compras enable row level security;

-- Cualquier visitante puede INSERTAR su propia compra (el comprador no está autenticado)
create policy "compras_public_insert"
  on moldes_compras for insert
  with check (true);

-- Admin autenticado: puede leer y modificar todo
-- (los endpoints de Vercel usan service_role key que bypasea RLS)
create policy "compras_admin_all"
  on moldes_compras for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─── Vista útil para el admin ─────────────────────────────────
-- Muestra compras activas con nombres de categoría y subcategoría sin JOINs en el frontend

create or replace view moldes_compras_vista as
select
  mc.*,
  c.nombre  as categoria_nombre,
  sc.nombre as subcategoria_nombre
from moldes_compras mc
left join moldes_categorias    c  on c.id  = mc.categoria_id
left join moldes_subcategorias sc on sc.id = mc.subcategoria_id
where mc.eliminado_en is null;
