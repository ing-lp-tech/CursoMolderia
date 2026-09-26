-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 09 — Cola de digitalizaciones
-- Tabla: digitalizaciones  ·  Bucket: digitalizaciones (PRIVADO)
--
-- EJECUTAR DESPUÉS de 05_creditos.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Deja la mesa puesta para el programador que hace el pasaje de foto a
-- PDF/DXF. Acá NO hay nada de visión por computadora: hay una cola de
-- trabajos, un bucket privado, los estados y el descuento automático
-- del crédito. Él lee filas, procesa y escribe el resultado.
--
--   pendiente  → recién cargada, esperando al procesador
--   procesando → él la tomó
--   procesado  → listo: escribió el PDF/DXF · ACÁ SE DESCUENTA EL CRÉDITO
--   error      → falló · NO se descuenta nada
--
-- ── EL DESCUENTO ES DE LA BASE, NO DE SU CÓDIGO ────────────────
-- Un trigger mueve `digitalizacion_creditos.creditos_usados` cuando la
-- fila pasa a 'procesado'. Si él se olvida de descontar, igual se
-- descuenta; y no hay doble cobro, porque la columna `credito_consumido`
-- marca esta fila como ya cobrada y el trigger no la vuelve a tocar.
--
-- Si al momento de procesar no quedaban créditos, la fila igual pasa a
-- 'procesado' pero queda con `credito_consumido = false`: el trabajo ya
-- está hecho, bloquearlo no lo desharía, y en el panel se ve el caso.
--
-- ── DÓNDE SE GUARDAN LOS ARCHIVOS ──────────────────────────────
--   {codigo}/{digitalizacion_id}/original.jpg   la foto del cliente
--   {codigo}/{digitalizacion_id}/molde.pdf      resultado
--   {codigo}/{digitalizacion_id}/molde.dxf      resultado
--
-- Bucket PRIVADO: se baja por signed URL, el mismo mecanismo que ya usa
-- `moldes-archivos`.
--
-- ── LA FOTO ORIGINAL NO SE COMPRIME ────────────────────────────
-- El plan decía `original.webp`. Se guarda el archivo tal cual vino, con
-- su extensión real: el procesador mide sobre esos píxeles (marcadores
-- ArUco, escala), y recomprimir a 1200px le saca justo la precisión que
-- necesita. Por eso el límite de tamaño acá es de 20 MB y no de 2 MB
-- como en el bucket del catálogo.
--
-- ── RLS ────────────────────────────────────────────────────────
-- Sin acceso `anon`, igual que `digitalizacion_creditos`. La app externa
-- tampoco entra por acá: habla con `api/digitalizacion.js` (ver
-- README.md), nunca con Supabase directo.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop table digitalizaciones;
--   drop function if exists fn_consumir_credito();
--   delete from storage.objects where bucket_id = 'digitalizaciones';
--   delete from storage.buckets where id = 'digitalizaciones';
--   (los códigos y sus créditos no se tocan: viven en la otra tabla)
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.digitalizacion_creditos') is null then
    raise exception 'Falta correr 05_creditos.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA — digitalizaciones
-- ═══════════════════════════════════════════════════════════════

create table if not exists digitalizaciones (
  id                   uuid        primary key default gen_random_uuid(),

  credito_id           uuid        references digitalizacion_creditos(id) on delete set null,

  -- Snapshot: si el código se borra, la galería sigue diciendo con cuál
  -- se cargó este trabajo.
  codigo               text,

  -- Snapshot del cliente: la galería filtra y busca por acá sin joins.
  cliente_nombre       text,
  cliente_whatsapp     text,
  cliente_email        text,

  imagen_original_path text,

  estado_procesamiento text        not null default 'pendiente'
                         check (estado_procesamiento in ('pendiente', 'procesando', 'procesado', 'error')),

  -- Los escribe el otro programador
  archivo_pdf_path     text,
  archivo_dxf_path     text,
  archivo_plt_path     text,
  error_mensaje        text,

  -- Entrada libre para el procesador (escala, marcadores, DPI…) y salida
  -- libre (piezas detectadas, medidas…). jsonb para que él agregue campos
  -- sin pedir una migración cada vez.
  parametros           jsonb       not null default '{}'::jsonb,
  resultado_meta       jsonb,

  -- Lo maneja el trigger de abajo: marca que esta fila ya pagó su crédito.
  credito_consumido    boolean     not null default false,

  procesado_en         timestamptz,
  notas                text,

  -- Soft delete (papelera)
  eliminado_en         timestamptz,
  eliminado_por        uuid,
  eliminado_por_email  text,

  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);

-- La cola que lee el procesador: pendientes, más viejas primero.
create index if not exists digitalizaciones_cola_idx
  on digitalizaciones (estado_procesamiento, creado_en);

-- La búsqueda del panel: todo lo de un cliente.
create index if not exists digitalizaciones_cliente_idx
  on digitalizaciones (cliente_whatsapp, creado_en desc);

create index if not exists digitalizaciones_credito_idx
  on digitalizaciones (credito_id)
  where credito_id is not null;

drop trigger if exists trg_digitalizaciones_actualizado_en on digitalizaciones;
create trigger trg_digitalizaciones_actualizado_en
  before update on digitalizaciones
  for each row execute function fn_set_actualizado_en();

