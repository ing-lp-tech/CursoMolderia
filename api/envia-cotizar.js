import { createClient } from '@supabase/supabase-js';
import { cotizarEnvio } from './_lib/envia.js';

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

function validarDestino(d) {
  return d && typeof d === 'object'
    && d.nombre?.trim() && d.whatsapp?.trim()
    && d.calle?.trim() && d.ciudad?.trim() && d.provincia?.trim() && d.codigo_postal?.trim();
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  const { pizarra_id, destino } = req.body || {};
  if (!pizarra_id || typeof pizarra_id !== 'string') {
    return res.status(400).json({ error: 'pizarra_id inválido' });
  }
  if (!validarDestino(destino)) {
    return res.status(400).json({ error: 'Datos de dirección incompletos' });
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
      .select('id, titulo, precio, activo, eliminado_en, stock, peso_kg, alto_cm, ancho_cm, largo_cm')
      .eq('id', pizarra_id)
      .single();

    if (pizarraErr || !pizarra) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!pizarra.activo || pizarra.eliminado_en) return res.status(400).json({ error: 'Producto no disponible' });
    if (pizarra.stock <= 0) return res.status(400).json({ error: 'Sin stock disponible' });

    const opciones = await cotizarEnvio(pizarra, destino);
    if (!opciones.length) {
      return res.status(422).json({ error: 'No hay opciones de envío disponibles para esa dirección' });
    }

    return res.status(200).json({ opciones });
  } catch (err) {
    console.error('[ENVIA_COTIZAR_ERROR]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Error al cotizar el envío' });
  }
}
