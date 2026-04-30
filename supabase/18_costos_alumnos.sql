-- ============================================================
-- 18_costos_alumnos.sql
-- EJECUTAR EN: Supabase → SQL Editor
-- Tabla de calculadora de costos por alumno
-- ============================================================

CREATE TABLE IF NOT EXISTS public.costos_alumnos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id       UUID          NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_proyecto     TEXT          NOT NULL,
  fecha               DATE          NOT NULL DEFAULT CURRENT_DATE,
  unidad_tela         TEXT          NOT NULL DEFAULT 'metros',
  cantidad_prendas    NUMERIC(10,2) NOT NULL DEFAULT 1,
  fabric_qty          NUMERIC(12,2) NOT NULL DEFAULT 0,
  fabric_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_costura       NUMERIC(12,2) NOT NULL DEFAULT 0,
  detalle_insumos     JSONB         NOT NULL DEFAULT '[]',
  margen_ganancia     NUMERIC(5,2)  NOT NULL DEFAULT 30,
  -- Resultados calculados (guardados para historial)
  costo_tela_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_costura_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_insumos_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_unitario      NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta        NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   DEFAULT now(),
  updated_at          TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_costos_alumnos_estudiante
  ON public.costos_alumnos (estudiante_id, created_at DESC);

-- RLS: cada alumno ve/edita solo los suyos; admin ve todos
ALTER TABLE public.costos_alumnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costos_select" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_insert" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_update" ON public.costos_alumnos;
DROP POLICY IF EXISTS "costos_delete" ON public.costos_alumnos;

CREATE POLICY "costos_select" ON public.costos_alumnos FOR SELECT
  USING (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_insert" ON public.costos_alumnos FOR INSERT
  WITH CHECK (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_update" ON public.costos_alumnos FOR UPDATE
  USING (auth.uid() = estudiante_id OR public.is_admin());

CREATE POLICY "costos_delete" ON public.costos_alumnos FOR DELETE
  USING (auth.uid() = estudiante_id OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costos_alumnos TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Tabla costos_alumnos creada correctamente ✓' AS status;