-- ═══════════════════════════════════════════════════════════════
-- CONSUMO AUTOMÁTICO DEL CRÉDITO
--
-- BEFORE y no AFTER —el plan decía AFTER— porque así el trigger deja
-- marcada la fila (`credito_consumido`, `procesado_en`) en la misma
-- escritura, sin un segundo update que volvería a dispararlo.
--
-- El descuento es UNA sentencia con la condición adentro:
--
--   set creditos_usados = creditos_usados + 1 where creditos_usados < total
--
-- "Leo, sumo, guardo" haría que dos digitalizaciones simultáneas gasten
-- un solo crédito. Cero filas afectadas = no quedaban créditos.
-- ═══════════════════════════════════════════════════════════════

create or replace function fn_consumir_credito()
returns trigger as $$
declare
  v_filas integer;
begin
  if new.estado_procesamiento = 'procesado' and not new.credito_consumido then
    if new.credito_id is null then
      return new;                       -- carga suelta, sin código asociado
    end if;

    update digitalizacion_creditos
       set creditos_usados = creditos_usados + 1
     where id = new.credito_id
       and estado <> 'anulado'
       and creditos_usados < creditos_total;

    get diagnostics v_filas = row_count;

    -- Sin créditos disponibles el trabajo igual queda procesado, pero sin
    -- cobrar: en el panel se ve "sin crédito" y se resuelve a mano.
    new.credito_consumido := v_filas > 0;
    new.procesado_en      := coalesce(new.procesado_en, now());

  -- Corrección: salió de 'procesado' (p. ej. se reabrió como 'error').
  -- Se devuelve el crédito que esta fila había gastado.
  elsif new.estado_procesamiento <> 'procesado' and new.credito_consumido then
    update digitalizacion_creditos
       set creditos_usados = greatest(0, creditos_usados - 1)
     where id = new.credito_id;

    new.credito_consumido := false;
    new.procesado_en      := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_digitalizacion_consume_credito on digitalizaciones;
create trigger trg_digitalizacion_consume_credito
  before insert or update of estado_procesamiento on digitalizaciones
  for each row execute function fn_consumir_credito();

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security — ESTA TABLA NO ES PÚBLICA
--
-- Mismo criterio que `digitalizacion_creditos` (script 05): el panel
-- entra como `authenticated`, el visitante no entra. La app externa
-- no toca esta tabla: va por `api/digitalizacion.js`.
-- ═══════════════════════════════════════════════════════════════

alter table digitalizaciones enable row level security;

drop policy if exists "digitalizaciones_all_authenticated" on digitalizaciones;

create policy "digitalizaciones_all_authenticated"
  on digitalizaciones for all
  to authenticated
  using (true)
  with check (true);

revoke all on table digitalizaciones from anon;
grant all  on table digitalizaciones to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- BUCKET — digitalizaciones (PRIVADO)
--
-- 20 MB por archivo: entra una foto de celular sin recomprimir y también
-- el PDF con el molde a escala. `application/octet-stream` está porque
-- los .dxf y .plt no tienen un mime propio confiable.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digitalizaciones',
  'digitalizaciones',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
    'image/vnd.dxf', 'application/dxf', 'application/octet-stream', 'text/plain'
  ]
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ═══════════════════════════════════════════════════════════════
-- POLICIES DEL BUCKET
--
-- Diferencia con `moldes-archivos`, que no tiene SELECT para nadie: allá
-- las signed URL las firma un endpoint con service role. Acá la galería
-- del panel firma desde el navegador, y para eso `authenticated` necesita
-- SELECT. El visitante anónimo sigue sin ver nada, que es lo que importa:
-- son fotos de clientes.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists "digitalizaciones_select_authenticated" on storage.objects;
drop policy if exists "digitalizaciones_insert_authenticated" on storage.objects;
drop policy if exists "digitalizaciones_update_authenticated" on storage.objects;
drop policy if exists "digitalizaciones_delete_authenticated" on storage.objects;

create policy "digitalizaciones_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'digitalizaciones');

create policy "digitalizaciones_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'digitalizaciones');

create policy "digitalizaciones_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'digitalizaciones');

create policy "digitalizaciones_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'digitalizaciones');

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- La tabla vacía, el trigger vivo, el bucket privado y anon afuera.
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Tabla digitalizaciones' as chequeo,
         coalesce(to_regclass('public.digitalizaciones')::text, 'NO SE CREÓ') as valor
  union all select 2, 'Trabajos cargados hasta ahora',
         (select count(*)::text from digitalizaciones)
  union all select 3, 'Trigger de consumo de crédito',
         case when exists (select 1 from pg_trigger
                            where tgname = 'trg_digitalizacion_consume_credito')
              then 'OK — creado' else 'NO SE CREÓ' end
  union all select 4, 'Bucket digitalizaciones',
         coalesce((select case when public then 'PROBLEMA: es público' else 'OK — privado' end
                     from storage.buckets where id = 'digitalizaciones'), 'NO SE CREÓ')
  union all select 5, 'Policies del bucket',
         (select count(*)::text from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'digitalizaciones_%')
  union all select 6, 'Acceso del visitante anónimo',
         case when has_table_privilege('anon', 'digitalizaciones', 'select')
              then 'PROBLEMA: anon puede leer' else 'OK — anon no tiene acceso' end
) t order by orden;
