// Integración con la API de envia.com (https://docs.envia.com)
// Autenticación: Bearer token (ENVIA_API_TOKEN).
// Producción: https://api.envia.com — Sandbox: https://api-test.envia.com
import { codigoProvincia } from './provinciasArgentina.js';

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
    postalCode: ENVIA_ORIGEN_CP,
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
    postalCode: comprador.codigo_postal,
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

  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.meta?.message || data?.error || JSON.stringify(data) || `HTTP ${res.status}`;
    throw new Error(`envia.com respondió con error: ${detail}`);
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
  };

  const data = await enviaFetch('/ship/rate', body);
  const opciones = (data?.data || [])
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
