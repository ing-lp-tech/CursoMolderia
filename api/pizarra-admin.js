import { createClient } from '@supabase/supabase-js';
import { generarEnvio } from './_lib/envia.js';
import { setCors, bloquearSiOrigenInvalido } from './_lib/cors.js';

async function aprobar(supabase, compra_id) {
  const { data: compra, error: compraErr } = await supabase
    .from('pizarras_compras')
    .select('id, estado, pizarra_id, metodo_pago, monto_cobrado, titulo_pizarra, nombre, whatsapp')
    .eq('id', compra_id)
    .single();

  if (compraErr || !compra) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });
  if (compra.estado === 'aprobado') throw Object.assign(new Error('Esta compra ya fue aprobada'), { status: 400 });

  const { error: updateErr } = await supabase
    .from('pizarras_compras')
    .update({ estado: 'aprobado' })
    .eq('id', compra_id);
  if (updateErr) {
    console.error('[PIZARRA_APPROVE_UPDATE]', updateErr.message);
    throw Object.assign(new Error('Error al actualizar el estado de la compra'), { status: 500 });
  }

  // Descontar stock (no bloquea la aprobación si falla)
  if (compra.pizarra_id) {
    const { data: pizarra } = await supabase.from('pizarras').select('stock').eq('id', compra.pizarra_id).single();
    if (pizarra) {
      await supabase.from('pizarras').update({ stock: Math.max(0, pizarra.stock - 1) }).eq('id', compra.pizarra_id);
    }
  }

  const metodoPagoLabel = compra.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Transferencia bancaria';
  const { data: titularRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'moldes_titular')
    .single();
  const titularCobrador = titularRow?.value?.trim() || null;

  const { error: finErr } = await supabase.from('finanzas_movimientos').insert({
    tipo:        'ingreso',
    categoria:   'Venta de pizarra digitalizadora',
    descripcion: `Pizarra: ${compra.titulo_pizarra} — ${compra.nombre}`,
    monto:       Number(compra.monto_cobrado),
    metodo:      metodoPagoLabel,
    fecha:       new Date().toISOString().slice(0, 10),
    cobrador:    titularCobrador,
  });
  if (finErr) console.error('[PIZARRA_FINANZAS_INSERT]', finErr.message);

  return {
    ok: true,
    comprador: { nombre: compra.nombre, whatsapp: compra.whatsapp },
    pizarra: { titulo: compra.titulo_pizarra },
  };
}

async function generarEnvioParaCompra(supabase, compra_id) {
  const { data: compra, error: compraErr } = await supabase
    .from('pizarras_compras')
    .select(`
      id, estado, envia_shipment_id, envia_carrier, envia_service,
      nombre, whatsapp,
      direccion_calle, direccion_numero, direccion_piso_depto,
      direccion_ciudad, direccion_provincia, direccion_codigo_postal, direccion_referencia,
      pizarras!pizarras_compras_pizarra_id_fkey(id, titulo, precio, peso_kg, alto_cm, ancho_cm, largo_cm)
    `)
    .eq('id', compra_id)
    .single();

  if (compraErr || !compra) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });
  if (compra.estado !== 'aprobado') throw Object.assign(new Error('La compra debe estar aprobada para generar el envío'), { status: 400 });
  if (compra.envia_shipment_id) throw Object.assign(new Error('Ya se generó el envío para esta compra'), { status: 400 });

  const pizarra = compra.pizarras;
  if (!pizarra) throw Object.assign(new Error('Producto de la compra no encontrado'), { status: 404 });

  const comprador = {
    nombre: compra.nombre,
    whatsapp: compra.whatsapp,
    calle: compra.direccion_calle,
    numero: compra.direccion_numero,
    piso_depto: compra.direccion_piso_depto,
    ciudad: compra.direccion_ciudad,
    provincia: compra.direccion_provincia,
    codigo_postal: compra.direccion_codigo_postal,
    referencia: compra.direccion_referencia,
  };

  const resultado = await generarEnvio(pizarra, comprador, {
    carrier: compra.envia_carrier,
    service: compra.envia_service,
  });

  // Guardamos primero los campos "core" (existen desde la migración 04).
  // envia_tracking_url es best-effort: si esa columna todavía no existe
  // (falta correr 05_tracking_url.sql) no queremos que tire abajo el guardado
  // del resto — perder el shipment_id/tracking_number obligaría a generar
  // el envío de nuevo, duplicándolo en envia.com.
  const { error: updateErr } = await supabase.from('pizarras_compras').update({
    envia_shipment_id:     resultado.shipment_id,
    envia_tracking_number: resultado.tracking_number,
    envia_label_url:       resultado.label_url,
    envia_generado_en:     new Date().toISOString(),
  }).eq('id', compra_id);

  if (updateErr) {
    console.error('[PIZARRA_ENVIO_UPDATE]', updateErr.message, resultado);
    throw Object.assign(new Error(
      `El envío se generó en envia.com pero no se pudo guardar en la base de datos (${updateErr.message}). ` +
      `Guardá esto a mano para no perderlo — Tracking: ${resultado.tracking_number || '(sin dato)'} · ` +
      `Etiqueta: ${resultado.label_url || '(sin dato)'}`
    ), { status: 500 });
  }

  if (resultado.tracking_url) {
    const { error: trackUrlErr } = await supabase.from('pizarras_compras')
      .update({ envia_tracking_url: resultado.tracking_url })
      .eq('id', compra_id);
    if (trackUrlErr) console.warn('[PIZARRA_TRACKING_URL_UPDATE] (no bloqueante, revisá si falta correr 05_tracking_url.sql)', trackUrlErr.message);
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
    console.error('[PIZARRA_ADMIN_ERROR]', accion, err?.message || err);
    return res.status(err.status || 500).json({ error: err.message || 'Error al procesar la solicitud' });
  }
}
