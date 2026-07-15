import { MercadoPagoConfig, Preference } from 'mercadopago';
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

function validarComprador(c) {
  return c && typeof c === 'object'
    && c.nombre?.trim() && c.whatsapp?.trim()
    && c.calle?.trim() && c.ciudad?.trim() && c.provincia?.trim() && c.codigo_postal?.trim();
}

function validarEnvio(e) {
  return e && typeof e === 'object' && e.carrier && e.service && Number(e.precio) >= 0;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  const { pizarra_id, comprador, envio } = req.body || {};

  if (!pizarra_id || typeof pizarra_id !== 'string') {
    return res.status(400).json({ error: 'pizarra_id inválido' });
  }
  if (!validarComprador(comprador)) {
    return res.status(400).json({ error: 'Datos del comprador incompletos o inválidos' });
  }
  if (!validarEnvio(envio)) {
    return res.status(400).json({ error: 'Debés elegir una opción de envío' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let pizarra;
  try {
    const { data, error: pizarraErr } = await supabase
      .from('pizarras')
      .select('id, titulo, precio, activo, eliminado_en, stock')
      .eq('id', pizarra_id)
      .single();
    if (pizarraErr || !data) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!data.activo || data.eliminado_en) return res.status(400).json({ error: 'Producto no disponible' });
    if (data.stock <= 0) return res.status(400).json({ error: 'Sin stock disponible' });
    pizarra = data;
  } catch (err) {
    console.error('[PIZARRA_MP_ERROR] QUERY', err?.message || err);
    return res.status(500).json({ error: 'Error al buscar el producto' });
  }

  const precioProducto = Number(pizarra.precio);
  const precioEnvio = Number(envio.precio);
  if (!precioProducto || precioProducto <= 0) return res.status(400).json({ error: 'Precio inválido' });

  const montoTotal = precioProducto + precioEnvio;
  const compraId = crypto.randomUUID();
  const host = req.headers.host || 'curso-molderia.vercel.app';
  const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;

  try {
    const { error: insertErr } = await supabase.from('pizarras_compras').insert({
      id:                      compraId,
      pizarra_id:              pizarra.id,
      titulo_pizarra:          pizarra.titulo,
      precio_base_pizarra:     precioProducto,
      descuento_aplicado_pct:  0,
      monto_producto:          precioProducto,
      monto_envio:             precioEnvio,
      monto_cobrado:           montoTotal,
      metodo_pago:             'mercadopago',
      nombre:                  comprador.nombre.trim().slice(0, 200),
      whatsapp:                comprador.whatsapp.trim().slice(0, 50),
      email:                   'sin-email@molderia-digital.com',
      direccion_calle:         comprador.calle.trim().slice(0, 200),
      direccion_numero:        comprador.numero?.trim().slice(0, 20) || null,
      direccion_piso_depto:    comprador.piso_depto?.trim().slice(0, 50) || null,
      direccion_ciudad:        comprador.ciudad.trim().slice(0, 100),
      direccion_provincia:     comprador.provincia.trim().slice(0, 100),
      direccion_codigo_postal: comprador.codigo_postal.trim().slice(0, 20),
      direccion_referencia:    comprador.referencia?.trim().slice(0, 200) || null,
      envia_carrier:            envio.carrier,
      envia_service:            envio.service,
      envia_service_descripcion: envio.descripcion || null,
      estado:                  'en_verificacion',
    });
    if (insertErr) {
      console.error('[PIZARRA_MP_ERROR] INSERT', insertErr.message);
      return res.status(500).json({ error: 'Error al registrar la compra' });
    }
  } catch (err) {
    console.error('[PIZARRA_MP_ERROR] INSERT_THROW', err?.message || err);
    return res.status(500).json({ error: 'Error al registrar la compra (excepción)' });
  }

  await notificarNuevaVenta({
    nombre: comprador.nombre.trim(), titulo: pizarra.titulo, monto: montoTotal, metodo: 'mercadopago', baseUrl,
  });

  try {
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    const preference = new Preference(client);

    const items = [{
      title: pizarra.titulo.replace(/[<>]/g, '').slice(0, 256),
      unit_price: precioProducto,
      quantity: 1,
      currency_id: 'ARS',
    }];
    if (precioEnvio > 0) {
      items.push({
        title: `Envío (${envio.descripcion || envio.carrier})`,
        unit_price: precioEnvio,
        quantity: 1,
        currency_id: 'ARS',
      });
    }

    const response = await preference.create({
      body: {
        items,
        payer: { email: 'comprador@molderia-digital.com' },
        back_urls: {
          success: `${baseUrl}/pizarras?estado=verificacion&id=${compraId}`,
          pending: `${baseUrl}/pizarras?estado=verificacion&id=${compraId}`,
          failure: `${baseUrl}/pizarras?estado=fallo&id=${compraId}`,
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
    const detail = err?.message || String(err);
    console.error('[PIZARRA_MP_ERROR] MP', detail);
    return res.status(500).json({ error: 'Error al procesar el pago. Intentá de nuevo.' });
  }
}
