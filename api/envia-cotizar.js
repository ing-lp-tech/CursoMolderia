import { createClient } from '@supabase/supabase-js';
import { cotizarEnvio, sucursalesDisponibles } from './_lib/envia.js';
import { setCors, bloquearSiOrigenInvalido } from './_lib/cors.js';

function validarDestino(d) {
  return d && typeof d === 'object'
    && d.nombre?.trim() && d.whatsapp?.trim()
    && d.calle?.trim() && d.ciudad?.trim() && d.provincia?.trim() && d.codigo_postal?.trim();
}

async function handleCotizar(req, res, supabase) {
  const { pizarra_id, destino } = req.body || {};
  if (!pizarra_id || typeof pizarra_id !== 'string') {
    return res.status(400).json({ error: 'pizarra_id inválido' });
  }
  if (!validarDestino(destino)) {
    return res.status(400).json({ error: 'Datos de dirección incompletos' });
  }

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
    return res.status(200).json({ opciones });
  } catch (err) {
    console.error('[ENVIA_COTIZAR_ERROR]', err?.message || err, err?.diagnostico ? JSON.stringify(err.diagnostico).slice(0, 1000) : '');
    return res.status(422).json({ error: err?.message || 'No hay opciones de envío disponibles para esa dirección' });
  }
}

async function handleSucursales(req, res) {
  const { carrier, codigo_postal, provincia } = req.body || {};
  if (!carrier || typeof carrier !== 'string') {
    return res.status(400).json({ error: 'carrier inválido' });
  }
  if (!codigo_postal || !provincia) {
    return res.status(400).json({ error: 'Faltan codigo_postal o provincia' });
  }

  try {
    const sucursales = await sucursalesDisponibles(carrier, codigo_postal, provincia);
    if (!sucursales.length) {
      return res.status(422).json({ error: 'No se encontraron sucursales para esa dirección' });
    }
    return res.status(200).json({ sucursales });
  } catch (err) {
    console.error('[ENVIA_SUCURSALES_ERROR]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Error al buscar sucursales' });
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (bloquearSiOrigenInvalido(req, res)) return;

  const { accion } = req.body || {};
  if (accion === 'sucursales') return handleSucursales(req, res);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  return handleCotizar(req, res, supabase);
}
