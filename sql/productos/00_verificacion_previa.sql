-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 00 — VERIFICACIÓN PREVIA
--
-- ⚠ ESTE SCRIPT NO MODIFICA NADA. Solo lee y reporta.
--
-- Correr ANTES que cualquier otro script de esta carpeta y pasarle
-- la salida a Claude. Sirve para tres cosas:
--   1. Confirmar que PostgreSQL soporta `security_invoker` (PG 15+),
--      necesario para que las vistas de compatibilidad no salteen el RLS.
--   2. Dejar una foto del estado actual (filas, policies, índices) para
--      comparar después de migrar y confirmar que no se perdió nada.
--   3. Confirmar que las tablas nuevas todavía no existen.
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor, estado from (

  -- ─── Requisito técnico ──────────────────────────────────────
  select 1 as orden,
         'Versión de PostgreSQL' as chequeo,
         current_setting('server_version') as valor,
         case when current_setting('server_version_num')::int >= 150000
              then 'OK — soporta security_invoker'
              else 'PARAR — avisar antes de correr el script 02'
         end as estado

  -- ─── Las tablas nuevas NO deberían existir todavía ──────────
  union all select 2, 'Tabla productos',
    coalesce(to_regclass('public.productos')::text, 'no existe'),
    case when to_regclass('public.productos') is null then 'OK — lista para migrar'
         else 'ATENCIÓN — ya existe, no correr el 02 de nuevo' end

  union all select 3, 'Tabla producto_compras',
    coalesce(to_regclass('public.producto_compras')::text, 'no existe'),
    case when to_regclass('public.producto_compras') is null then 'OK — lista para migrar'
         else 'ATENCIÓN — ya existe, no correr el 03 de nuevo' end

  union all select 4, 'Tabla producto_categorias',
    coalesce(to_regclass('public.producto_categorias')::text, 'no existe'),
    case when to_regclass('public.producto_categorias') is null then 'OK — la crea el 01'
         else 'ATENCIÓN — ya existe, el 01 ya se corrió' end

  -- ─── Foto del catálogo actual ───────────────────────────────
  union all select 10, 'pizarras — filas totales',
    (select count(*)::text from pizarras), 'referencia'

  union all select 11, 'pizarras — visibles al público',
    (select count(*)::text from pizarras where activo and eliminado_en is null), 'referencia'

  union all select 12, 'pizarras — en papelera',
    (select count(*)::text from pizarras where eliminado_en is not null), 'referencia'

  -- ─── Foto de las ventas ─────────────────────────────────────
  union all select 20, 'pizarras_compras — filas totales',
    (select count(*)::text from pizarras_compras), 'referencia'

  union all select 21, 'pizarras_compras — en verificación',
    (select count(*)::text from pizarras_compras where estado = 'en_verificacion'), 'referencia'

  union all select 22, 'pizarras_compras — aprobadas',
    (select count(*)::text from pizarras_compras where estado = 'aprobado'), 'referencia'

  union all select 23, 'pizarras_compras — rechazadas',
    (select count(*)::text from pizarras_compras where estado = 'rechazado'), 'referencia'

  union all select 24, 'pizarras_compras — con envío generado',
    (select count(*)::text from pizarras_compras where envia_shipment_id is not null), 'referencia'

  -- ─── Objetos que los scripts 02 y 03 van a renombrar ────────
  union all select 30, 'Función fn_set_actualizado_en',
    coalesce((select 'existe'::text from pg_proc where proname = 'fn_set_actualizado_en' limit 1), 'no existe'),
    'la usan los triggers de actualizado_en'

  union all select 31, 'Constraint pizarras_compras_pizarra_id_fkey',
    coalesce((select 'existe'::text from pg_constraint where conname = 'pizarras_compras_pizarra_id_fkey' limit 1), 'no existe'),
    'el script 03 la renombra'

  union all select 40, 'Policies en pizarras',
    coalesce((select string_agg(policyname::text, ' · ' order by policyname::text) from pg_policies
              where schemaname = 'public' and tablename = 'pizarras'), 'ninguna'),
    'el script 02 las renombra'

  union all select 41, 'Policies en pizarras_compras',
    coalesce((select string_agg(policyname::text, ' · ' order by policyname::text) from pg_policies
              where schemaname = 'public' and tablename = 'pizarras_compras'), 'ninguna'),
    'el script 03 las renombra'

  union all select 42, 'Índices en pizarras',
    coalesce((select string_agg(indexname::text, ' · ' order by indexname::text) from pg_indexes
              where schemaname = 'public' and tablename = 'pizarras'), 'ninguno'),
    'referencia'

  union all select 43, 'Índices en pizarras_compras',
    coalesce((select string_agg(indexname::text, ' · ' order by indexname::text) from pg_indexes
              where schemaname = 'public' and tablename = 'pizarras_compras'), 'ninguno'),
    'referencia'

  union all select 50, 'Buckets de Storage',
    coalesce((select string_agg(id, ' · ' order by id) from storage.buckets), 'ninguno'),
    'referencia'

  -- ─── Control: esto NO tiene que cambiar con la migración ────
  union all select 60, 'CONTROL — finanzas_movimientos',
    (select count(*)::text from finanzas_movimientos),
    'tiene que dar IGUAL después de migrar'

  union all select 61, 'CONTROL — perfiles (alumnos)',
    (select count(*)::text from perfiles),
    'tiene que dar IGUAL después de migrar'

) as reporte
order by orden;
