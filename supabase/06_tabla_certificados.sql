-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — TABLA CERTIFICADOS
-- Registra cada certificado emitido a un estudiante
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.certificados (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_id         uuid REFERENCES public.perfiles(id) ON DELETE CASCADE NOT NULL,
  nombre_en_certificado text NOT NULL,
  fecha_emision         date NOT NULL,
  firmante1             text,
  firmante2             text,
  cargo1                text,
  cargo2                text,
  emitido_por           uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now() NOT NULL
);

-- Índice para buscar certificados por estudiante
CREATE INDEX IF NOT EXISTS certificados_estudiante_id_idx ON public.certificados (estudiante_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificados_admin_all"   ON public.certificados;
DROP POLICY IF EXISTS "certificados_select_own"  ON public.certificados;

-- Admin puede hacer todo
CREATE POLICY "certificados_admin_all"
  ON public.certificados FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- El propio estudiante puede ver sus certificados (útil para el portal)
CREATE POLICY "certificados_select_own"
  ON public.certificados FOR SELECT
  USING (auth.uid() = estudiante_id);

-- Permisos para el rol authenticated
GRANT SELECT ON public.certificados TO authenticated;
