-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 13 — Origen de cada código, historial completo y uso desde
--             el software externo
-- Tablas:    digitalizacion_creditos (+2 columnas) · credito_movimientos
-- Funciones: fn_credito_registrar_movimiento() · fn_usar_credito()
--            fn_consumir_credito() (se redefine, ver más abajo)
--
-- EJECUTAR DESPUÉS de 05_creditos.sql y 09_digitalizaciones.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- Se puede correr dos veces sin efecto. Si ya corriste una versión
-- anterior de este script (la que creaba `credito_usos`), correlo igual:
-- pasa esos usos al historial nuevo y borra la tabla vieja.
--
-- ── QUÉ RESUELVE ───────────────────────────────────────────────
-- 1. DE DÓNDE SALIÓ CADA CÓDIGO. Columna `origen`:
--      compra → emitido al aprobar una venta real
--      manual → creado por el admin para un cliente (cortesía, alias…)
--      demo   → creado por el admin para mostrar el software
--    Más `creado_por_email`: qué admin lo creó.
--
-- 2. EL HISTORIAL DE TODO. Tabla `credito_movimientos`: un renglón por
--    cada cosa que le pasa a un código, con fecha y hora:
--      emision · uso · devolucion · ajuste (cambio de límite)
--      anulacion · reactivacion · eliminacion
--    y quién lo hizo: compra · panel · software · cola · sistema.
--
--    Lo escribe UN TRIGGER sobre digitalizacion_creditos, no cada
--    pantalla. Así no hay forma de cambiar un código sin que quede
--    anotado: ni desde el panel, ni desde el software, ni desde la cola
--    de digitalizaciones, ni con un update a mano en el SQL Editor.
--
-- 3. EL USO DESDE EL SOFTWARE. fn_usar_credito() la llama
--    /api/digitalizacion: valida, descuenta con lock (dos pedidos
--    simultáneos no gastan el mismo crédito) y no cobra dos veces la
--    misma `referencia` (reintento de red).
--
-- ── CÓMO SABE EL TRIGGER QUIÉN FUE ─────────────────────────────
-- Quien descuenta deja una marca en la transacción antes del update:
--   set_config('app.credito_origen', 'software' | 'cola', true)
--   set_config('app.credito_referencia', '<id del trabajo>', true)
-- Sin marca: si hay usuario logueado (el panel) es 'panel'; si no, es
-- 'sistema'. El email del admin sale del JWT de Supabase.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop trigger trg_credito_movimiento on digitalizacion_creditos;
--   drop trigger trg_credito_origen     on digitalizacion_creditos;
--   drop function fn_credito_registrar_movimiento();
--   drop function fn_credito_origen();
--   drop function fn_usar_credito(text, integer, text, text);
--   drop table credito_movimientos;
--   alter table digitalizacion_creditos drop column origen, drop column creado_por_email;
--   y volver a correr la sección de fn_consumir_credito del script 09.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.digitalizacion_creditos') is null then
    raise exception 'Falta correr 05_creditos.sql antes de este script.';
  end if;
  if to_regclass('public.digitalizaciones') is null then
    raise exception 'Falta correr 09_digitalizaciones.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 1. ORIGEN DE CADA CÓDIGO
-- ═══════════════════════════════════════════════════════════════

alter table digitalizacion_creditos
  add column if not exists origen           text not null default 'manual',
  add column if not exists creado_por_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'digitalizacion_creditos_origen_check') then
    alter table digitalizacion_creditos add constraint digitalizacion_creditos_origen_check
      check (origen in ('compra', 'manual', 'demo'));
  end if;
end $$;

-- Los que ya existen: con compra detrás son de compra; el resto, manuales.
update digitalizacion_creditos
   set origen = 'compra'
 where compra_id is not null and origen <> 'compra';

create index if not exists digitalizacion_creditos_origen_idx
  on digitalizacion_creditos (origen, creado_en desc);

comment on column digitalizacion_creditos.origen is
  'compra = emitido al aprobar una venta · manual = creado por el admin para un cliente · demo = creado por el admin para mostrar el software';

-- Un código con compra es SIEMPRE de compra, lo mande quien lo mande; y
-- se anota qué admin lo creó, sacado de su sesión.
create or replace function fn_credito_origen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.compra_id is not null then
    new.origen := 'compra';
  end if;
  new.creado_por_email := coalesce(new.creado_por_email, nullif(auth.jwt() ->> 'email', ''));
  return new;
end;
$$;

drop trigger if exists trg_credito_origen on digitalizacion_creditos;
create trigger trg_credito_origen
  before insert on digitalizacion_creditos
  for each row execute function fn_credito_origen();

-- ═══════════════════════════════════════════════════════════════
-- 2. HISTORIAL — credito_movimientos
-- ═══════════════════════════════════════════════════════════════

