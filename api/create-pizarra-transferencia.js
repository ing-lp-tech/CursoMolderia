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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: pizarra, error: pizarraErr } = await supabase
      .from('pizarras')
      .select('id, titulo, precio, activo, eliminado_en, stock')
      .eq('id', pizarra_id)
      .single();

    if (pizarraErr || !pizarra) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!pizarra.activo || pizarra.eliminado_en) return res.status(400).json({ error: 'Producto no disponible' });
    if (pizarra.stock <= 0) return res.status(400).json({ error: 'Sin stock disponible' });

    const precioBase = Number(pizarra.precio);
    if (!precioBase || precioBase <= 0) return res.status(400).json({ error: 'Precio inválido' });

    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'moldes_descuento_transferencia')
      .single();

    const descuento = settingRow?.value ? Math.max(0, Math.min(100, Number(settingRow.value))) : 0;
    const montoProducto = Math.round(precioBase * (1 - descuento / 100));
    const precioEnvio = Number(envio.precio);
    const montoTotal = montoProducto + precioEnvio;

    const compraId = crypto.randomUUID();

    const { error: insertErr } = await supabase.from('pizarras_compras').insert({
      id:                      compraId,
      pizarra_id:              pizarra.id,
      titulo_pizarra:          pizarra.titulo,
      precio_base_pizarra:     precioBase,
      descuento_aplicado_pct:  descuento,
      monto_producto:          montoProducto,
      monto_envio:             precioEnvio,
      monto_cobrado:           montoTotal,
      metodo_pago:             'transferencia',
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
      console.error('[PIZARRA_TRANSFER_INSERT]', insertErr.message);
      return res.status(500).json({ error: 'Error al registrar la compra' });
    }

    const host = req.headers.host || 'curso-molderia.vercel.app';
    const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;
    await notificarNuevaVenta({
      nombre: comprador.nombre.trim(), titulo: pizarra.titulo, monto: montoTotal, metodo: 'transferencia', baseUrl,
    });

    return res.status(200).json({ compra_id: compraId, monto: montoTotal });

  } catch (err) {
    console.error('[PIZARRA_TRANSFER_ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Error al registrar la compra. Intentá de nuevo.' });
  }
}
