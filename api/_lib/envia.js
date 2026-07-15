// Integración con la API de envia.com (https://docs.envia.com)
// Autenticación: Bearer token (ENVIA_API_TOKEN).
// Producción: https://api.envia.com — Sandbox: https://api-test.envia.com
import { codigoProvincia, codigoPostalCPA } from './provinciasArgentina.js';

function apiBase() {
  return (process.env.ENVIA_API_URL || 'https://api.envia.com').replace(/\/$/, '');
}

function origenDesdeEnv() {
  const {
    ENVIA_ORIGEN_NOMBRE, ENVIA_ORIGEN_EMPRESA, ENVIA_ORIGEN_TELEFONO, ENVIA_ORIGEN_EMAIL,
    ENVIA_ORIGEN_CALLE, ENVIA_ORIGEN_NUMERO, ENVIA_ORIGEN_CIUDAD, ENVIA_ORIGEN_PROVINCIA, ENVIA_ORIGEN_CP,
  } = process.env;

  if (!ENVIA_ORIGEN_NOMBRE || !ENVIA_ORIGEN_TELEFONO || !ENVIA_ORIGEN_CALLE || !ENVIA_ORIGEN_CIUDAD || !ENVIA_ORIGEN_PROVINCIA || !ENVIA_ORIGEN_CP) {
    throw new Error('Falta configurar la dirección de origen de envía.com en las variables de entorno (ENVIA_ORIGEN_*)');
  }

  return {
    name: ENVIA_ORIGEN_NOMBRE,
    company: ENVIA_ORIGEN_EMPRESA || ENVIA_ORIGEN_NOMBRE,
    phone: ENVIA_ORIGEN_TELEFONO,
    email: ENVIA_ORIGEN_EMAIL || undefined,
    street: ENVIA_ORIGEN_NUMERO ? `${ENVIA_ORIGEN_CALLE} ${ENVIA_ORIGEN_NUMERO}` : ENVIA_ORIGEN_CALLE,
    city: ENVIA_ORIGEN_CIUDAD,
    state: codigoProvincia(ENVIA_ORIGEN_PROVINCIA),
    country: 'AR',
    postalCode: codigoPostalCPA(ENVIA_ORIGEN_CP, ENVIA_ORIGEN_PROVINCIA),
  };
}

function destinoDesdeComprador(comprador) {
  return {
    name: comprador.nombre,
    phone: comprador.whatsapp,
    email: comprador.email || undefined,
    street: comprador.numero ? `${comprador.calle} ${comprador.numero}` : comprador.calle,
    district: comprador.piso_depto || undefined,
    city: comprador.ciudad,
    state: codigoProvincia(comprador.provincia),
    country: 'AR',
    postalCode: codigoPostalCPA(comprador.codigo_postal, comprador.provincia),
    reference: comprador.referencia || undefined,
  };
}

function paqueteDesdePizarra(pizarra) {
  return [{
    content: pizarra.titulo?.slice(0, 100) || 'Pizarra digitalizadora',
    amount: 1,
    type: 'box',
    weight: Number(pizarra.peso_kg) || 1,
    weightUnit: 'KG',
    lengthUnit: 'CM',
    declaredValue: Number(pizarra.precio) || 0,
    dimensions: {
      length: Number(pizarra.largo_cm) || 60,
      width:  Number(pizarra.ancho_cm) || 40,
      height: Number(pizarra.alto_cm)  || 10,
    },
  }];
}

async function enviaFetch(path, body) {
  const token = process.env.ENVIA_API_TOKEN;
  if (!token) throw new Error('Falta configurar ENVIA_API_TOKEN en las variables de entorno');

  // Las rutas de envia.com exigen la barra final (/ship/rate/, /ship/generate/);
  // sin ella el servidor redirige y fetch termina mandando un GET sin body.
  const url = `${apiBase()}${path}${path.endsWith('/') ? '' : '/'}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let data = null;
  try { data = JSON.parse(rawText); } catch { /* respuesta no-JSON, se reporta abajo */ }

  if (!res.ok) {
    const detail = data?.meta?.message || data?.error || (rawText ? rawText.slice(0, 300) : null) || `sin cuerpo de respuesta`;
    console.error('[ENVIA_API_ERROR]', { url, status: res.status, body: rawText?.slice(0, 500) });
    throw new Error(`envia.com respondió HTTP ${res.status}: ${detail}`);
  }
  if (data === null) {
    console.error('[ENVIA_API_ERROR] Respuesta 200 pero no es JSON', { url, body: rawText?.slice(0, 500) });
    throw new Error('envia.com devolvió una respuesta inesperada (no JSON)');
  }
  return data;
}

// Cotiza el envío de una pizarra hacia la dirección del comprador.
// Devuelve la lista de opciones (carrier + service + precio + tiempo estimado).
export async function cotizarEnvio(pizarra, comprador) {
  const body = {
    origin: origenDesdeEnv(),
    destination: destinoDesdeComprador(comprador),
    packages: paqueteDesdePizarra(pizarra),
    shipment: { type: 1 },
    settings: { currency: 'ARS' },
  };

  const data = await enviaFetch('/ship/rate', body);
  const crudo = data?.data || [];
  console.log('[ENVIA_RATE_RESPONSE]', JSON.stringify(data).slice(0, 3000));

  const opciones = crudo
    .filter(o => !o.error)
    .map(o => ({
      carrier:      o.carrier,
      service:      o.service,
      descripcion:  o.serviceDescription || o.service,
      precio:       Number(o.totalPrice ?? o.total_price ?? o.price ?? 0),
      moneda:       o.currency || 'ARS',
      entrega_estimada: o.deliveryEstimate || o.delivery_estimate || null,
    }))
    .filter(o => o.precio > 0)
    .sort((a, b) => a.precio - b.precio);

  if (!opciones.length) {
    // Junta los motivos que devolvió cada carrier para no quedarnos con un
    // "no hay opciones" genérico — casi siempre es porque no hay ningún
    // carrier contratado/activado en la cuenta de envia.com, o rechazan la ruta.
    const motivos = crudo
      .map(o => o.error ? `${o.carrier || 'carrier'}: ${o.message || o.errorMessage || JSON.stringify(o.error)}` : null)
      .filter(Boolean);
    const mensaje = motivos.length
      ? motivos.join(' | ')
      : 'envia.com no devolvió ninguna tarifa. Verificá que la cuenta tenga al menos un carrier contratado/activado para envíos nacionales en Argentina (Mis Envíos → Servicios en shipping.envia.com).';
    const err = new Error(mensaje);
    err.diagnostico = crudo;
    throw err;
  }

  return opciones;
}

// Genera el envío (guía/etiqueta) una vez que la compra fue aprobada.
export async function generarEnvio(pizarra, comprador, { carrier, service }) {
  const body = {
    origin: origenDesdeEnv(),
    destination: destinoDesdeComprador(comprador),
    packages: paqueteDesdePizarra(pizarra),
    shipment: { type: 1, carrier, service },
  };

  const data = await enviaFetch('/ship/generate', body);
  const info = data?.data || {};
  return {
    shipment_id:     info.id || info.shipmentId || null,
    tracking_number: info.trackingNumber || info.tracking_number || null,
    label_url:       info.label || info.labelUrl || info.label_url || null,
  };
}
