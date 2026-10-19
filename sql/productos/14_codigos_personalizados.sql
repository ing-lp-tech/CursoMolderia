-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 14 — Códigos elegidos a mano
-- Tabla: digitalizacion_creditos (una constraint)
--
-- EJECUTAR DESPUÉS de 13_usos_desde_software.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── POR QUÉ ────────────────────────────────────────────────────
-- Hasta acá todo código salía de fn_generar_codigo_credito(): aleatorio,
-- con la forma MTX-XXXX-XXXX. Para las demos conviene poder elegirlo
-- ("DEMO-FERIA", "TALLER-FLORES"): se dicta fácil y se reconoce en el
-- historial.
--
-- El código aleatorio sigue siendo el default. Esto solo fija QUÉ
-- puede ser un código elegido a mano, para que el panel, el endpoint y
-- el software digan lo mismo:
--
--   - de 4 a 32 caracteres
--   - solo MAYÚSCULAS sin acentos, números y guiones
--   - sin guion al principio ni al final
--
-- Mayúsculas obligatorias: así "demo-feria" y "DEMO-FERIA" no pueden
-- ser dos códigos distintos (la columna ya es UNIQUE). El panel y el
-- endpoint pasan todo a mayúsculas antes de guardar o buscar.
--
-- Los códigos MTX-XXXX-XXXX que ya existen cumplen la regla: el script
-- no toca ninguna fila.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   alter table digitalizacion_creditos drop constraint digitalizacion_creditos_codigo_formato_check;
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.digitalizacion_creditos') is null then
    raise exception 'Falta correr 05_creditos.sql antes de este script.';
  end if;

  -- Si algún código viejo no cumpliera, se avisa en vez de fallar a medias.
  if exists (select 1 from digitalizacion_creditos
              where codigo !~ '^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$') then
    raise exception 'Hay códigos que no cumplen el formato: %',
      (select string_agg(codigo, ', ') from digitalizacion_creditos
        where codigo !~ '^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$');
  end if;

  if not exists (select 1 from pg_constraint
                  where conname = 'digitalizacion_creditos_codigo_formato_check') then
    alter table digitalizacion_creditos
      add constraint digitalizacion_creditos_codigo_formato_check
      check (codigo ~ '^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$');
  end if;
end $$;

comment on column digitalizacion_creditos.codigo is
  'Por defecto aleatorio (MTX-XXXX-XXXX). Puede elegirse a mano: 4 a 32 caracteres, mayúsculas, números y guiones.';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Regla de formato del código' as chequeo,
         case when exists (select 1 from pg_constraint
                            where conname = 'digitalizacion_creditos_codigo_formato_check')
              then 'OK' else 'NO SE CREÓ' end as valor
  union all select 2, 'Códigos aleatorios (MTX-…)',
         (select count(*)::text from digitalizacion_creditos where codigo ~ '^MTX-[A-Z0-9]{4}-[A-Z0-9]{4}$')
  union all select 3, 'Códigos elegidos a mano',
         (select count(*)::text from digitalizacion_creditos where codigo !~ '^MTX-[A-Z0-9]{4}-[A-Z0-9]{4}$')
) t order by orden;
