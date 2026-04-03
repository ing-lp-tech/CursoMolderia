-- ══════════════════════════════════════════════════════
-- 4. FUNCIÓN PARA INCREMENTO ATÓMICO DE USOS DE CUPÓN
--    Evita race conditions si dos personas usan el
--    mismo cupón exactamente al mismo tiempo.
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_cupon_used_count(cupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.cupones
  SET used_count = used_count + 1
  WHERE id = cupon_id;
$$;
