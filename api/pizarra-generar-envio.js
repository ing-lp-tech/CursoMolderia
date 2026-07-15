import { createClient } from '@supabase/supabase-js';
import { generarEnvio } from './_lib/envia.js';

const ALLOWED_ORIGINS = [
  'https://curso-molderia.vercel.app',
  'https://molditex.vercel.app',
  'https://www.molderia-digital.com',
  'https://molderia-digital.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

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

  const { compra_id } = req.body || {};
  if (!compra_id || typeof compra_id !== 'string') {
    return res.status(400).json({ error: 'compra_id inválido' });
  }

  try {
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

    if (compraErr || !compra) return res.status(404).json({ error: 'Compra no encontrada' });
    if (compra.estado !== 'aprobado') return res.status(400).json({ error: 'La compra debe estar aprobada para generar el envío' });
    if (compra.envia_shipment_id) return res.status(400).json({ error: 'Ya se generó el envío para esta compra' });

    const pizarra = compra.pizarras;
    if (!pizarra) return res.status(404).json({ error: 'Producto de la compra no encontrado' });

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

    const { error: updateErr } = await supabase.from('pizarras_compras').update({
      envia_shipment_id:     resultado.shipment_id,
      envia_tracking_number: resultado.tracking_number,
      envia_label_url:       resultado.label_url,
      envia_generado_en:     new Date().toISOString(),
    }).eq('id', compra_id);

    if (updateErr) {
      console.error('[PIZARRA_ENVIO_UPDATE]', updateErr.message);
      return res.status(500).json({ error: 'El envío se generó pero no se pudo guardar en la base de datos' });
    }

    return res.status(200).json({ ok: true, ...resultado });

  } catch (err) {
    console.error('[PIZARRA_GENERAR_ENVIO_ERROR]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Error al generar el envío' });
  }
}