create table if not exists credito_movimientos (
  id              uuid        primary key default gen_random_uuid(),
  credito_id      uuid        not null references digitalizacion_creditos(id) on delete cascade,
  codigo          text        not null,                 -- snapshot

  tipo            text        not null check (tipo in (
                    'emision', 'uso', 'devolucion', 'ajuste',
                    'anulacion', 'reactivacion', 'eliminacion')),
  -- Cuántos usos movió. En 'ajuste' es la diferencia del límite (+5, -2).
  cantidad        integer     not null default 0,

  -- Cómo quedó el código después de este movimiento.
  usados_despues  integer,
  total_despues   integer,

  origen          text        not null check (origen in (
                    'compra', 'panel', 'software', 'cola', 'sistema')),
  referencia      text,                                   -- id del trabajo
  actor_email     text,                                   -- admin, si fue el panel
  detalle         text,

  creado_en       timestamptz not null default now()
);

create index if not exists credito_movimientos_credito_idx
  on credito_movimientos (credito_id, creado_en desc);

create index if not exists credito_movimientos_fecha_idx
  on credito_movimientos (creado_en desc);

-- La misma referencia del software no puede cobrar dos veces el mismo
-- código. Solo para el software: la cola usa el id de la digitalización
-- como referencia, y una digitalización reabierta y vuelta a procesar
-- cobra de nuevo a propósito (antes devolvió el crédito).
create unique index if not exists credito_movimientos_software_ref_uniq
  on credito_movimientos (credito_id, referencia)
  where tipo = 'uso' and origen = 'software' and referencia is not null;

-- Solo lectura para el panel. Nadie escribe a mano: escribe el trigger,
-- que corre con los permisos de su dueño (security definer).
alter table credito_movimientos enable row level security;

drop policy if exists "credito_movimientos_select_authenticated" on credito_movimientos;
create policy "credito_movimientos_select_authenticated"
  on credito_movimientos for select
  to authenticated
  using (true);

revoke all    on table credito_movimientos from anon, authenticated;
grant  select on table credito_movimientos to authenticated;

-- ─── Historial de lo que ya existía ───────────────────────────
-- Antes de este script no se anotaba nada. Para que ningún código
-- quede sin historia: su emisión, con la fecha en que se creó, y lo
-- que ya llevaba gastado como un solo uso "previo al historial".
-- Solo para los códigos que todavía no tienen movimientos.

insert into credito_movimientos
  (credito_id, codigo, tipo, cantidad, usados_despues, total_despues, origen, detalle, creado_en)
select c.id, c.codigo, 'emision', c.creditos_total, 0, c.creditos_total,
       case when c.origen = 'compra' then 'compra' else 'panel' end,
       'Emisión registrada al crear el historial',
       c.creado_en
  from digitalizacion_creditos c
 where not exists (select 1 from credito_movimientos m where m.credito_id = c.id);

-- La versión anterior de este script guardaba los usos del software en
-- `credito_usos`. Si existe, sus usos pasan al historial con su fecha y
-- su referencia, y la tabla se borra.
do $$
begin
  if to_regclass('public.credito_usos') is not null then
    insert into credito_movimientos
      (credito_id, codigo, tipo, cantidad, origen, referencia, detalle, creado_en)
    select u.credito_id, u.codigo, 'uso', u.cantidad, 'software', u.referencia,
           'Uso desde el software', u.creado_en
      from credito_usos u
     where not exists (
       select 1 from credito_movimientos m
        where m.credito_id = u.credito_id and m.tipo = 'uso'
          and m.origen = 'software' and m.referencia is not distinct from u.referencia
          and m.creado_en = u.creado_en);
    drop table credito_usos;
  end if;
end $$;

-- Lo gastado que el historial todavía no explica.
insert into credito_movimientos
  (credito_id, codigo, tipo, cantidad, usados_despues, total_despues, origen, detalle, creado_en)
select c.id, c.codigo, 'uso', c.creditos_usados - coalesce(h.usados, 0),
       c.creditos_usados, c.creditos_total, 'sistema',
       'Usos previos al historial (sin detalle de fecha)', c.actualizado_en
  from digitalizacion_creditos c
  left join (
    select credito_id,
           sum(case tipo when 'uso' then cantidad when 'devolucion' then -cantidad else 0 end) as usados
      from credito_movimientos group by credito_id
  ) h on h.credito_id = c.id
 where c.creditos_usados > coalesce(h.usados, 0);

-- ─── El trigger que anota todo ────────────────────────────────

create or replace function fn_credito_registrar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text := nullif(current_setting('app.credito_origen', true), '');
  v_ref    text := nullif(current_setting('app.credito_referencia', true), '');
  v_actor  text := nullif(auth.jwt() ->> 'email', '');
  v_delta  integer;
