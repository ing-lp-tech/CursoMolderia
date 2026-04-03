-- ══════════════════════════════════════════════════════
-- 2. RLS PARA CUPONES
-- ══════════════════════════════════════════════════════
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer (para validar cupones en la página
-- de inscripción sin necesidad de estar logueado)
CREATE POLICY "cupones_public_select"
  ON public.cupones FOR SELECT
  USING (true);

-- Solo admin puede crear cupones
CREATE POLICY "cupones_admin_insert"
  ON public.cupones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admin puede editar cupones
CREATE POLICY "cupones_admin_update"
  ON public.cupones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admin puede eliminar cupones
CREATE POLICY "cupones_admin_delete"
  ON public.cupones FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );
