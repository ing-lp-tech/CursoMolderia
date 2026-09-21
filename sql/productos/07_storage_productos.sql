-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 07 — Bucket de imágenes de productos
-- Bucket: productos-imagenes (PÚBLICO)
--
-- EJECUTAR DESPUÉS de 02_productos.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Crea el bucket donde van todas las fotos de productos, con una carpeta
-- por categoría:
--
--   {categoria-slug}/{producto_id}/img_1.webp     imagen de detalle
--   {categoria-slug}/{producto_id}/thumb_1.webp   miniatura del catálogo
--
-- Hasta hoy las fotos de plotters, PCs y accesorios se guardaban en
-- `pizarras-imagenes`, un bucket que quedó con el nombre viejo. Un solo
-- bucket ordenado por categoría, y el viejo se borra en el script 11.
--
-- ── POR QUÉ UNA MINIATURA APARTE ───────────────────────────────
-- Las tarjetas del catálogo mostraban la imagen de detalle completa
-- (~250 KB). Con 12 productos en pantalla son ~3 MB de descarga. La
-- miniatura de 480px pesa ~25 KB: la misma pantalla baja a ~300 KB.
--
-- ── NO ES UNA MIGRACIÓN ────────────────────────────────────────
-- Este script NO mueve ningún archivo. Las fotos que ya están siguen en
-- el bucket viejo y se sirven desde ahí: `imgUrl()` decide el bucket por
-- la forma del path (2 segmentos = viejo, 3 = nuevo). Cuando vuelvas a
-- subir esas fotos desde el panel quedan en el bucket nuevo solas.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   delete from storage.objects where bucket_id = 'productos-imagenes';
--   delete from storage.buckets where id = 'productos-imagenes';
--   (las fotos viejas no se tocan: viven en el otro bucket)
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.productos') is null then
    raise exception 'Falta correr 02_productos.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- BUCKET
-- Mismo límite y mismos tipos que el bucket viejo, más WebP, que es lo
-- que sube el panel desde ahora.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos-imagenes',
  'productos-imagenes',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════
-- POLICIES
-- Lectura pública (es el catálogo); escritura solo para el admin.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "productos_img_select_public"        on storage.objects;
drop policy if exists "productos_img_insert_authenticated" on storage.objects;
drop policy if exists "productos_img_update_authenticated" on storage.objects;
drop policy if exists "productos_img_delete_authenticated" on storage.objects;

create policy "productos_img_select_public"
  on storage.objects for select
  using (bucket_id = 'productos-imagenes');

create policy "productos_img_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'productos-imagenes');

create policy "productos_img_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'productos-imagenes');

create policy "productos_img_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'productos-imagenes');

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- El bucket nuevo vacío, el viejo con las fotos de siempre y las
-- 4 policies creadas.
-- ═══════════════════════════════════════════════════════════════

select b.id                                                    as bucket,
       b.public                                                as es_publico,
       (select count(*) from storage.objects o
         where o.bucket_id = b.id)                             as archivos,
       (select count(*) from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname like 'productos_img_%')              as policies_nuevas
from storage.buckets b
where b.id in ('productos-imagenes', 'pizarras-imagenes')
order by b.id;
