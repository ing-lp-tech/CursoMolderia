import { createClient } from '@supabase/supabase-js';

// Webhook "onShipmentStatusUpdate" de envia.com — se configura en
// shipping.envia.com/settings/developers con la URL:
//   https://TU_DOMINIO/api/envia-webhook?token=ENVIA_WEBHOOK_SECRET
//
// No es una llamada de navegador (la hace el servidor de envia.com), así que
// no aplicamos el chequeo de Origin/CORS que usan los demás endpoints.
// La protección acá es el token compartido en el query string.

function extraerDatosWebhook(body) {
  const data = body?.data || body;
  const shipmentId = data?.shipmentId || data?.shipment_id || data?.id || null;
  const trackingNumber = data?.trackingNumber || data?.tracking_number || null;
  const status = data?.status || data?.shipmentStatus || data?.event || null;
  return { shipmentId, trackingNumber, status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const token = process.env.ENVIA_WEBHOOK_SECRET;
  if (!token || req.query?.token !== token) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { shipmentId, trackingNumber, status } = extraerDatosWebhook(req.body);

  console.log('[ENVIA_WEBHOOK] payload recibido:', JSON.stringify(req.body));

  if (!shipmentId && !trackingNumber) {
    // Igual respondemos 200: si no devolvemos éxito, envia.com reintenta indefinidamente.
    console.warn('[ENVIA_WEBHOOK] No se pudo identificar el envío en el payload');
    return res.status(200).json({ ok: true, ignorado: true });
  }

  try {
    let query = supabase.from('pizarras_compras').update({
      envia_estado: status || null,
      envia_estado_actualizado_en: new Date().toISOString(),
      envia_webhook_raw: req.body,
    });

    query = shipmentId
      ? query.eq('envia_shipment_id', shipmentId)
      : query.eq('envia_tracking_number', trackingNumber);

    const { error, count } = await query.select('id', { count: 'exact' });

    if (error) {
      console.error('[ENVIA_WEBHOOK_UPDATE]', error.message);
      return res.status(500).json({ error: 'Error al guardar la actualización' });
    }
    if (!count) {
      console.warn('[ENVIA_WEBHOOK] No se encontró ninguna compra para', { shipmentId, trackingNumber });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[ENVIA_WEBHOOK_ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Error al procesar el webhook' });
  }
}
