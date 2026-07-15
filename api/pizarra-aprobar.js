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
      .select('id, estado, pizarra_id, metodo_pago, monto_cobrado, titulo_pizarra, nombre, whatsapp')
      .eq('id', compra_id)
      .single();

    if (compraErr || !compra) return res.status(404).json({ error: 'Compra no encontrada' });
    if (compra.estado === 'aprobado') return res.status(400).json({ error: 'Esta compra ya fue aprobada' });

    const { error: updateErr } = await supabase
      .from('pizarras_compras')
      .update({ estado: 'aprobado' })
      .eq('id', compra_id);
    if (updateErr) {
      console.error('[PIZARRA_APPROVE_UPDATE]', updateErr.message);
      return res.status(500).json({ error: 'Error al actualizar el estado de la compra' });
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

    return res.status(200).json({
      ok: true,
      comprador: { nombre: compra.nombre, whatsapp: compra.whatsapp },
      pizarra: { titulo: compra.titulo_pizarra },
    });

  } catch (err) {
    console.error('[PIZARRA_APROBAR_ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Error al aprobar la compra. Intentá de nuevo.' });
  }
}
