import { createClient } from '@supabase/supabase-js';
import { generarEnvio } from './_lib/envia.js';
import { setCors, bloquearSiOrigenInvalido } from './_lib/cors.js';

// Acciones de admin sobre una compra de producto.
// Generalización de pizarra-admin.js, que quedó como shim de compatibilidad.

// Emite el código de digitalización de una compra que lo tenga ganado.
// Es idempotente: si el código ya existe (por un reintento del panel) devuelve
// el mismo, nunca uno nuevo. Nada de esto puede tumbar la aprobación: si
// fallara, la venta ya está aprobada y el código se carga a mano.
async function emitirCredito(supabase, compra, plan, unidades) {
  // Un plan físico vende 1 unidad que incluye N digitalizaciones; "Solo
  // Software" vende N créditos sueltos (creditos_por_unidad = 1, el default).
  const creditos = unidades * (Number(plan.creditos_por_unidad) || 1);

  const { data: yaEmitido } = await supabase
    .from('digitalizacion_creditos')
    .select('codigo, creditos_total')
    .eq('compra_id', compra.id)
    .is('eliminado_en', null)
    .maybeSingle();
  if (yaEmitido) return { codigo: yaEmitido.codigo, creditos: yaEmitido.creditos_total };

  // `codigo` lo genera el default de la columna (fn_generar_codigo_credito):
  // así dos aprobaciones simultáneas no pueden sacar el mismo.
  const { data, error } = await supabase
    .from('digitalizacion_creditos')
    .insert({
      compra_id:        compra.id,
      plan_id:          plan.id,
      cliente_nombre:   compra.nombre,
      cliente_whatsapp: compra.whatsapp,
      cliente_email:    compra.email,
      creditos_total:   creditos,
    })
    .select('codigo, creditos_total')
    .single();

  if (error) {
    console.error('[PRODUCTO_CREDITO_INSERT]', error.message);
    return null;
  }
  return { codigo: data.codigo, creditos: data.creditos_total };
}

async function aprobar(supabase, compra_id) {
  const { data: compra, error: compraErr } = await supabase
    .from('producto_compras')
    .select('id, estado, producto_id, plan_id, titulo_plan, cantidad, metodo_pago, monto_cobrado, monto_producto, monto_envio, envia_carrier, titulo_producto, categoria_producto, nombre, whatsapp, email')
    .eq('id', compra_id)
    .single();

  if (compraErr || !compra) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });
  if (compra.estado === 'aprobado') throw Object.assign(new Error('Esta compra ya fue aprobada'), { status: 400 });

  // El plan decide dos cosas: si esto sale del depósito y si hay que emitir
  // un código de créditos.
  let plan = null;
  if (compra.plan_id) {
    const { data } = await supabase
      .from('producto_planes')
      .select('id, nombre, requiere_envio, otorga_creditos, creditos_por_unidad')
      .eq('id', compra.plan_id)
      .maybeSingle();
    plan = data || null;
  }
  const descuentaStock = plan ? plan.requiere_envio !== false : true;

  const { error: updateErr } = await supabase
    .from('producto_compras')
    .update({ estado: 'aprobado' })
    .eq('id', compra_id);
  if (updateErr) {
    console.error('[PRODUCTO_APPROVE_UPDATE]', updateErr.message);
    throw Object.assign(new Error('Error al actualizar el estado de la compra'), { status: 500 });
  }

  // Descontar stock (no bloquea la aprobación si falla)
  const unidades = Number(compra.cantidad) || 1;
  if (descuentaStock && compra.producto_id) {
    const { data: producto } = await supabase.from('productos').select('stock').eq('id', compra.producto_id).single();
    if (producto) {
      await supabase
        .from('productos')
        .update({ stock: Math.max(0, producto.stock - unidades) })
        .eq('id', compra.producto_id);
    }
  }

  const metodoPagoLabel = compra.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Transferencia bancaria';
  const { data: titularRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'moldes_titular')
    .single();
  const titularCobrador = titularRow?.value?.trim() || null;

  // El envío va en su propio movimiento. Si se registrara todo junto, una venta
  // de $1.000 con $14.627 de correo entraría como un ingreso de $15.627 y en la
  // tabla no habría forma de ver que casi todo es plata del correo, no ganancia.
  const detalleCantidad = unidades > 1 ? ` ×${unidades}` : '';
  const detallePlan = compra.titulo_plan ? ` (${compra.titulo_plan})` : '';
  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Compras viejas (previas a esta separación) pueden no tener el desglose:
  // ahí se cae al total, que es lo que se cobró.
  const montoEnvio = Number(compra.monto_envio) || 0;
  const montoProducto = Number(compra.monto_producto ?? compra.monto_cobrado) || 0;

  const movimientos = [{
    tipo:        'ingreso',
    categoria:   'Venta de producto',
    descripcion: `${compra.categoria_producto || 'Producto'}: ${compra.titulo_producto}${detallePlan}${detalleCantidad} — ${compra.nombre}`,
    monto:       montoProducto,
    metodo:      metodoPagoLabel,
    fecha:       fechaHoy,
    cobrador:    titularCobrador,
  }];

  if (montoEnvio > 0) {
    movimientos.push({
      tipo:        'ingreso',
      categoria:   'Envío cobrado al cliente',
      descripcion: `Envío ${compra.envia_carrier || ''} — ${compra.titulo_producto} — ${compra.nombre}`.replace('  ', ' '),
      monto:       montoEnvio,
      metodo:      metodoPagoLabel,
      fecha:       fechaHoy,
      cobrador:    titularCobrador,
    });
  }

  const { error: finErr } = await supabase.from('finanzas_movimientos').insert(movimientos);
  if (finErr) console.error('[PRODUCTO_FINANZAS_INSERT]', finErr.message);

  const credito = plan?.otorga_creditos
    ? await emitirCredito(supabase, compra, plan, unidades)
    : null;

  return {
    ok: true,
    comprador: { nombre: compra.nombre, whatsapp: compra.whatsapp },
    producto: { titulo: compra.titulo_producto, plan: compra.titulo_plan || null },
    credito,
  };
}

