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

  // Verify admin JWT
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'No autenticado' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validate JWT belongs to a real authenticated user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido o expirado' });

  const { compra_id } = req.body || {};
  if (!compra_id || typeof compra_id !== 'string') {
    return res.status(400).json({ error: 'compra_id inválido' });
  }

  try {
    // Fetch purchase with molde info
    const { data: compra, error: compraErr } = await supabase
      .from('moldes_compras')
      .select(`
        id, estado, molde_id, metodo_pago, monto_cobrado,
        nombre, whatsapp, email,
        moldes!moldes_compras_molde_id_fkey(id, titulo, archivo_ads_path, archivo_pdf_path, imagen_1_path, imagen_2_path, imagen_3_path)
      `)
      .eq('id', compra_id)
      .single();

    if (compraErr || !compra) return res.status(404).json({ error: 'Compra no encontrada' });
    if (compra.estado === 'aprobado') return res.status(400).json({ error: 'Esta compra ya fue aprobada' });

    const molde = compra.moldes;
    if (!molde) return res.status(404).json({ error: 'Molde de la compra no encontrado' });

    // Generate signed URLs for private files (24h)
    const urls = {};
    const BUCKET = 'moldes-archivos';
    const EXPIRES_IN = 86400;

    if (molde.archivo_ads_path) {
      const { data: signed, error: adsErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(molde.archivo_ads_path, EXPIRES_IN);
      if (adsErr) {
        console.error('[SIGNED_ADS]', adsErr.message);
        return res.status(500).json({ error: 'Error al generar enlace del archivo .ads' });
      }
      if (signed?.signedUrl) urls.ads = signed.signedUrl;
    }

    if (molde.archivo_pdf_path) {
      const { data: signed, error: pdfErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(molde.archivo_pdf_path, EXPIRES_IN);
      if (pdfErr) {
        console.warn('[SIGNED_PDF] Error al firmar:', pdfErr.message);
      } else if (signed?.signedUrl) {
        urls.pdf = signed.signedUrl;
      } else {
        console.warn('[SIGNED_PDF] URL vacía para path:', molde.archivo_pdf_path);
      }
    }

    // Mark as approved
    const { error: updateErr } = await supabase
      .from('moldes_compras')
      .update({ estado: 'aprobado' })
      .eq('id', compra_id);

    if (updateErr) {
      console.error('[MOLDE_APPROVE_UPDATE]', updateErr.message);
      return res.status(500).json({ error: 'Error al actualizar el estado de la compra' });
    }

    // Insert finanzas record — non-fatal if it fails
    const metodoPagoLabel = compra.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Transferencia bancaria';

    // Fetch titular configured in moldes settings (used as "cobrador" in finanzas)
    const { data: titularRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'moldes_titular')
      .single();
    const titularCobrador = titularRow?.value?.trim() || null;

    const { error: finErr } = await supabase.from('finanzas_movimientos').insert({
      tipo:        'ingreso',
      categoria:   'Venta de molde',
      descripcion: `Molde: ${molde.titulo} — ${compra.nombre}`,
      monto:       Number(compra.monto_cobrado),
      metodo:      metodoPagoLabel,
      fecha:       new Date().toISOString().slice(0, 10),
      cobrador:    titularCobrador,
    });
    if (finErr) console.error('[MOLDE_FINANZAS_INSERT]', finErr.message);

    // Build public image URLs from individual path columns (public bucket)
    const supabasePublicUrl = supabaseUrl.replace(/\/$/, '');
    const imagenes = [molde.imagen_1_path, molde.imagen_2_path, molde.imagen_3_path]
      .filter(Boolean)
      .map(path => `${supabasePublicUrl}/storage/v1/object/public/moldes-imagenes/${path}`);

    return res.status(200).json({
      ok: true,
      ads_url:  urls.ads || null,
      pdf_url:  urls.pdf || null,
      imagenes,
      comprador: {
        nombre:   compra.nombre,
        whatsapp: compra.whatsapp,
        email:    compra.email,
      },
      molde: { titulo: molde.titulo },
    });

  } catch (err) {
    console.error('[MOLDE_APROBAR_ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Error al aprobar la compra. Intentá de nuevo.' });
  }
}
