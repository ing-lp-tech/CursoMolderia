-- ══════════════════════════════════════════════════════
-- 3. NUEVAS COLUMNAS EN LA TABLA PAGOS
-- ══════════════════════════════════════════════════════
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS cupon_codigo       text,
  ADD COLUMN IF NOT EXISTS monto_original     numeric,
  ADD COLUMN IF NOT EXISTS descuento_aplicado numeric DEFAULT 0;

-- cupon_codigo       → código del cupón usado (NULL = sin descuento)
-- monto_original     → precio antes del descuento
-- descuento_aplicado → cuánto se ahorró el cliente
