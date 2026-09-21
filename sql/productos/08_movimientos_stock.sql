-- ═══════════════════════════════════════════════════════════════
-- SCRIPT 08 — Historial de stock
-- Tabla: movimientos_stock  ·  Función: fn_registrar_movimiento_stock
--
-- EJECUTAR DESPUÉS de 02_productos.sql y 03_producto_compras.sql
-- Supabase Dashboard → SQL Editor → New Query → pegar → Run
--
-- ── QUÉ HACE ───────────────────────────────────────────────────
-- Hoy el stock es un número suelto en `productos.stock`: se pisa y no
-- queda rastro de por qué cambió. Esta tabla guarda cada movimiento con
-- su motivo y una FOTO del stock que quedó después, así se puede
-- reconstruir la historia aunque alguien edite el producto a mano.
--
-- ── LOS TRES TIPOS ─────────────────────────────────────────────
--   entrada   stock + cantidad     Reposición de mercadería (a mano)
--   salida    stock - cantidad     Venta aprobada (automático) o baja
--   ajuste    stock = cantidad     Conteo físico: "conté y hay 7"
--
-- El `ajuste` es ABSOLUTO a propósito. La alternativa —un delta con
-- signo— choca con "cantidad siempre > 0", y en la práctica el admin
-- cuenta lo que hay en la caja, no la diferencia. Una rotura o una
-- devolución se registran como `salida` / `entrada`, que dicen mejor
-- qué pasó. Es el único tipo que admite cantidad = 0 (se agotó).
--
-- ── POR QUÉ UNA FUNCIÓN Y NO DOS WRITES ────────────────────────
-- Actualizar `productos.stock` y después insertar el movimiento son dos
-- escrituras: si la segunda falla, el historial miente. La función hace
-- las dos en una transacción, con `for update` sobre el producto, así
-- dos aprobaciones simultáneas no leen el mismo stock viejo.
--
-- ── LA SALIDA AUTOMÁTICA NO BLOQUEA ────────────────────────────
-- `api/producto-admin.js` llama a esta función al aprobar, pero si
-- fallara, la venta igual queda aprobada. Una venta con plata real no se
-- cae por un problema de log de inventario. Se avisa por consola.
--
-- ── RLS ────────────────────────────────────────────────────────
-- Sin acceso `anon`: el inventario y el ritmo de ventas no son
-- información para visitantes.
--
-- ── SI ALGO SALE MAL (rollback) ────────────────────────────────
--   drop function if exists fn_registrar_movimiento_stock(uuid, text, integer, text, uuid, uuid, text);
--   drop table movimientos_stock;
--   (el stock sigue viviendo en productos.stock, igual que hoy)
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.productos') is null then
    raise exception 'Falta correr 02_productos.sql antes de este script.';
  end if;
  if to_regclass('public.producto_compras') is null then
    raise exception 'Falta correr 03_producto_compras.sql antes de este script.';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- TABLA
-- ═══════════════════════════════════════════════════════════════

create table if not exists movimientos_stock (
  id                  uuid        primary key default gen_random_uuid(),

  producto_id         uuid        not null references productos(id) on delete cascade,

  tipo                text        not null check (tipo in ('entrada', 'salida', 'ajuste')),

  -- Siempre >= 0; el signo lo da `tipo`. Solo el ajuste puede ser 0
  -- ("conté y no queda ninguno").
  cantidad            integer     not null check (cantidad >= 0),

  -- Foto del stock DESPUÉS del movimiento. Es lo que permite leer el
  -- historial sin recalcular nada.
  stock_resultante    integer     not null check (stock_resultante >= 0),

  motivo              text,                      -- 'Venta aprobada' | texto libre

  -- Solo lo traen las salidas automáticas por venta.
  compra_id           uuid        references producto_compras(id) on delete set null,

  fecha               date        not null default current_date,

  creado_por          uuid,
  creado_por_email    text,

  -- Soft delete
  eliminado_en        timestamptz,
  eliminado_por       uuid,
  eliminado_por_email text,

  creado_en           timestamptz not null default now()
);