begin
  if v_origen is null then
    v_origen := case when auth.uid() is not null then 'panel' else 'sistema' end;
  end if;

  if tg_op = 'INSERT' then
    insert into credito_movimientos
      (credito_id, codigo, tipo, cantidad, usados_despues, total_despues, origen, referencia, actor_email, detalle)
    values
      (new.id, new.codigo, 'emision', new.creditos_total, new.creditos_usados, new.creditos_total,
       case when new.origen = 'compra' then 'compra' else v_origen end,
       v_ref, coalesce(v_actor, new.creado_por_email),
       case new.origen
         when 'compra' then 'Emitido al aprobar una compra'
         when 'demo'   then 'Código demo'
         else               'Código manual'
       end || coalesce(' · ' || new.notas, ''));
    return new;
  end if;

  -- Usos y devoluciones
  v_delta := new.creditos_usados - old.creditos_usados;
  if v_delta <> 0 then
    insert into credito_movimientos
      (credito_id, codigo, tipo, cantidad, usados_despues, total_despues, origen, referencia, actor_email)
    values
      (new.id, new.codigo, case when v_delta > 0 then 'uso' else 'devolucion' end, abs(v_delta),
       new.creditos_usados, new.creditos_total, v_origen, v_ref, v_actor);
  end if;

  -- Cambio de límite
  if new.creditos_total <> old.creditos_total then
    insert into credito_movimientos
      (credito_id, codigo, tipo, cantidad, usados_despues, total_despues, origen, actor_email, detalle)
    values
      (new.id, new.codigo, 'ajuste', new.creditos_total - old.creditos_total,
       new.creditos_usados, new.creditos_total, v_origen, v_actor,
       'Límite ' || old.creditos_total || ' → ' || new.creditos_total);
  end if;

  -- Anular / reactivar. activo ↔ agotado no se anota: lo deriva un
  -- trigger del contador y ya queda reflejado en el uso que lo causó.
  if new.estado is distinct from old.estado
     and (new.estado = 'anulado' or old.estado = 'anulado') then
    insert into credito_movimientos
      (credito_id, codigo, tipo, usados_despues, total_despues, origen, actor_email)
    values
      (new.id, new.codigo, case when new.estado = 'anulado' then 'anulacion' else 'reactivacion' end,
       new.creditos_usados, new.creditos_total, v_origen, v_actor);
  end if;

  -- A la papelera
  if new.eliminado_en is not null and old.eliminado_en is null then
    insert into credito_movimientos
      (credito_id, codigo, tipo, usados_despues, total_despues, origen, actor_email)
    values
      (new.id, new.codigo, 'eliminacion', new.creditos_usados, new.creditos_total,
       v_origen, coalesce(v_actor, new.eliminado_por_email));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_credito_movimiento on digitalizacion_creditos;
create trigger trg_credito_movimiento
  after insert or update on digitalizacion_creditos
  for each row execute function fn_credito_registrar_movimiento();

-- ═══════════════════════════════════════════════════════════════
-- 3. LA COLA DE DIGITALIZACIONES DEJA SU MARCA
--
-- Mismo fn_consumir_credito() del script 09. Lo único nuevo son los
-- set_config: el historial anota que el uso vino de la cola, con el id
-- de la digitalización como referencia.
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

    perform set_config('app.credito_origen', 'cola', true);
    perform set_config('app.credito_referencia', new.id::text, true);

    update digitalizacion_creditos
       set creditos_usados = creditos_usados + 1
     where id = new.credito_id
       and estado <> 'anulado'
       and creditos_usados < creditos_total;

    get diagnostics v_filas = row_count;

    perform set_config('app.credito_origen', '', true);
    perform set_config('app.credito_referencia', '', true);

    -- Sin créditos disponibles el trabajo igual queda procesado, pero sin
    -- cobrar: en el panel se ve "sin crédito" y se resuelve a mano.
    new.credito_consumido := v_filas > 0;
    new.procesado_en      := coalesce(new.procesado_en, now());

  -- Corrección: salió de 'procesado' (p. ej. se reabrió como 'error').
  -- Se devuelve el crédito que esta fila había gastado.
  elsif new.estado_procesamiento <> 'procesado' and new.credito_consumido then
    perform set_config('app.credito_origen', 'cola', true);
    perform set_config('app.credito_referencia', new.id::text, true);

    update digitalizacion_creditos
       set creditos_usados = greatest(0, creditos_usados - 1)
     where id = new.credito_id;

    perform set_config('app.credito_origen', '', true);
    perform set_config('app.credito_referencia', '', true);

    new.credito_consumido := false;
    new.procesado_en      := null;
  end if;

  return new;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 4. USO DESDE EL SOFTWARE — fn_usar_credito
