import { createClient } from '@supabase/supabase-js';
import { notificarNuevaVenta } from './_lib/notify.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validateWhatsapp(wa) {
  return typeof wa === 'string' && wa.trim().length >= 6;
}

function mapComoLlego(val) {
  const MAP = {
    'Instagram': ['instagram', null],
    'Google': ['google', null],
    'WhatsApp': ['whatsapp', null],
    'Recomendación de amigo/a': ['referido', null],
    'Facebook': ['otro', 'Facebook'],
    'TikTok': ['otro', 'TikTok'],
    'YouTube': ['otro', 'YouTube'],
    'Otro': ['otro', null],
  };
  return MAP[val] ?? ['otro', val || null];
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  const { molde_id, comprador } = req.body || {};

  if (!molde_id || typeof molde_id !== 'string') {
    return res.status(400).json({ error: 'molde_id inválido' });
  }
  if (!comprador || !validateWhatsapp(comprador.whatsapp) || !comprador.nombre?.trim()) {
    return res.status(400).json({ error: 'Datos del comprador incompletos o inválidos' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: molde, error: moldeErr } = await supabase
      .from('moldes')
      .select('id, titulo, precio, activo, eliminado_en, categoria_id, subcategoria_id')
      .eq('id', molde_id)
      .single();

    if (moldeErr || !molde) return res.status(404).json({ error: 'Molde no encontrado' });
    if (!molde.activo || molde.eliminado_en) return res.status(400).json({ error: 'Molde no disponible' });

    const precioBase = Number(molde.precio);
    if (!precioBase || precioBase <= 0) return res.status(400).json({ error: 'Precio inválido' });

    // Fetch discount from DB (server-side, authoritative — never trust client)
    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'moldes_descuento_transferencia')
      .single();

    const descuento = settingRow?.value ? Math.max(0, Math.min(100, Number(settingRow.value))) : 0;
    const monto = Math.round(precioBase * (1 - descuento / 100));

    const compraId = crypto.randomUUID();

    const { error: insertErr } = await supabase.from('moldes_compras').insert({
      id:                   compraId,
      molde_id:             molde.id,
      categoria_id:         molde.categoria_id || null,
      subcategoria_id:      molde.subcategoria_id || null,
      titulo_molde:         molde.titulo,
      precio_base_molde:    precioBase,
      descuento_aplicado_pct: descuento,
      monto_cobrado:        monto,
      metodo_pago:          'transferencia',
      nombre:               comprador.nombre.trim().slice(0, 200),
      whatsapp:             comprador.whatsapp.trim().slice(0, 50),
      email:                'sin-email@molderia-digital.com',
      provincia:            comprador.provincia || null,
      ciudad:               comprador.ciudad?.trim().slice(0, 100) || null,
      como_llego:           'otro',
      como_llego_detalle:   null,
      estado:               'en_verificacion',
    });

    if (insertErr) {
      console.error('[MOLDE_TRANSFER_INSERT]', insertErr.message);
      return res.status(500).json({ error: 'Error al registrar la compra' });
    }

    const host = req.headers.host || 'curso-molderia.vercel.app';
    const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;
    await notificarNuevaVenta({
      nombre: comprador.nombre.trim(), titulo: molde.titulo, monto, metodo: 'transferencia', baseUrl,
    });

    return res.status(200).json({ compra_id: compraId, monto });

  } catch (err) {
    console.error('[MOLDE_TRANSFER_ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Error al registrar la compra. Intentá de nuevo.' });
  }
}
