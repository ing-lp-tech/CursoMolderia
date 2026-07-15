-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 2 DE 3 — Tabla de compras de pizarras digitalizadoras
-- Tabla: pizarras_compras
--
-- EJECUTAR DESPUÉS de 01_pizarras.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists pizarras_compras (
  id                       uuid          primary key default gen_random_uuid(),

  -- ── REFERENCIA AL PRODUCTO ─────────────────────────────────
  pizarra_id               uuid          references pizarras(id) on delete set null,
  titulo_pizarra           text          not null,
  precio_base_pizarra      numeric(10,2) not null,
  descuento_aplicado_pct   numeric(5,2)  not null default 0,
  monto_producto           numeric(10,2) not null,   -- precio del producto (con descuento si aplica)
  monto_envio              numeric(10,2) not null default 0,
  monto_cobrado            numeric(10,2) not null,    -- monto_producto + monto_envio

  -- ── MÉTODO Y ESTADO DE PAGO ────────────────────────────────
  metodo_pago              text          not null
                             check (metodo_pago in ('mercadopago', 'transferencia')),
  mp_preference_id         text,
  mp_payment_id            text,

  estado                   text          not null default 'en_verificacion'
                             check (estado in ('en_verificacion', 'aprobado', 'rechazado')),
  rechazo_motivo           text,

  -- ── DATOS DEL COMPRADOR ────────────────────────────────────
  nombre                   text          not null,
  whatsapp                 text          not null,
  email                    text          not null default 'sin-email@molderia-digital.com',

  -- ── DIRECCIÓN DE ENVÍO (requerida por envia.com) ───────────
  direccion_calle          text          not null,
  direccion_numero         text,
  direccion_piso_depto     text,
  direccion_ciudad         text          not null,
  direccion_provincia      text          not null,
  direccion_codigo_postal  text          not null,
  direccion_referencia     text,

  -- ── COTIZACIÓN Y ENVÍO (envia.com) ─────────────────────────
  envia_carrier            text,          -- ej: "oca", "andreani"
  envia_service            text,          -- ej: "oca_standard"
  envia_service_descripcion text,
  envia_shipment_id        text,          -- id devuelto por /ship/generate
  envia_tracking_number    text,
  envia_label_url          text,          -- url de la etiqueta para imprimir
  envia_generado_en        timestamptz,

  -- ── METADATA ───────────────────────────────────────────────
  creado_en                timestamptz   not null default now(),

  -- Se completa cuando el admin aprueba (trazabilidad con Finanzas)
  finanzas_mov_id          uuid,

  -- ── SOFT DELETE ────────────────────────────────────────────
  eliminado_en             timestamptz,
  eliminado_por            uuid,
  eliminado_por_email      text
);

-- ─── Índices ──────────────────────────────────────────────────

create index if not exists pizarras_compras_estado_idx
  on pizarras_compras (estado, eliminado_en, creado_en desc);

create index if not exists pizarras_compras_metodo_idx
  on pizarras_compras (metodo_pago, estado, eliminado_en);

create index if not exists pizarras_compras_pizarra_idx
  on pizarras_compras (pizarra_id, estado);

-- ─── Row Level Security ────────────────────────────────────────

alter table pizarras_compras enable row level security;

drop policy if exists "pizarras_compras_insert_public"     on pizarras_compras;
drop policy if exists "pizarras_compras_all_authenticated" on pizarras_compras;

create policy "pizarras_compras_insert_public"
  on pizarras_compras for insert
  with check (true);

create policy "pizarras_compras_all_authenticated"
  on pizarras_compras for all
  to authenticated
  using (true)
  with check (true);

grant insert on table pizarras_compras to anon;
grant all    on table pizarras_compras to authenticated;
