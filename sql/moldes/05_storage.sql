-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 5 DE 5 — Storage buckets y políticas de acceso
-- Buckets: moldes-imagenes (público) y moldes-archivos (privado)
--
-- Se puede ejecutar en cualquier orden respecto a los otros scripts.
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── Bucket: moldes-imagenes (PÚBLICO) ───────────────────────
-- Contiene: imágenes de preview de cada molde (JPG/WEBP comprimidas)
-- Acceso: cualquiera puede leer (es la portada/preview del producto)
-- Tamaño máx: 2 MB (las imágenes se comprimen en el browser antes de subir)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'moldes-imagenes',
  'moldes-imagenes',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ─── Bucket: moldes-archivos (PRIVADO) ───────────────────────
-- Contiene: archivos .ads de Audaces y PDFs del molde
-- Acceso: NADIE puede leer directamente
--         Solo se accede via signed URL generada por el backend (api/molde-aprobar.js)
--         después de que el admin aprueba la compra
-- Tamaño máx: 50 MB (archivos Audaces pueden ser grandes)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'moldes-archivos',
  'moldes-archivos',
  false,
  52428800,
  array[
    'application/octet-stream',      -- archivos .ads de Audaces
    'application/pdf',               -- PDFs
    'application/zip',               -- por si se comprime el .ads
    'application/x-zip-compressed'
  ]
)
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════
-- POLÍTICAS — moldes-imagenes (bucket público)
-- ══════════════════════════════════════════════════════════════

-- Admin puede subir imágenes
create policy "imagenes_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'moldes-imagenes'
    and auth.role() = 'authenticated'
  );

-- Admin puede reemplazar/actualizar imágenes
create policy "imagenes_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'moldes-imagenes'
    and auth.role() = 'authenticated'
  );

-- Admin puede borrar imágenes (al eliminar definitivamente un molde)
create policy "imagenes_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'moldes-imagenes'
    and auth.role() = 'authenticated'
  );

-- Cualquiera puede leer imágenes (son previews públicos del catálogo)
create policy "imagenes_public_read"
  on storage.objects for select
  using (bucket_id = 'moldes-imagenes');

-- ══════════════════════════════════════════════════════════════
-- POLÍTICAS — moldes-archivos (bucket privado)
-- ══════════════════════════════════════════════════════════════

-- Admin puede subir archivos .ads y PDFs
create policy "archivos_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'moldes-archivos'
    and auth.role() = 'authenticated'
  );

-- Admin puede reemplazar archivos
create policy "archivos_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'moldes-archivos'
    and auth.role() = 'authenticated'
  );

-- Admin puede borrar archivos (al eliminar definitivamente un molde de la papelera)
create policy "archivos_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'moldes-archivos'
    and auth.role() = 'authenticated'
  );

-- NO se crea policy de SELECT para moldes-archivos.
-- Con RLS activo y sin policy de lectura = acceso denegado a todos.
-- Los archivos SOLO son accesibles via signed URL generada por el backend
-- usando la SUPABASE_SERVICE_ROLE_KEY (variable de entorno en Vercel).
-- Las signed URLs tienen validez de 24 horas.
