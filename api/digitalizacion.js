import { createClient } from '@supabase/supabase-js';
import { setCors, bloquearSiOrigenInvalido } from './_lib/cors.js';

// Códigos de digitalización (MTX-XXXX-XXXX) vistos desde afuera del panel.
//
// Un solo archivo para dos públicos porque el plan Hobby de Vercel admite 12
// funciones y este es el lugar 12 (ver sql/productos/README.md).
//
// ── 1. El comprador, desde /software ─────────────────────────────────────────
//   { accion: 'consultar', compra: <uuid> }   estado de su compra y su código
//   { accion: 'consultar', codigo: 'MTX-…' }  cuántos usos le quedan
//
//   Público, con el mismo control de origen que el resto de los endpoints.
//   Devuelve lo justo: nada de nombre, WhatsApp ni email. El uuid de la compra
//   es aleatorio, así que tenerlo es haber comprado.
//
// ── 2. El software de digitalización (la otra app web) ───────────────────────
//   Header x-api-key: <SOFTWARE_API_KEY>
//   { accion: 'validar',  codigo }                         no gasta nada
//   { accion: 'consumir', codigo, cantidad?, referencia? } gasta usos
//
//   SERVIDOR A SERVIDOR: si el software lo llamara desde el navegador, la clave
//   quedaría a la vista y con ella se le pueden gastar los créditos a cualquier
//   cliente cuyo código se conozca. Por eso estas acciones no llevan CORS.

const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_RE = /^MTX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

const MENSAJES = {
  inexistente:       'El código no existe.',
  anulado:           'El código fue anulado.',
  vencido:           'El código está vencido.',
  agotado:           'El código no tiene usos suficientes.',
  cantidad_invalida: 'Cantidad inválida.',
};

const SELECT_CREDITO = 'codigo, cliente_nombre, creditos_total, creditos_restantes, estado, vence_en';

function err(status, error) {
  return Object.assign(new Error(error), { status });
}

function vencido(c) {
  return !!c.vence_en && new Date(c.vence_en) <= new Date();
}

// Por qué un código no sirve ahora mismo, o null si sirve.
function motivoInvalido(c) {
  if (c.estado === 'anulado')     return 'anulado';
  if (vencido(c))                 return 'vencido';
  if (c.creditos_restantes <= 0)  return 'agotado';
  return null;
}

function leerCodigo(body) {
  const codigo = typeof body?.codigo === 'string' ? body.codigo.trim().toUpperCase() : '';
  if (!CODIGO_RE.test(codigo)) throw err(400, 'El código tiene que tener la forma MTX-XXXX-XXXX');
  return codigo;
}

async function buscarCredito(supabase, filtro, valor) {
  const { data } = await supabase
    .from('digitalizacion_creditos')
    .select(SELECT_CREDITO)
    .eq(filtro, valor)
    .is('eliminado_en', null)
    .maybeSingle();
  return data;
}

// ════════════════════════════════════════════════════════════════
// 1. COMPRADOR
// ════════════════════════════════════════════════════════════════

function vistaComprador(c) {
  if (!c) return null;
  return {
    codigo:    c.codigo,
    total:     c.creditos_total,
    restantes: c.creditos_restantes,
    estado:    c.estado === 'activo' && vencido(c) ? 'vencido' : c.estado,
    vence_en:  c.vence_en,
  };
}

async function consultar(supabase, body) {
  const compraId = typeof body?.compra === 'string' ? body.compra.trim() : '';

  if (compraId) {
    if (!UUID_RE.test(compraId)) throw err(400, 'Link de compra inválido');

    const { data: compra } = await supabase
      .from('producto_compras')
      .select('id, estado, titulo_producto, titulo_plan, cantidad, eliminado_en')
      .eq('id', compraId)
      .maybeSingle();
    if (!compra || compra.eliminado_en) throw err(404, 'No encontramos esa compra');

    const credito = compra.estado === 'aprobado'
      ? vistaComprador(await buscarCredito(supabase, 'compra_id', compra.id))
      : null;

    return {
      compra: {
        estado:   compra.estado,
        producto: compra.titulo_producto,
        plan:     compra.titulo_plan,
        cantidad: compra.cantidad,
      },
      credito,
    };
  }

  const codigo = leerCodigo(body);
  const c = await buscarCredito(supabase, 'codigo', codigo);
  if (!c) throw err(404, 'Ese código no existe. Revisá que esté bien copiado.');
  return { credito: vistaComprador(c) };
}

