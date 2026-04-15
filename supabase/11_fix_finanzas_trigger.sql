-- ============================================================
-- 11_fix_finanzas_trigger.sql
-- Script seguro: corre aunque ya hayas corrido 09 y 10.
-- Asegura que todas las columnas, trigger y RLS estén correctos.
-- ============================================================

-- 1. Crear tabla si no existe (con TODAS las columnas)
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
  tiene_deuda   boolean not null default false,
  deuda_estado  text check (deuda_estado in ('pendiente', 'pagado')) default 'pendiente',
  pagos         jsonb not null default '[]'::jsonb,
  monto_pagado  numeric(12, 2) not null default 0,
  deuda_restante numeric(12, 2) not null default 0,
  comprobantes  text[] default '{}',
  created_at    timestamptz default now()
);

-- 2. Agregar columnas faltantes (sin error si ya existen)
alter table public.finanzas_movimientos
  add column if not exists pagos          jsonb          not null default '[]'::jsonb,
  add column if not exists monto_pagado   numeric(12,2)  not null default 0,
  add column if not exists deuda_restante numeric(12,2)  not null default 0,
  add column if not exists beneficiario   text,
  add column if not exists cobrador       text;

-- 3. Drop + Recrear trigger para garantizar que está actualizado
drop trigger if exists trg_calcular_deuda_pagos on public.finanzas_movimientos;
drop function if exists public.fn_calcular_deuda_pagos();
drop trigger if exists trg_calcular_deuda on public.finanzas_movimientos;
drop function if exists public.fn_calcular_deuda();

-- 4. Función del trigger (versión robusta)
create or replace function public.fn_calcular_deuda_pagos()
returns trigger
language plpgsql
as $$
declare
  v_total_pagado numeric(12, 2) := 0;
  v_monto        numeric(12, 2);
begin
  v_monto := coalesce(new.monto, 0);

  if new.tiene_deuda then
    -- Suma todos los abonos del array JSONB
    select coalesce(
      sum( (p ->> 'monto')::numeric ),
      0
    )
    into v_total_pagado
    from jsonb_array_elements( coalesce(new.pagos, '[]'::jsonb) ) as p;

    new.monto_pagado   := v_total_pagado;
    new.deuda_restante := greatest(v_monto - v_total_pagado, 0);

    -- Auto-saldo cuando se cubre el total
    if new.deuda_restante = 0 and v_monto > 0 then
      new.deuda_estado := 'pagado';
    else
      new.deuda_estado := 'pendiente';
    end if;

  else
    -- Pago completo al contado
    new.monto_pagado   := v_monto;
    new.deuda_restante := 0;
    new.deuda_estado   := 'pendiente'; -- no aplica para no-deudas
  end if;

  return new;
end;
$$;

-- 5. Crear el trigger
create trigger trg_calcular_deuda_pagos
  before insert or update
  on public.finanzas_movimientos
  for each row
  execute function public.fn_calcular_deuda_pagos();

-- 6. Recalcular TODAS las filas existentes con el trigger nuevo
--    (esto también corrige registros viejos que tenían monto_pagado = 0)
update public.finanzas_movimientos
set updated_at = coalesce(updated_at, now())  -- dummy update para disparar el trigger
where true;

-- Si la columna updated_at no existe, usá esta línea en su lugar:
-- update public.finanzas_movimientos set monto = monto where true;

-- 7. RLS (seguro aunque ya exista)
alter table public.finanzas_movimientos enable row level security;

drop policy if exists "Acceso total a autenticados" on public.finanzas_movimientos;
drop policy if exists "Acceso total anon"            on public.finanzas_movimientos;

create policy "Acceso total a autenticados"
  on public.finanzas_movimientos for all to authenticated
  using (true) with check (true);

create policy "Acceso total anon"
  on public.finanzas_movimientos for all to anon
  using (true) with check (true);

-- 8. Índices
create index if not exists idx_finanzas_tipo           on public.finanzas_movimientos (tipo);
create index if not exists idx_finanzas_fecha          on public.finanzas_movimientos (fecha desc);
create index if not exists idx_finanzas_deuda          on public.finanzas_movimientos (tiene_deuda) where tiene_deuda = true;
create index if not exists idx_finanzas_deuda_restante on public.finanzas_movimientos (deuda_restante) where tiene_deuda = true;

-- 9. Verificación: muestra el estado actual
select
  descripcion,
  monto          as "precio_total",
  monto_pagado   as "pagado",
  deuda_restante as "restante",
  deuda_estado,
  jsonb_array_length(pagos) as "num_abonos"
from public.finanzas_movimientos
order by created_at desc
limit 10;
