-- ═══════════════════════════════════════════════════════════════
-- ESTADO DE LOS SCRIPTS — ¿cuáles ya corrí en esta base?
--
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- NO MODIFICA NADA. Es solo de lectura: se puede correr las veces que
-- haga falta, en producción, sin riesgo.
--
-- ── UNA SOLA CONSULTA, A PROPÓSITO ─────────────────────────────
-- El SQL Editor de Supabase muestra únicamente el resultado de la
-- ÚLTIMA sentencia. Si esto fueran tres `select`, verías solo el
-- tercero y creerías que el resto no contestó. Por eso es uno solo con
-- todo adentro.
--
-- Cada renglón busca la huella que deja un script (una tabla, una
-- columna, un bucket) y contesta CORRIDO o FALTA. El 10 es al revés:
-- su huella es la AUSENCIA de las dos vistas viejas.
--
-- ── ¿Y SI CORRO UN SCRIPT DOS VECES? ───────────────────────────
-- Del 01 al 09 no pasa nada: están escritos con `if not exists` y
-- `on conflict`, así que el segundo intento no duplica ni pisa nada.
--
-- El 10 es la excepción: si ya lo corriste, la segunda vez CORTA con
-- "relation public.pizarras does not exist" y no hace nada. Ese error
-- es, de hecho, otra forma de contestar la pregunta.
-- ═══════════════════════════════════════════════════════════════

with estado as (

  -- ── Un renglón por script ────────────────────────────────────
  select  1 as orden, '01' as script, 'Categorías de producto' as huella,
          (to_regclass('public.producto_categorias') is not null) as listo,
          null::text as detalle
  union all select  2, '02', 'Tabla productos',
          to_regclass('public.productos') is not null, null
  union all select  3, '03', 'Tabla producto_compras',
          to_regclass('public.producto_compras') is not null, null
  union all select  4, '03b', 'Anulación de guías de envío',
          exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'producto_compras'
                     and column_name = 'envia_cancelado_en'), null
  union all select  5, '04', 'Tabla producto_planes',
          to_regclass('public.producto_planes') is not null, null
  union all select  6, '04b', 'Créditos incluidos por plan',
          exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'producto_planes'
                     and column_name = 'creditos_por_unidad'), null
  union all select  7, '05', 'Códigos de digitalización',
          to_regclass('public.digitalizacion_creditos') is not null, null
  union all select  8, '06', 'Navbar administrable',
          to_regclass('public.nav_items') is not null, null

  union all select  9, '07', 'Bucket productos-imagenes',
          exists (select 1 from storage.buckets where id = 'productos-imagenes'),
          coalesce(
            (select (case when b.public then 'público' else 'PRIVADO — debería ser público' end)
                    || ' · ' || (select count(*) from storage.objects
                                  where bucket_id = 'productos-imagenes')::text || ' archivos'
                    || ' · ' || (select count(*) from pg_policies
                                  where schemaname = 'storage' and tablename = 'objects'
                                    and policyname like 'productos_img_%')::text || ' policies'
               from storage.buckets b where b.id = 'productos-imagenes'),
            'el bucket no existe')

  union all select 10, '08', 'Historial de stock',
          to_regclass('public.movimientos_stock') is not null, null

  union all select 11, '09', 'Cola de digitalizaciones',
          to_regclass('public.digitalizaciones') is not null,
          'bucket privado: ' ||
            (case when exists (select 1 from storage.buckets b
                                where b.id = 'digitalizaciones' and not b.public)
                  then 'sí' else 'NO' end)
          || ' · trigger del crédito: ' ||
            (case when exists (select 1 from pg_trigger
                                where tgname = 'trg_digitalizacion_consume_credito')
                  then 'sí' else 'NO' end)
          || ' · ' || (select count(*) from pg_policies
                        where schemaname = 'storage' and tablename = 'objects'
                          and policyname like 'digitalizaciones_%')::text || ' policies'

  -- Al revés que los demás: este script BORRA. Está corrido cuando las
  -- vistas viejas ya no están.
  union all select 12, '10', 'Vistas de compatibilidad borradas',
          to_regclass('public.pizarras') is null
      and to_regclass('public.pizarras_compras') is null,
          'pizarras: ' || (case when to_regclass('public.pizarras') is null
                                then 'borrada' else 'TODAVÍA EXISTE' end)
          || ' · pizarras_compras: ' || (case when to_regclass('public.pizarras_compras') is null
                                              then 'borrada' else 'TODAVÍA EXISTE' end)

  -- ── Y el bucket viejo, que decide cuándo se puede correr el 11 ──
  union all select 13, '11', 'Bucket viejo pizarras-imagenes vacío',
          coalesce((select count(*) from storage.objects
                     where bucket_id = 'pizarras-imagenes'), 0) = 0,
          coalesce((select count(*) from storage.objects
                     where bucket_id = 'pizarras-imagenes'), 0)::text
          || ' fotos todavía ahí — hay que resubirlas desde el panel antes de borrarlo'
)

select script,
       huella                                                as "qué deja",
       case when listo then '✅ CORRIDO' else '❌ FALTA' end as estado,
       detalle                                               as "detalle"
from estado
order by orden;