--
-- La llama /api/digitalizacion. Devuelve siempre un jsonb, nunca tira
-- error por un código malo: el endpoint traduce `motivo` a un mensaje.
--
--   { ok: true,  restantes, total, estado, repetido }
--   { ok: false, motivo: 'inexistente' | 'anulado' | 'vencido'
--                       | 'agotado' | 'cantidad_invalida',
--     restantes?, total? }
-- ═══════════════════════════════════════════════════════════════

create or replace function fn_usar_credito(
  p_codigo     text,
  p_cantidad   integer default 1,
  p_referencia text    default null,
  p_origen     text    default 'software'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_credito digitalizacion_creditos%rowtype;
  v_ref     text := nullif(trim(coalesce(p_referencia, '')), '');
begin
  if p_cantidad is null or p_cantidad < 1 then
    return jsonb_build_object('ok', false, 'motivo', 'cantidad_invalida');
  end if;

  -- El lock es lo que impide que dos pedidos simultáneos gasten el
  -- mismo crédito: el segundo espera acá hasta que el primero termina.
  select * into v_credito
    from digitalizacion_creditos
   where codigo = upper(trim(p_codigo))
     and eliminado_en is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'inexistente');
  end if;

  -- Reintento: esta referencia ya cobró, no se vuelve a cobrar.
  if v_ref is not null and exists (
    select 1 from credito_movimientos
     where credito_id = v_credito.id and tipo = 'uso'
       and origen = 'software' and referencia = v_ref
  ) then
    return jsonb_build_object(
      'ok', true, 'repetido', true,
      'restantes', v_credito.creditos_restantes,
      'total', v_credito.creditos_total,
      'estado', v_credito.estado
    );
  end if;

  if v_credito.estado = 'anulado' then
    return jsonb_build_object('ok', false, 'motivo', 'anulado');
  end if;

  if v_credito.vence_en is not null and v_credito.vence_en <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;

  if v_credito.creditos_restantes < p_cantidad then
    return jsonb_build_object(
      'ok', false, 'motivo', 'agotado',
      'restantes', v_credito.creditos_restantes,
      'total', v_credito.creditos_total
    );
  end if;

  -- La marca que lee el trigger del historial.
  perform set_config('app.credito_origen', coalesce(p_origen, 'software'), true);
  perform set_config('app.credito_referencia', coalesce(v_ref, ''), true);

  -- El estado (activo → agotado) lo recalcula el trigger del script 05,
  -- y el movimiento 'uso' lo anota trg_credito_movimiento.
  update digitalizacion_creditos
     set creditos_usados = creditos_usados + p_cantidad
   where id = v_credito.id
  returning * into v_credito;

  perform set_config('app.credito_origen', '', true);
  perform set_config('app.credito_referencia', '', true);

  return jsonb_build_object(
    'ok', true, 'repetido', false,
    'restantes', v_credito.creditos_restantes,
    'total', v_credito.creditos_total,
    'estado', v_credito.estado
  );
end;
$$;

-- Solo el servidor (service_role) la puede llamar. Si un anónimo pudiera,
-- podría gastarle los créditos a cualquiera que conozca el código.
revoke all     on function fn_usar_credito(text, integer, text, text) from public, anon, authenticated;
grant  execute on function fn_usar_credito(text, integer, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Códigos por origen' as chequeo,
         coalesce((select string_agg(origen || ': ' || n, ' · ' order by origen)
                     from (select origen, count(*) n from digitalizacion_creditos group by origen) t),
                  'sin códigos todavía') as valor
  union all select 2, 'Movimientos en el historial',
         (select count(*)::text from credito_movimientos)
  union all select 3, 'Códigos sin historial (tiene que ser 0)',
         (select count(*)::text from digitalizacion_creditos c
           where not exists (select 1 from credito_movimientos m where m.credito_id = c.id))
  union all select 4, 'Trigger del historial',
         case when exists (select 1 from pg_trigger where tgname = 'trg_credito_movimiento')
              then 'OK' else 'NO SE CREÓ' end
  union all select 5, 'Tabla vieja credito_usos',
         case when to_regclass('public.credito_usos') is null then 'OK — no existe' else 'TODAVÍA EXISTE' end
  union all select 6, 'Acceso del visitante anónimo a fn_usar_credito',
         case when has_function_privilege('anon', 'fn_usar_credito(text, integer, text, text)', 'execute')
              then 'PROBLEMA: anon puede ejecutarla' else 'OK — anon no puede' end
  union all select 7, 'Un código inventado devuelve',
         fn_usar_credito('MTX-0000-0000')::text
) t order by orden;