async function generarEnvioParaCompra(supabase, compra_id) {
  const { data: compra, error: compraErr } = await supabase
    .from('producto_compras')
    .select(`
      id, estado, envia_shipment_id, envia_carrier, envia_service, envia_service_descripcion, sucursal_codigo,
      nombre, whatsapp, email,
      direccion_calle, direccion_numero, direccion_piso_depto,
      direccion_ciudad, direccion_provincia, direccion_codigo_postal, direccion_referencia,
      productos!producto_compras_producto_id_fkey(id, titulo, precio, peso_kg, alto_cm, ancho_cm, largo_cm)
    `)
    .eq('id', compra_id)
    .single();

  if (compraErr || !compra) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });
  if (compra.estado !== 'aprobado') throw Object.assign(new Error('La compra debe estar aprobada para generar el envío'), { status: 400 });
  if (compra.envia_shipment_id) throw Object.assign(new Error('Ya se generó el envío para esta compra'), { status: 400 });
  // Una compra de un plan sin envío no tiene dirección: envia.com rechazaría
  // la guía con un error mucho menos claro que este.
  if (!compra.direccion_calle) throw Object.assign(new Error('Esta compra no lleva envío: no hay guía que generar'), { status: 400 });

  // Un servicio "a sucursal" sin código de sucursal lo rechaza envia.com con un
  // JSON crudo (error 1127). Mejor decirle al admin qué le falta y dónde.
  const aSucursal = /sucursal|branch|agencia/i.test(
    `${compra.envia_service_descripcion || ''} ${compra.envia_service || ''}`
  );
  if (aSucursal && !compra.sucursal_codigo) {
    throw Object.assign(new Error(
      'Esta compra es a sucursal pero no tiene sucursal de destino guardada. ' +
      'Cargá sucursal_codigo (y su nombre) en producto_compras antes de generar la guía, ' +
      'o pedile al cliente que rehaga la compra eligiendo sucursal.'
    ), { status: 400 });
  }

  const producto = compra.productos;
  if (!producto) throw Object.assign(new Error('Producto de la compra no encontrado'), { status: 404 });

  const comprador = {
    nombre: compra.nombre,
    whatsapp: compra.whatsapp,
    email: compra.email,
    calle: compra.direccion_calle,
    numero: compra.direccion_numero,
    piso_depto: compra.direccion_piso_depto,
    ciudad: compra.direccion_ciudad,
    provincia: compra.direccion_provincia,
    codigo_postal: compra.direccion_codigo_postal,
    referencia: compra.direccion_referencia,
  };

  const resultado = await generarEnvio(producto, comprador, {
    carrier: compra.envia_carrier,
    service: compra.envia_service,
    sucursalCodigo: compra.sucursal_codigo,
  });

  // Se guardan primero los campos "core". El tracking_url va aparte y es
  // best-effort: perder el shipment_id obligaría a generar el envío de nuevo,
  // duplicándolo en envia.com.
  const { error: updateErr } = await supabase.from('producto_compras').update({
    envia_shipment_id:     resultado.shipment_id,
    envia_tracking_number: resultado.tracking_number,
    envia_label_url:       resultado.label_url,
    envia_generado_en:     new Date().toISOString(),
  }).eq('id', compra_id);

  if (updateErr) {
    console.error('[PRODUCTO_ENVIO_UPDATE]', updateErr.message, resultado);
    throw Object.assign(new Error(
      `El envío se generó en envia.com pero no se pudo guardar en la base de datos (${updateErr.message}). ` +
      `Guardá esto a mano para no perderlo — Tracking: ${resultado.tracking_number || '(sin dato)'} · ` +
      `Etiqueta: ${resultado.label_url || '(sin dato)'}`
    ), { status: 500 });
  }

  if (resultado.tracking_url) {
    const { error: trackUrlErr } = await supabase.from('producto_compras')
      .update({ envia_tracking_url: resultado.tracking_url })
      .eq('id', compra_id);
    if (trackUrlErr) console.warn('[PRODUCTO_TRACKING_URL_UPDATE] (no bloqueante)', trackUrlErr.message);
  }

  return { ok: true, ...resultado };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (bloquearSiOrigenInvalido(req, res)) return;

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'No autenticado' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido o expirado' });

  const { compra_id, accion } = req.body || {};
  if (!compra_id || typeof compra_id !== 'string') {
    return res.status(400).json({ error: 'compra_id inválido' });
  }
  if (accion !== 'aprobar' && accion !== 'generar-envio') {
    return res.status(400).json({ error: 'accion inválida' });
  }

  try {
    const resultado = accion === 'aprobar'
      ? await aprobar(supabase, compra_id)
      : await generarEnvioParaCompra(supabase, compra_id);
    return res.status(200).json(resultado);
  } catch (err) {
    console.error('[PRODUCTO_ADMIN_ERROR]', accion, err?.message || err);
    return res.status(err.status || 500).json({ error: err.message || 'Error al procesar la solicitud' });
  }
}
