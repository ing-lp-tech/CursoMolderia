-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 21: Solo el super admin puede eliminar/restaurar ventas de moldes
-- Aunque el otro admin tenga rol='admin' (is_admin() = true) y pueda aprobar
-- o rechazar ventas, no debe poder enviar registros a la papelera ni
-- restaurarlos. Esto se aplica con un trigger para que no dependa solo del
-- botón oculto en el frontend (evita que se salte por consola del navegador).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'ing.lp.tech@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.fn_bloquear_eliminacion_compras()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.eliminado_en IS DISTINCT FROM OLD.eliminado_en)
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el super admin puede eliminar o restaurar ventas';
  END IF;

  IF TG_OP = 'DELETE' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el super admin puede eliminar ventas';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_eliminacion_compras_upd ON public.moldes_compras;
CREATE TRIGGER trg_bloquear_eliminacion_compras_upd
  BEFORE UPDATE ON public.moldes_compras
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_eliminacion_compras();

DROP TRIGGER IF EXISTS trg_bloquear_eliminacion_compras_del ON public.moldes_compras;
CREATE TRIGGER trg_bloquear_eliminacion_compras_del
  BEFORE DELETE ON public.moldes_compras
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_eliminacion_compras();
