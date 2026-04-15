-- ============================================================
-- 10_finanzas_pagos_parciales.sql
-- Agrega soporte de pagos parciales a finanzas_movimientos:
--   · monto       = precio total acordado / facturado
--   · pagos       = JSONB array de abonos [{id, fecha, monto, metodo, notas}]
--   · monto_pagado = calculado automáticamente por trigger (suma de pagos)
--   · deuda_restante = monto - monto_pagado  (trigger)
--   · deuda_estado  = 'pendiente' | 'pagado'  (trigger, auto al llegar a 0)
-- ============================================================

-- 1. Nuevas columnas (seguro si ya corriste 09)
alter table public.finanzas_movimientos
  add column if not exists pagos          jsonb           not null default '[]'::jsonb,
  add column if not exists monto_pagado   numeric(12, 2)  not null default 0,
  add column if not exists deuda_restante numeric(12, 2)  not null default 0;

-- 2. Backfill columnas existentes
--    · Registros sin deuda → monto_pagado = monto, deuda_restante = 0
--    · Registros con deuda (tiene_deuda = true) → monto_pagado = 0, deuda_restante = monto
update public.finanzas_movimientos
set
  monto_pagado   = case when tiene_deuda then 0           else monto end,
  deuda_restante = case when tiene_deuda then monto       else 0     end
where monto_pagado = 0;

-- 3. Función del trigger
create or replace function public.fn_calcular_deuda_pagos()
returns trigger
language plpgsql
as $$
declare
  total_pagado numeric(12, 2);
begin
  if new.tiene_deuda then
    -- Suma todos los abonos del array JSONB
    select coalesce(sum((p ->> 'monto')::numeric), 0)
    into   total_pagado
    from   jsonb_array_elements(coalesce(new.pagos, '[]'::jsonb)) as p;

    new.monto_pagado   := total_pagado;
    new.deuda_restante := greatest(coalesce(new.monto, 0) - total_pagado, 0);

    -- Pasa a pagado automáticamente cuando se cubre el total
    if new.deuda_restante = 0 and new.monto > 0 then
      new.deuda_estado := 'pagado';
    else
      new.deuda_estado := 'pendiente';
    end if;
  else
    -- Sin deuda: todo se considera pagado
    new.monto_pagado   := coalesce(new.monto, 0);
    new.deuda_restante := 0;
  end if;

  return new;
end;
$$;

-- 4. Trigger (antes de insert/update)
drop trigger if exists trg_calcular_deuda_pagos on public.finanzas_movimientos;
create trigger trg_calcular_deuda_pagos
  before insert or update
  on public.finanzas_movimientos
  for each row
  execute function public.fn_calcular_deuda_pagos();

-- 5. Re-ejecutar trigger sobre filas existentes para que todo cuadre
update public.finanzas_movimientos set monto = monto;

-- 6. Índice para consultas de deuda pendiente
create index if not exists idx_finanzas_deuda_restante
  on public.finanzas_movimientos (deuda_restante)
  where tiene_deuda = true;
