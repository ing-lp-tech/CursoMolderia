-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 8 — Fix storage definitivo (sin bloques DO)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── Quitar restricción de MIME del bucket privado ────────────
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'moldes-archivos';

-- ─── Limpiar TODAS las políticas conocidas de storage ─────────

DROP POLICY IF EXISTS "imagenes_admin_insert"   ON storage.objects;
DROP POLICY IF EXISTS "imagenes_admin_update"   ON storage.objects;
DROP POLICY IF EXISTS "imagenes_admin_delete"   ON storage.objects;
DROP POLICY IF EXISTS "imagenes_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "archivos_admin_insert"   ON storage.objects;
DROP POLICY IF EXISTS "archivos_admin_update"   ON storage.objects;
DROP POLICY IF EXISTS "archivos_admin_delete"   ON storage.objects;
DROP POLICY IF EXISTS "img_select_public"       ON storage.objects;
DROP POLICY IF EXISTS "img_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "img_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "img_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "arc_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "arc_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "arc_delete_authenticated" ON storage.objects;

-- ─── Políticas bucket moldes-imagenes (público) ───────────────

CREATE POLICY "mi_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'moldes-imagenes');

CREATE POLICY "mi_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'moldes-imagenes');

CREATE POLICY "mi_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'moldes-imagenes');

CREATE POLICY "mi_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'moldes-imagenes');

-- ─── Políticas bucket moldes-archivos (privado) ───────────────
-- SELECT para authenticated: necesario para upsert y gestión de archivos
-- El acceso público sigue requiriendo signed URL (no hay policy para anon)

CREATE POLICY "ma_select_auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'moldes-archivos');

CREATE POLICY "ma_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'moldes-archivos');

CREATE POLICY "ma_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'moldes-archivos');

CREATE POLICY "ma_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'moldes-archivos');
