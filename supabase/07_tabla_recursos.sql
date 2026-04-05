-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — TABLA RECURSOS (videos, PDFs, links)
-- Los alumnos activos los ven en su portal
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.recursos (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      text    NOT NULL,
  descripcion text,
  tipo        text    NOT NULL CHECK (tipo IN ('video', 'pdf', 'link')),
  url         text    NOT NULL,
  modulo      int,                    -- número de módulo (1-9), NULL = general
  orden       int     DEFAULT 0,      -- orden de aparición dentro del módulo
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS recursos_modulo_orden_idx ON public.recursos (modulo, orden);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recursos_admin_all"            ON public.recursos;
DROP POLICY IF EXISTS "recursos_select_authenticated"  ON public.recursos;

-- Admin gestiona todo
CREATE POLICY "recursos_admin_all"
  ON public.recursos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Solo alumnos ACTIVOS pueden leer recursos activos
CREATE POLICY "recursos_select_authenticated"
  ON public.recursos FOR SELECT
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid()
        AND rol = 'estudiante'
        AND activo = true
    )
  );

-- Admin puede gestionar todo, alumnos autenticados solo leer los activos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos TO authenticated;
