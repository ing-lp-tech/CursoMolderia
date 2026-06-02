import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

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

// Maps frontend como_encontro values to the DB check constraint values
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

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── PASO 1: buscar el molde ────────────────────────────────────
  let molde;
  try {
    const { data, error: moldeErr } = await supabase
      .from('moldes')
      .select('id, titulo, precio, activo, eliminado_en, categoria_id, subcategoria_id')
      .eq('id', molde_id)
      .single();
    if (moldeErr || !data) return res.status(404).json({ error: 'Molde no encontrado' });
    if (!data.activo || data.eliminado_en) return res.status(400).json({ error: 'Molde no disponible' });
    molde = data;
  } catch (err) {
    console.error('[MOLDE_MP_ERROR] PASO1_QUERY', err?.message || err);
    return res.status(500).json({ error: 'Error al buscar el molde', debug: err?.message });
  }

  const precio = Number(molde.precio);
  if (!precio || precio <= 0) return res.status(400).json({ error: 'Precio inválido' });

  const compraId = crypto.randomUUID();
  const host = req.headers.host || 'curso-molderia.vercel.app';
  const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;

  // ── PASO 2: registrar la compra en Supabase ────────────────────
  try {
    const { error: insertErr } = await supabase.from('moldes_compras').insert({
      id:                   compraId,
      molde_id:             molde.id,
      categoria_id:         molde.categoria_id || null,
      subcategoria_id:      molde.subcategoria_id || null,
      titulo_molde:         molde.titulo,
      precio_base_molde:    precio,
      descuento_aplicado_pct: 0,
      monto_cobrado:        precio,
      metodo_pago:          'mercadopago',
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
      console.error('[MOLDE_MP_ERROR] PASO2_INSERT', insertErr.message);
      return res.status(500).json({ error: 'Error al registrar la compra', debug: insertErr.message });
    }
  } catch (err) {
    console.error('[MOLDE_MP_ERROR] PASO2_THROW', err?.message || err);
    return res.status(500).json({ error: 'Error al registrar la compra (excepción)', debug: err?.message });
  }

  // ── PASO 3: crear preferencia en MercadoPago ──────────────────
  try {
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: [{
          title: molde.titulo.replace(/[<>]/g, '').slice(0, 256),
          unit_price: precio,
          quantity: 1,
          currency_id: 'ARS',
        }],
        payer: { email: 'comprador@molderia-digital.com' },
        back_urls: {
          success: `${baseUrl}/moldes?estado=verificacion&id=${compraId}`,
          pending: `${baseUrl}/moldes?estado=verificacion&id=${compraId}`,
          failure: `${baseUrl}/moldes?estado=fallo&id=${compraId}`,
        },
        auto_return: 'approved',
        payment_methods: { installments: 1 },
        external_reference: compraId,
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    return res.status(200).json({ init_point: response.init_point, compra_id: compraId });

  } catch (err) {
    // MP SDK lanza el error HTTP de la API como excepción
    const detail = err?.message || String(err);
    console.error('[MOLDE_MP_ERROR] PASO3_MP', detail);
    return res.status(500).json({
      error: 'Error al procesar el pago. Intentá de nuevo.',
      debug: detail,
    });
  }
}
