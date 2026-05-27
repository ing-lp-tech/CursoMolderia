-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 6 — Fix RLS de tablas y políticas de Storage
--
-- Problema 1: "new row violates row-level security policy" en moldes
--   → La política usaba auth.role() que puede fallar en versiones nuevas
--   → Se reemplaza por auth.uid() IS NOT NULL (más confiable)
--
-- Problema 2: 400 al subir .ads a moldes-archivos
--   → El bucket privado no tenía política INSERT para admins autenticados
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Fix RLS tabla moldes ──────────────────────────────────

DROP POLICY IF EXISTS "moldes_admin_all" ON moldes;

-- Solo lectura pública para moldes activos
DROP POLICY IF EXISTS "moldes_public_read" ON moldes;
CREATE POLICY "moldes_public_read"
  ON moldes FOR SELECT
  USING (activo = true AND eliminado_en IS NULL);

-- Admin autenticado: acceso completo
CREATE POLICY "moldes_admin_all"
  ON moldes FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 2. Fix RLS tabla moldes_categorias ──────────────────────

DROP POLICY IF EXISTS "categorias_admin_all" ON moldes_categorias;
DROP POLICY IF EXISTS "categorias_public_read" ON moldes_categorias;

CREATE POLICY "categorias_public_read"
  ON moldes_categorias FOR SELECT
  USING (activo = true AND eliminado_en IS NULL);

CREATE POLICY "categorias_admin_all"
  ON moldes_categorias FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3. Fix RLS tabla moldes_subcategorias ────────────────────

DROP POLICY IF EXISTS "subcategorias_admin_all" ON moldes_subcategorias;
DROP POLICY IF EXISTS "subcategorias_public_read" ON moldes_subcategorias;

CREATE POLICY "subcategorias_public_read"
  ON moldes_subcategorias FOR SELECT
  USING (activo = true AND eliminado_en IS NULL);

CREATE POLICY "subcategorias_admin_all"
  ON moldes_subcategorias FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 4. Fix RLS tabla moldes_compras ─────────────────────────

DROP POLICY IF EXISTS "compras_admin_all" ON moldes_compras;
DROP POLICY IF EXISTS "compras_public_insert" ON moldes_compras;

-- Cualquier visitante puede insertar su propia compra
CREATE POLICY "compras_public_insert"
  ON moldes_compras FOR INSERT
  WITH CHECK (true);

-- Admin autenticado: puede leer y modificar todo
CREATE POLICY "compras_admin_all"
  ON moldes_compras FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 5. Políticas de Storage para moldes-imagenes ────────────
-- (bucket público — admins pueden subir/borrar imágenes)

DROP POLICY IF EXISTS "imagenes_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "imagenes_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "imagenes_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "imagenes_public_select" ON storage.objects;

CREATE POLICY "imagenes_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'moldes-imagenes');

CREATE POLICY "imagenes_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'moldes-imagenes'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "imagenes_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'moldes-imagenes'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "imagenes_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'moldes-imagenes'
    AND auth.uid() IS NOT NULL
  );

-- ─── 6. Políticas de Storage para moldes-archivos ────────────
-- (bucket privado — admins suben, nadie descarga directamente)

DROP POLICY IF EXISTS "archivos_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "archivos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "archivos_admin_delete" ON storage.objects;

CREATE POLICY "archivos_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'moldes-archivos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "archivos_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'moldes-archivos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "archivos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'moldes-archivos'
    AND auth.uid() IS NOT NULL
  );

-- Sin política SELECT en moldes-archivos → solo accesible via signed URL
