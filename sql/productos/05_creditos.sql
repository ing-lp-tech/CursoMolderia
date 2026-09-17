-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 05 — Créditos de digitalización
-- Tabla: digitalizacion_creditos
--
-- EJECUTAR DESPUÉS de 04_producto_planes.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Guarda los códigos que se entregan cuando alguien compra el plan
-- "Solo Software": 1 crédito = 1 digitalización.
--
--   Compra 3 créditos → al aprobar el pago se genera MTX-7K4P-9RTX
--   → ese código sirve para 3 digitalizaciones
--
-- El código lo genera la base de datos (default de la columna), así
-- que es imposible que salgan dos iguales aunque se aprueben dos
-- compras en el mismo instante.
--
-- ── LO QUE ESTE SCRIPT NO HACE ─────────────────────────────────
-- No crea la cola de digitalizaciones ni la galería: eso es la
-- Etapa 6, junto con el bucket privado y el gancho para el
-- programador que hace el pasaje de imagen a PDF/DXF.
-- Mientras tanto, los créditos se descuentan a mano desde el panel.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop table digitalizacion_creditos;
--   drop function if exists fn_generar_codigo_credito();
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.producto_planes') is null then
    raise exception 'Falta correr 04_producto_planes.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA — digitalizacion_creditos
-- ═══════════════════════════════════════════════════════════════

create table if not exists digitalizacion_creditos (
  id                  uuid          primary key default gen_random_uuid(),

  -- Formato MTX-XXXX-XXXX. El default se agrega más abajo, después de
  -- crear la función que lo genera.
  codigo              text          not null unique,

  compra_id           uuid          references producto_compras(id) on delete set null,
  plan_id             uuid          references producto_planes(id)  on delete set null,

  -- Snapshot del comprador: la búsqueda del panel es por cliente
  cliente_nombre      text,
  cliente_whatsapp    text,
  cliente_email       text,

  creditos_total      integer       not null check (creditos_total > 0),
  creditos_usados     integer       not null default 0 check (creditos_usados >= 0),
  creditos_restantes  integer       generated always as (creditos_total - creditos_usados) stored,

  estado              text          not null default 'activo'
                        check (estado in ('activo', 'agotado', 'anulado')),

  vence_en            timestamptz,               -- null = no vence
  notas               text,

  -- Soft delete
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  creado_en           timestamptz   not null default now(),
  actualizado_en      timestamptz   not null default now(),

  -- No se puede usar más de lo comprado
  constraint digitalizacion_creditos_uso_check check (creditos_usados <= creditos_total)
);

create index if not exists digitalizacion_creditos_cliente_idx
  on digitalizacion_creditos (cliente_whatsapp, creado_en desc);

create index if not exists digitalizacion_creditos_estado_idx
  on digitalizacion_creditos (estado, eliminado_en, creado_en desc);

create index if not exists digitalizacion_creditos_compra_idx
  on digitalizacion_creditos (compra_id)
  where compra_id is not null;

drop trigger if exists trg_digitalizacion_creditos_actualizado_en on digitalizacion_creditos;
create trigger trg_digitalizacion_creditos_actualizado_en
  before update on digitalizacion_creditos
  for each row execute function fn_set_actualizado_en();

-- ═══════════════════════════════════════════════════════════════
-- GENERADOR DE CÓDIGOS
--
-- Alfabeto sin caracteres ambiguos: no están el 0 ni la O, ni el 1
-- ni la I, porque estos códigos se dictan y se copian a mano por
-- WhatsApp. Reintenta si el código ya existía.
-- ═══════════════════════════════════════════════════════════════

create or replace function fn_generar_codigo_credito()
returns text as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  intento  text;
  i        integer;
begin
  loop
    intento := 'MTX-';
    for i in 1..4 loop
      intento := intento || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    intento := intento || '-';
    for i in 1..4 loop
      intento := intento || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from digitalizacion_creditos where codigo = intento);
  end loop;
  return intento;
end;
$$ language plpgsql;

alter table digitalizacion_creditos
  alter column codigo set default fn_generar_codigo_credito();

-- ═══════════════════════════════════════════════════════════════
-- Marca el código como agotado cuando se usa el último crédito, y lo
-- reactiva si el admin corrige el consumo hacia abajo.
-- ═══════════════════════════════════════════════════════════════

create or replace function fn_estado_credito()
returns trigger as $$
begin
  if new.estado <> 'anulado' then
    new.estado := case
      when new.creditos_usados >= new.creditos_total then 'agotado'
      else 'activo'
    end;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_digitalizacion_creditos_estado on digitalizacion_creditos;
create trigger trg_digitalizacion_creditos_estado
  before insert or update of creditos_usados, creditos_total on digitalizacion_creditos
  for each row execute function fn_estado_credito();

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security — ESTA TABLA NO ES PÚBLICA
--
-- Si un anónimo pudiera leerla, podría probar códigos hasta pegarle
-- a uno válido. La validación de un código se hace siempre por
-- endpoint, nunca por consulta directa desde el navegador.
-- ═══════════════════════════════════════════════════════════════

alter table digitalizacion_creditos enable row level security;

drop policy if exists "digitalizacion_creditos_all_authenticated" on digitalizacion_creditos;

create policy "digitalizacion_creditos_all_authenticated"
  on digitalizacion_creditos for all
  to authenticated
  using (true)
  with check (true);

revoke all on table digitalizacion_creditos from anon;
grant all  on table digitalizacion_creditos to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
--
-- "ejemplo_de_codigo" muestra cómo va a salir un código real.
-- Es solo una muestra: no se guarda nada.
-- ═══════════════════════════════════════════════════════════════

select chequeo, valor from (
  select 1 as orden, 'Tabla digitalizacion_creditos' as chequeo,
         coalesce(to_regclass('public.digitalizacion_creditos')::text, 'NO SE CREÓ') as valor
  union all select 2, 'Códigos emitidos hasta ahora',
         (select count(*)::text from digitalizacion_creditos)
  union all select 3, 'Ejemplo de código generado',
         fn_generar_codigo_credito()
  union all select 4, 'Otro ejemplo (tienen que ser distintos)',
         fn_generar_codigo_credito()
  union all select 5, 'Acceso del visitante anónimo',
         case when has_table_privilege('anon', 'digitalizacion_creditos', 'select')
              then 'PROBLEMA: anon puede leer' else 'OK — anon no tiene acceso' end
) t order by orden;
