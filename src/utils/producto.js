// Moneda y modos de cobro/envío de un producto.
//
// Las tres columnas las agrega el script 12. Todo lo que ya estaba cargado
// tiene los defaults —ARS, cobro online, envío a cotizar—, que son exactamente
// el comportamiento anterior. Por eso cada helper acepta un producto sin estos
// campos y contesta lo mismo que contestaba antes de que existieran.

// ── Moneda ───────────────────────────────────────────────────────────────────
//
// El símbolo del peso va solo ("$400.000") porque es la moneda de la casa y
// escribir "ARS" en cada precio del catálogo argentino sería ruido. El dólar sí
// se nombra: "USD 4.000". La ambigüedad de un "$4.000" que en realidad son
// dólares es justo la clase de malentendido que termina en una discusión por
// WhatsApp.
export function formatPrecio(monto, moneda = 'ARS') {
  const n = Number(monto || 0).toLocaleString('es-AR');
  return moneda === 'USD' ? `USD ${n}` : `$${n}`;
}

export function monedaDe(producto) {
  return producto?.moneda === 'USD' ? 'USD' : 'ARS';
}

// ── Cobro ────────────────────────────────────────────────────────────────────
//
// Un producto en dólares NO se paga en la web: MercadoPago Argentina cobra solo
// en pesos. La base lo garantiza con una constraint (`productos_usd_coordina_check`),
// pero acá se vuelve a derivar de la moneda en vez de confiar solo en la
// columna: si alguna fila vieja quedara inconsistente, el frontend igual hace
// lo correcto.
export function cobroCoordinado(producto) {
  return monedaDe(producto) === 'USD' || producto?.cobro_modo === 'coordinar';
}

// ── Envío ────────────────────────────────────────────────────────────────────

export const ENVIO_MODOS = {
  cotizar:   {
    label: 'Se cotiza online',
    ayuda: 'El comprador elige entre la cotización automática y coordinar por WhatsApp. Es lo normal.',
  },
  coordinar: {
    label: 'Siempre a coordinar',
    ayuda: 'No se ofrece cotización automática. Para lo que el correo no cotiza: un plotter de 2,4 m, algo frágil, algo que viaja en flete.',
  },
  incluido:  {
    label: 'Incluido en el precio',
    ayuda: 'Sin cargo de envío. Se pide la dirección igual, para poder despacharlo.',
  },
};

export function envioModoDe(producto) {
  const m = producto?.envio_modo;
  return ENVIO_MODOS[m] ? m : 'cotizar';
}

// ¿Hay que mostrarle al comprador el paso donde elige cómo se envía?
// Solo cuando hay algo que elegir: con 'coordinar' e 'incluido' ya está
// decidido y ese paso sería una pregunta con una sola respuesta.
export function ofreceCotizacion(producto) {
  return envioModoDe(producto) === 'cotizar';
}