-- Una cantidad 0 solo tiene sentido en un ajuste: una entrada o una
-- salida de cero unidades es ruido en el historial.
alter table movimientos_stock
  drop constraint if exists movimientos_stock_cantidad_positiva;
alter table movimientos_stock
  add constraint movimientos_stock_cantidad_positiva
  check (tipo = 'ajuste' or cantidad > 0);

-- El historial se lee siempre igual: un producto, del más nuevo al más viejo.
create index if not exists movimientos_stock_producto_idx
  on movimientos_stock (producto_id, creado_en desc)
  where eliminado_en is null;

create index if not exists movimientos_stock_compra_idx
  on movimientos_stock (compra_id)
  where compra_id is not null;

create index if not exists movimientos_stock_fecha_idx
  on movimientos_stock (fecha desc)
  where eliminado_en is null;

-- ─── Row Level Security ────────────────────────────────────────

alter table movimientos_stock enable row level security;

drop policy if exists "movimientos_stock_all_authenticated" on movimientos_stock;

create policy "movimientos_stock_all_authenticated"
  on movimientos_stock for all
  to authenticated
  using (true)
  with check (true);

revoke all on table movimientos_stock from anon;
grant all  on table movimientos_stock to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN — mover el stock y dejar el rastro, en una sola transacción
-- ═══════════════════════════════════════════════════════════════

create or replace function fn_registrar_movimiento_stock(
  p_producto_id       uuid,
  p_tipo              text,
  p_cantidad          integer,
  p_motivo            text    default null,
  p_compra_id         uuid    default null,
  p_creado_por        uuid    default null,
  p_creado_por_email  text    default null
)
returns movimientos_stock
language plpgsql
as $$
declare
  v_stock_actual integer;
  v_stock_nuevo  integer;
  v_movimiento   movimientos_stock;
begin
  if p_tipo not in ('entrada', 'salida', 'ajuste') then
    raise exception 'Tipo de movimiento inválido: %', p_tipo;
  end if;
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La cantidad no puede ser negativa';
  end if;
  if p_cantidad = 0 and p_tipo <> 'ajuste' then
    raise exception 'Una % de 0 unidades no registra nada', p_tipo;
  end if;

  -- `for update` serializa: dos aprobaciones al mismo tiempo no pueden
  -- leer el mismo stock viejo y descontar una sola vez.
  select stock into v_stock_actual
  from productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'Producto % inexistente', p_producto_id;
  end if;

  v_stock_nuevo := case p_tipo
    when 'entrada' then coalesce(v_stock_actual, 0) + p_cantidad
    -- El stock nunca queda negativo: si se vendieron más unidades de las
    -- cargadas, el faltante se arregla con un ajuste, no con un número rojo.
    when 'salida'  then greatest(0, coalesce(v_stock_actual, 0) - p_cantidad)
    when 'ajuste'  then p_cantidad
  end;

  update productos
     set stock = v_stock_nuevo
   where id = p_producto_id;

  insert into movimientos_stock (
    producto_id, tipo, cantidad, stock_resultante,
    motivo, compra_id, creado_por, creado_por_email
  ) values (
    p_producto_id, p_tipo, p_cantidad, v_stock_nuevo,
    nullif(btrim(coalesce(p_motivo, '')), ''), p_compra_id,
    coalesce(p_creado_por, auth.uid()), p_creado_por_email
  )
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

revoke all on function fn_registrar_movimiento_stock(uuid, text, integer, text, uuid, uuid, text) from anon;
grant execute on function fn_registrar_movimiento_stock(uuid, text, integer, text, uuid, uuid, text) to authenticated;
grant execute on function fn_registrar_movimiento_stock(uuid, text, integer, text, uuid, uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — la tabla vacía, la función viva y anon sin acceso
-- ═══════════════════════════════════════════════════════════════

select 'movimientos_stock' as tabla,
       (select count(*) from movimientos_stock)                          as filas,
       (select count(*) from pg_policies
         where tablename = 'movimientos_stock')                          as policies,
       (select count(*) from pg_proc
         where proname = 'fn_registrar_movimiento_stock')                as funcion,
       has_table_privilege('anon', 'movimientos_stock', 'select')        as anon_puede_leer;
