-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 7 — Fix definitivo RLS + Storage
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. GRANTS explícitos (por si Supabase no los aplicó) ────

GRANT ALL ON TABLE moldes               TO authenticated;
GRANT ALL ON TABLE moldes_categorias    TO authenticated;
GRANT ALL ON TABLE moldes_subcategorias TO authenticated;
GRANT ALL ON TABLE moldes_compras       TO authenticated;
GRANT INSERT ON TABLE moldes_compras    TO anon;
GRANT SELECT ON TABLE moldes            TO anon;
GRANT SELECT ON TABLE moldes_categorias TO anon;
GRANT SELECT ON TABLE moldes_subcategorias TO anon;

-- ─── 2. Limpiar TODAS las políticas de moldes ─────────────────

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE tablename IN ('moldes','moldes_categorias','moldes_subcategorias','moldes_compras')
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ─── 3. Recrear políticas de moldes (sin auth.role()) ────────

-- moldes: lectura pública solo activos
CREATE POLICY "moldes_select_public"
  ON moldes FOR SELECT
  USING (activo = true AND eliminado_en IS NULL);

-- moldes: admin autenticado puede todo
CREATE POLICY "moldes_all_authenticated"
  ON moldes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- moldes_categorias: lectura pública activos
CREATE POLICY "moldes_cat_select_public"
  ON moldes_categorias FOR SELECT
  USING (eliminado_en IS NULL);

-- moldes_categorias: admin puede todo
CREATE POLICY "moldes_cat_all_authenticated"
  ON moldes_categorias FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- moldes_subcategorias: lectura pública
CREATE POLICY "moldes_subcat_select_public"
  ON moldes_subcategorias FOR SELECT
  USING (eliminado_en IS NULL);

-- moldes_subcategorias: admin puede todo
CREATE POLICY "moldes_subcat_all_authenticated"
  ON moldes_subcategorias FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- moldes_compras: cualquiera puede insertar
CREATE POLICY "moldes_compras_insert_public"
  ON moldes_compras FOR INSERT
  WITH CHECK (true);

-- moldes_compras: admin puede todo
CREATE POLICY "moldes_compras_all_authenticated"
  ON moldes_compras FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── 4. Actualizar bucket moldes-archivos ─────────────────────
-- Quitar restricción de MIME types para evitar falsos rechazos
-- El archivo .ads puede no ser reconocido como application/octet-stream

UPDATE storage.buckets
SET allowed_mime_types = NULL   -- acepta CUALQUIER tipo de archivo
WHERE id = 'moldes-archivos';

-- ─── 5. Limpiar y recrear políticas de Storage ───────────────

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND (policyname LIKE '%imagenes%' OR policyname LIKE '%archivos%'
           OR policyname LIKE '%img_%' OR policyname LIKE '%arc_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Storage moldes-imagenes: lectura pública
CREATE POLICY "img_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'moldes-imagenes');

-- Storage moldes-imagenes: admins suben/borran
CREATE POLICY "img_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'moldes-imagenes');

CREATE POLICY "img_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'moldes-imagenes');

CREATE POLICY "img_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'moldes-imagenes');

-- Storage moldes-archivos: admins suben/borran (sin SELECT → solo via signed URL)
CREATE POLICY "arc_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'moldes-archivos');

CREATE POLICY "arc_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'moldes-archivos');

CREATE POLICY "arc_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'moldes-archivos');
