-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 3 DE 3 — Storage bucket para imágenes de pizarras
-- Bucket: pizarras-imagenes (público)
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pizarras-imagenes',
  'pizarras-imagenes',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "pizarras_img_select_public"      on storage.objects;
drop policy if exists "pizarras_img_insert_authenticated" on storage.objects;
drop policy if exists "pizarras_img_update_authenticated" on storage.objects;
drop policy if exists "pizarras_img_delete_authenticated" on storage.objects;

create policy "pizarras_img_select_public"
  on storage.objects for select
  using (bucket_id = 'pizarras-imagenes');

create policy "pizarras_img_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pizarras-imagenes');

create policy "pizarras_img_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pizarras-imagenes');

create policy "pizarras_img_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pizarras-imagenes');
