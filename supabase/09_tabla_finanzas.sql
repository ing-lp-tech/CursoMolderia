-- ============================================================
-- 09_tabla_finanzas.sql
-- Tabla de movimientos financieros (ingresos y egresos)
-- con soporte para deudas integradas.
-- ============================================================

-- 1. Eliminar tabla vieja de blob si existía
drop table if exists public.finanzas_state;

-- 2. Crear tabla de movimientos
create table if not exists public.finanzas_movimientos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('ingreso', 'egreso')),
  categoria     text not null,
  descripcion   text not null,
  monto         numeric(12, 2) not null check (monto >= 0),
  fecha         date not null,
  metodo        text default 'Transferencia bancaria',
  cobrador      text,
  beneficiario  text,
  notas         text,

  -- Deuda integrada:
  -- ingreso + tiene_deuda = "me deben" (cobro pendiente)
  -- egreso  + tiene_deuda = "les debo" (pago pendiente)
  tiene_deuda   boolean not null default false,
  deuda_estado  text check (deuda_estado in ('pendiente', 'pagado')) default 'pendiente',

  comprobantes  text[] default '{}',
  created_at    timestamptz default now()
);

-- 3. Índices útiles
create index if not exists idx_finanzas_tipo  on public.finanzas_movimientos (tipo);
create index if not exists idx_finanzas_fecha on public.finanzas_movimientos (fecha desc);
create index if not exists idx_finanzas_deuda on public.finanzas_movimientos (tiene_deuda) where tiene_deuda = true;

-- 4. RLS
alter table public.finanzas_movimientos enable row level security;

-- Permite acceso total a usuarios autenticados (admin)
create policy "Acceso total a autenticados"
  on public.finanzas_movimientos
  for all
  to authenticated
  using (true)
  with check (true);

-- Si querés también acceso anon (ej. anon key desde frontend sin auth):
create policy "Acceso total anon"
  on public.finanzas_movimientos
  for all
  to anon
  using (true)
  with check (true);

-- 5. Bucket para comprobantes (ejecutar solo si no existe)
-- Ir a Storage en Supabase y crear bucket "comprobantes" como público,
-- o ejecutar esto si tenés permisos de service_role:
-- insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true) on conflict do nothing;
