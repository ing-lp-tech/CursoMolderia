-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 13 — Usar códigos desde el software externo
-- Tabla: credito_usos · Función: fn_usar_credito()
--
-- EJECUTAR DESPUÉS de 05_creditos.sql (y del 09, si ya está corrido)
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── POR QUÉ ────────────────────────────────────────────────────
-- Hasta acá un código MTX-XXXX-XXXX se gastaba de dos formas: a mano
-- desde el panel ("Usar 1") o por el trigger de la cola de
-- digitalizaciones (script 09). Ahora el comprador lo pega en OTRA
-- app web —el software de digitalización— y esa app tiene que poder
-- preguntar "¿este código sirve?" y descontar un uso.
--
-- Eso lo hace el endpoint /api/digitalizacion, que llama a la función
-- de este script. La lógica vive acá y no en el endpoint por una sola
-- razón: dos usos simultáneos del mismo código (dos pestañas, un
-- reintento de red) no pueden gastar el mismo crédito dos veces. La
-- función toma un lock sobre la fila del código antes de mirar cuánto
-- le queda.
--
-- ── IDEMPOTENCIA ───────────────────────────────────────────────
-- El software puede mandar una `referencia` (el id de su trabajo). Si
-- la misma referencia llega dos veces para el mismo código —típico de
-- un reintento después de un timeout— el segundo pedido NO descuenta:
-- devuelve el resultado del primero.
--
-- ── ADITIVO ────────────────────────────────────────────────────
-- Una tabla nueva y una función. No toca ninguna fila existente.
-- Correrlo dos veces no hace nada.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop function if exists fn_usar_credito(text, integer, text, text);
--   drop table credito_usos;
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.digitalizacion_creditos') is null then
    raise exception 'Falta correr 05_creditos.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA — credito_usos
--
-- Un renglón por cada uso que llega desde afuera. Es el historial que
-- contesta "¿cuándo gastó este cliente sus créditos?".
-- ═══════════════════════════════════════════════════════════════

create table if not exists credito_usos (
  id           uuid        primary key default gen_random_uuid(),
  credito_id   uuid        not null references digitalizacion_creditos(id) on delete cascade,
  codigo       text        not null,                 -- snapshot
  cantidad     integer     not null check (cantidad > 0),
  referencia   text,                                  -- id del trabajo en el software
  origen       text        not null default 'software',
  creado_en    timestamptz not null default now()
);

create index if not exists credito_usos_credito_idx
  on credito_usos (credito_id, creado_en desc);

-- La misma referencia no puede descontar dos veces del mismo código.
create unique index if not exists credito_usos_referencia_uniq
  on credito_usos (credito_id, referencia)
  where referencia is not null;

alter table credito_usos enable row level security;

drop policy if exists "credito_usos_select_authenticated" on credito_usos;
create policy "credito_usos_select_authenticated"
  on credito_usos for select
  to authenticated
  using (true);

revoke all    on table credito_usos from anon;
grant  select on table credito_usos to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN — fn_usar_credito
--
-- Devuelve siempre un jsonb, nunca tira error por un código malo: el
-- endpoint traduce `motivo` a un mensaje para el usuario.
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
returns jsonb as $$
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

  -- Reintento: ya se descontó con esta referencia, no se vuelve a cobrar.
  if v_ref is not null and exists (
    select 1 from credito_usos where credito_id = v_credito.id and referencia = v_ref
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

  -- El estado (activo → agotado) lo recalcula el trigger del script 05.
  update digitalizacion_creditos
     set creditos_usados = creditos_usados + p_cantidad
   where id = v_credito.id
  returning * into v_credito;

  insert into credito_usos (credito_id, codigo, cantidad, referencia, origen)
  values (v_credito.id, v_credito.codigo, p_cantidad, v_ref, coalesce(p_origen, 'software'));

  return jsonb_build_object(
    'ok', true, 'repetido', false,
    'restantes', v_credito.creditos_restantes,
    'total', v_credito.creditos_total,
    'estado', v_credito.estado
  );
end;
$$ language plpgsql;

-- Solo el servidor (service_role) la puede llamar. Si un anónimo pudiera,
-- podría gastarle los créditos a cualquiera que conozca el código.
revoke all     on function fn_usar_credito(text, integer, text, text) from public, anon, authenticated;
grant  execute on function fn_usar_credito(text, integer, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Tabla credito_usos' as chequeo,
         coalesce(to_regclass('public.credito_usos')::text, 'NO SE CREÓ') as valor
  union all select 2, 'Función fn_usar_credito',
         case when to_regprocedure('fn_usar_credito(text, integer, text, text)') is not null
              then 'OK' else 'NO SE CREÓ' end
  union all select 3, 'Acceso del visitante anónimo a la función',
         case when has_function_privilege('anon', 'fn_usar_credito(text, integer, text, text)', 'execute')
              then 'PROBLEMA: anon puede ejecutarla' else 'OK — anon no puede' end
  union all select 4, 'Un código inventado devuelve',
         fn_usar_credito('MTX-0000-0000')::text
) t order by orden;
