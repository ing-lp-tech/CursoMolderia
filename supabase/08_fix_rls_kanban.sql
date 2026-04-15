-- ══════════════════════════════════════════════════════════════════
-- FIX: Habilitar RLS en tablas Kanban
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- columnas_kanban: ya tiene policy, solo falta activar RLS
ALTER TABLE public.columnas_kanban ENABLE ROW LEVEL SECURITY;

-- kanban_state: activar RLS + crear policy de admin
ALTER TABLE public.kanban_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_state_admin_all" ON public.kanban_state;
CREATE POLICY "kanban_state_admin_all"
  ON public.kanban_state FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
