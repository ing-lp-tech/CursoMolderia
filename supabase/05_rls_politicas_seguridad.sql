-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — POLÍTICAS DE SEGURIDAD (RLS) COMPLETAS
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── Helper: función reutilizable para verificar si el usuario es admin ──────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

-- ══════════════════════════════════════════════════════════════════
-- TABLA: perfiles
-- Cada usuario solo ve y edita su propio perfil.
-- El admin puede ver y editar todos.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Borrar políticas viejas si existen
DROP POLICY IF EXISTS "perfiles_select_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_select_admin"  ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_admin"  ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_insert_own"    ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_delete_admin"  ON public.perfiles;

-- SELECT: usuario ve solo el suyo; admin ve todos
CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- INSERT: solo el propio usuario (lo crea el trigger de auth, pero por si acaso)
CREATE POLICY "perfiles_insert_own"
  ON public.perfiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- UPDATE: usuario actualiza el suyo (pero NO puede cambiar rol ni activo)
--         Admin puede actualizar cualquiera
CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    -- Si no es admin, no puede cambiar rol ni activo
    public.is_admin()
    OR (
      auth.uid() = id
      AND (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'estudiante'
    )
  );

-- DELETE: solo admin
CREATE POLICY "perfiles_delete_admin"
  ON public.perfiles FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: pagos
-- Estudiante puede ver y crear sus propios pagos.
-- Admin puede ver, crear y actualizar todos.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_select_own"    ON public.pagos;
DROP POLICY IF EXISTS "pagos_select_admin"  ON public.pagos;
DROP POLICY IF EXISTS "pagos_insert_own"    ON public.pagos;
DROP POLICY IF EXISTS "pagos_update_admin"  ON public.pagos;
DROP POLICY IF EXISTS "pagos_delete_admin"  ON public.pagos;

-- SELECT: estudiante ve los suyos; admin ve todos
CREATE POLICY "pagos_select_own"
  ON public.pagos FOR SELECT
  USING (auth.uid() = estudiante_id OR public.is_admin());

-- INSERT: el estudiante recién inscripto puede crear su propio pago
CREATE POLICY "pagos_insert_own"
  ON public.pagos FOR INSERT
  WITH CHECK (auth.uid() = estudiante_id OR public.is_admin());

-- UPDATE: solo admin puede confirmar / cambiar estado de pagos
CREATE POLICY "pagos_update_admin"
  ON public.pagos FOR UPDATE
  USING (public.is_admin());

-- DELETE: solo admin
CREATE POLICY "pagos_delete_admin"
  ON public.pagos FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: finanzas
-- Solo admin puede ver y gestionar los movimientos financieros.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.finanzas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finanzas_admin_all" ON public.finanzas;

CREATE POLICY "finanzas_admin_all"
  ON public.finanzas FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: finanzas_state (snapshot JSONB del estado de finanzas)
-- Solo admin.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.finanzas_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finanzas_state_admin_all" ON public.finanzas_state;

CREATE POLICY "finanzas_state_admin_all"
  ON public.finanzas_state FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: tareas (Kanban)
-- Solo admin puede gestionar tareas.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tareas_admin_all" ON public.tareas;

CREATE POLICY "tareas_admin_all"
  ON public.tareas FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: app_settings
-- Lectura pública (test mode lo lee la página de inscripción sin login).
-- Escritura solo admin.
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write"   ON public.app_settings;

-- Cualquiera puede leer configuración pública
CREATE POLICY "app_settings_public_select"
  ON public.app_settings FOR SELECT
  USING (true);

-- Solo admin puede escribir configuración
CREATE POLICY "app_settings_admin_write"
  ON public.app_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- TABLA: cupones (ya tiene RLS, reforzamos)
-- ══════════════════════════════════════════════════════════════════
-- Ya configurada en 02_rls_cupones.sql. Verificamos:
DROP POLICY IF EXISTS "cupones_public_select"  ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_insert"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_update"   ON public.cupones;
DROP POLICY IF EXISTS "cupones_admin_delete"   ON public.cupones;

CREATE POLICY "cupones_public_select"
  ON public.cupones FOR SELECT USING (true);

CREATE POLICY "cupones_admin_insert"
  ON public.cupones FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "cupones_admin_update"
  ON public.cupones FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "cupones_admin_delete"
  ON public.cupones FOR DELETE
  USING (public.is_admin());


-- ══════════════════════════════════════════════════════════════════
-- FUNCIÓN: prevenir que estudiantes cambien su propio rol
-- Trigger que se ejecuta antes de UPDATE en perfiles
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.prevent_rol_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el usuario que hace el UPDATE no es admin
  IF NOT public.is_admin() THEN
    -- Restaurar campos protegidos al valor original
    NEW.rol    := OLD.rol;
    NEW.activo := OLD.activo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_rol_on_update ON public.perfiles;
CREATE TRIGGER protect_rol_on_update
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rol_change();


-- ══════════════════════════════════════════════════════════════════
-- FUNCIÓN: rate limiting básico en pagos
-- Evita que un mismo email cree más de 5 pagos en 1 hora
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_pago_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.pagos
  WHERE estudiante_id = NEW.estudiante_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos de pago. Esperá un momento antes de intentar de nuevo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_pagos ON public.pagos;
CREATE TRIGGER rate_limit_pagos
  BEFORE INSERT ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pago_rate_limit();


-- ══════════════════════════════════════════════════════════════════
-- GRANT permisos explícitos al rol anon (usuarios no logueados)
-- Solo pueden leer cupones y app_settings (necesario para validar
-- cupones y leer test_mode antes de loguearse).
-- ══════════════════════════════════════════════════════════════════
GRANT SELECT ON public.cupones     TO anon;
GRANT SELECT ON public.app_settings TO anon;

-- ══════════════════════════════════════════════════════════════════
-- GRANT permisos al rol authenticated (usuarios logueados)
-- ══════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT ON public.pagos    TO authenticated;
GRANT SELECT, UPDATE ON public.perfiles TO authenticated;
GRANT SELECT         ON public.cupones  TO authenticated;
GRANT SELECT         ON public.app_settings TO authenticated;
GRANT USAGE, SELECT  ON ALL SEQUENCES IN SCHEMA public TO authenticated;