// ════════════════════════════════════════════════════════════════
// 2. SOFTWARE
// ════════════════════════════════════════════════════════════════

// Comparación en tiempo constante: con un === se puede ir adivinando la clave
// carácter por carácter midiendo cuánto tarda en fallar.
function claveValida(recibida, esperada) {
  if (!recibida || !esperada || recibida.length !== esperada.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) diff |= recibida.charCodeAt(i) ^ esperada.charCodeAt(i);
  return diff === 0;
}

async function validar(supabase, body) {
  const c = await buscarCredito(supabase, 'codigo', leerCodigo(body));
  if (!c) return { status: 200, body: { valido: false, motivo: 'inexistente', error: MENSAJES.inexistente } };

  const motivo = motivoInvalido(c);
  return {
    status: 200,
    body: {
      valido:             !motivo,
      motivo,
      error:              motivo ? MENSAJES[motivo] : undefined,
      codigo:             c.codigo,
      cliente:            c.cliente_nombre,
      creditos_total:     c.creditos_total,
      creditos_restantes: c.creditos_restantes,
      vence_en:           c.vence_en,
    },
  };
}

// El descuento lo hace fn_usar_credito (script 13): toma un lock sobre el
// código, así dos consumos simultáneos no gastan el mismo crédito, y no
// vuelve a descontar si la `referencia` ya se usó (reintento de red).
async function consumir(supabase, body) {
  const codigo = leerCodigo(body);
  const cantidad = Math.trunc(Number(body?.cantidad ?? 1));
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 1000) throw err(400, MENSAJES.cantidad_invalida);
  const referencia = typeof body?.referencia === 'string' ? body.referencia.trim().slice(0, 200) || null : null;

  const { data, error } = await supabase.rpc('fn_usar_credito', {
    p_codigo:     codigo,
    p_cantidad:   cantidad,
    p_referencia: referencia,
    p_origen:     'software',
  });

  if (error) {
    // Lo más probable: el script 13 todavía no se corrió en Supabase.
    console.error('[DIGITALIZACION_RPC]', error.message);
    throw err(500, 'No se pudo registrar el uso');
  }

  if (!data?.ok) {
    const status = data?.motivo === 'inexistente' ? 404 : data?.motivo === 'cantidad_invalida' ? 400 : 409;
    return { status, body: { ok: false, motivo: data?.motivo, error: MENSAJES[data?.motivo] || 'No se pudo usar el código',
      creditos_restantes: data?.restantes } };
  }
  return {
    status: 200,
    body: {
      ok:                 true,
      repetido:           !!data.repetido,
      creditos_total:     data.total,
      creditos_restantes: data.restantes,
      estado:             data.estado,
    },
  };
}

// ════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const accion = req.body?.accion;
  const esDelComprador = accion === 'consultar';

  // El preflight solo lo hace el navegador, o sea, el comprador.
  if (req.method === 'OPTIONS') { setCors(req, res); return res.status(204).end(); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  if (esDelComprador) {
    setCors(req, res);
    if (bloquearSiOrigenInvalido(req, res)) return;
  } else if (accion === 'validar' || accion === 'consumir') {
    const esperada = process.env.SOFTWARE_API_KEY;
    if (!esperada) return res.status(500).json({ error: 'Falta configurar SOFTWARE_API_KEY en el servidor' });
    const recibida = String(req.headers['x-api-key'] || '').trim();
    if (!claveValida(recibida, esperada)) return res.status(401).json({ error: 'API key inválida' });
  } else {
    return res.status(400).json({ error: 'accion tiene que ser "consultar", "validar" o "consumir"' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (esDelComprador) return res.status(200).json(await consultar(supabase, req.body));
    const r = accion === 'validar' ? await validar(supabase, req.body) : await consumir(supabase, req.body);
    return res.status(r.status).json(r.body);
  } catch (e) {
    if (!e.status) console.error('[DIGITALIZACION_ERROR]', accion, e?.message || e);
    return res.status(e.status || 500).json({
      error: e.status ? e.message : 'No pudimos procesar el pedido. Probá de nuevo en un rato.',
    });
  }
}
