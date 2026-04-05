import { MercadoPagoConfig, Preference } from 'mercadopago';

// ── Orígenes permitidos ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://curso-molderia.vercel.app',
  'https://molditex.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// ── Validación de inputs ──────────────────────────────────────────────────────
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 5) return false;
  return items.every(item =>
    typeof item.title === 'string' &&
    item.title.length > 0 &&
    item.title.length <= 256 &&
    typeof item.unit_price === 'number' &&
    item.unit_price > 0 &&
    item.unit_price <= 10000000 &&  // máx 10M ARS
    typeof item.quantity === 'number' &&
    item.quantity === 1 &&
    item.currency_id === 'ARS'
  );
}

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // CORS estricto — solo orígenes de confianza
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar origen en producción
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  try {
    const { items, payer_email } = req.body || {};

    // Validar email
    if (!validateEmail(payer_email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Validar items
    if (!validateItems(items)) {
      return res.status(400).json({ error: 'Items inválidos — verificá precio, cantidad y moneda' });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    const preference = new Preference(client);

    // URL base segura — siempre usar protocolo del host real
    const host = req.headers.host || 'curso-molderia.vercel.app';
    const isSafe = host.endsWith('.vercel.app') || host === 'localhost:5173' || host === 'localhost:4173';
    const protocol = isSafe ? 'https' : 'https';
    const baseUrl = host.startsWith('localhost') ? `http://${host}` : `${protocol}://${host}`;

    const sanitizedItems = items.map(item => ({
      title: item.title.replace(/[<>]/g, ''), // strip any tag chars
      unit_price: Number(item.unit_price),
      quantity: 1,
      currency_id: 'ARS',
    }));

    const response = await preference.create({
      body: {
        items: sanitizedItems,
        payer: { email: payer_email.toLowerCase().trim() },
        back_urls: {
          success: `${baseUrl}/inscripcion?status=success`,
          pending: `${baseUrl}/inscripcion?status=pending`,
          failure: `${baseUrl}/inscripcion?status=failure`,
        },
        auto_return: 'approved',
        payment_methods: { installments: 12 },
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      },
    });

    return res.status(200).json({ init_point: response.init_point, id: response.id });

  } catch (error) {
    // Log server-side only — nunca exponer detalles al cliente
    console.error('[MP_ERROR]', error?.message || error);
    return res.status(500).json({ error: 'Error al procesar el pago. Intentá de nuevo.' });
  }
}
