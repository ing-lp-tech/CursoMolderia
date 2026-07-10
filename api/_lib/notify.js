// Aviso push (ntfy.sh) al admin cuando entra una compra nueva.
// No requiere cuenta ni API key: NTFY_TOPIC es un "canal" privado por ser
// un nombre difícil de adivinar. Suscribirse desde la app ntfy (iOS/Android)
// o en https://ntfy.sh/<topic> desde el navegador.
const NTFY_SERVER = process.env.NTFY_SERVER || 'https://ntfy.sh';

export async function notificarNuevaVenta({ nombre, titulo, monto, metodo, baseUrl }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return; // no configurado — no bloquea el flujo de compra

  const metodoLabel = metodo === 'mercadopago' ? 'MercadoPago' : 'Transferencia';
  const mensaje = `${nombre} quiere comprar "${titulo}" — $${Number(monto).toLocaleString('es-AR')} (${metodoLabel}). Verificá el pago y aprobá desde el panel.`;

  try {
    await fetch(`${NTFY_SERVER}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Title': 'Nueva venta de molde',
        'Priority': 'high',
        'Tags': 'moneybag',
        ...(baseUrl ? { 'Click': `${baseUrl}/admin/moldes` } : {}),
      },
      body: mensaje,
    });
  } catch (err) {
    console.error('[NTFY_NOTIFY_ERROR]', err?.message || err);
  }
}
