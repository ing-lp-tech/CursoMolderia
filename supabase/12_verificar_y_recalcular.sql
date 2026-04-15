-- ============================================================
-- 12_verificar_y_recalcular.sql
-- Corre este script DESPUÉS del 11.
-- El 11 fallaba en el paso 6 porque no existe columna updated_at.
-- Este script lo corrige y verifica que todo esté funcionando.
-- ============================================================

-- 1. Recalcular TODAS las filas existentes disparando el trigger
--    (usa monto = monto que siempre funciona)
update public.finanzas_movimientos
set monto = monto;

-- 2. Verificar que el trigger existe
select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_table = 'finanzas_movimientos'
  and trigger_schema = 'public';

-- 3. Ver estado actual de todos los registros
select
  descripcion,
  tipo,
  monto          as "total",
  monto_pagado   as "pagado",
  deuda_restante as "restante",
  deuda_estado,
  tiene_deuda,
  jsonb_array_length(coalesce(pagos, '[]'::jsonb)) as "num_abonos"
from public.finanzas_movimientos
order by created_at desc;
