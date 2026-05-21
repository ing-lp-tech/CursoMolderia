-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20: Carpetas de recursos
-- Agrupa recursos en carpetas con nombres personalizados.
-- Migra automáticamente los módulos existentes a carpetas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabla carpetas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carpetas (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT        NOT NULL,
  orden      INT         DEFAULT 0,
  activo     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.carpetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_carpetas"  ON public.carpetas;
DROP POLICY IF EXISTS "auth_ver_carpetas"   ON public.carpetas;

CREATE POLICY "admin_all_carpetas" ON public.carpetas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth_ver_carpetas" ON public.carpetas
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'estudiante' AND activo = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carpetas TO authenticated;

-- ── 2. Columna carpeta_id en recursos ────────────────────────────────────────
ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS carpeta_id UUID REFERENCES public.carpetas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recursos_carpeta_id_idx ON public.recursos (carpeta_id, orden);

-- ── 3. Actualizar CHECK para agregar tipo 'imagen' ───────────────────────────
ALTER TABLE public.recursos DROP CONSTRAINT IF EXISTS recursos_tipo_check;
ALTER TABLE public.recursos
  ADD CONSTRAINT recursos_tipo_check CHECK (tipo IN ('video', 'pdf', 'link', 'imagen'));

-- ── 4. Migrar módulos existentes → carpetas ──────────────────────────────────
-- Crea automáticamente "Módulo 1", "Módulo 2", etc. y reasigna los recursos.
DO $$
DECLARE
  m   INT;
  cid UUID;
BEGIN
  FOR m IN
    SELECT DISTINCT modulo FROM public.recursos WHERE modulo IS NOT NULL ORDER BY modulo
  LOOP
    SELECT id INTO cid FROM public.carpetas WHERE nombre = 'Módulo ' || m;

    IF cid IS NULL THEN
      INSERT INTO public.carpetas (nombre, orden)
      VALUES ('Módulo ' || m, m)
      RETURNING id INTO cid;
    END IF;

    UPDATE public.recursos
    SET carpeta_id = cid
    WHERE modulo = m AND carpeta_id IS NULL;
  END LOOP;
END $$;
