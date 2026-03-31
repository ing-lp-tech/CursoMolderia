import { MercadoPagoConfig, Preference } from 'mercadopago';

// Vercel Serverless Function
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { items, payer_email } = req.body;
    
    // Obtenemos el access token seguro desde las variables ocultas del servidor
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('No se encontró MP_ACCESS_TOKEN en las variables de entorno del servidor.');
    }

    // Cliente MP
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    
    // Armamos la Preferencia
    const preference = new Preference(client);
    
    // Definimos URL a donde volverá el alumno si paga bien
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'curso-molderia.vercel.app';
    const baseUrl = `${protocol}://${host}`;

    const response = await preference.create({
      body: {
        items: items, // Array: [{title: 'Curso', unit_price: 100, quantity: 1, currency_id: "ARS"}]
        payer: { email: payer_email },
        back_urls: {
          success: `${baseUrl}/inscripcion?status=success`,
          pending: `${baseUrl}/inscripcion?status=pending`,
          failure: `${baseUrl}/inscripcion?status=failure`
        },
        auto_return: 'approved',
        payment_methods: {
          installments: 12
        }
      }
    });

    res.status(200).json({ init_point: response.init_point, id: response.id });
  } catch (error) {
    console.error('MP_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
}
