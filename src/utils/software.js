// El link al software de digitalización, armado con lo que se configuró en
// /admin/configuracion.
//
// Si la dirección trae `{codigo}`, se reemplaza por el código del cliente: así
// el software lo recibe ya cargado y nadie tiene que copiar y pegar. Sin el
// marcador, la dirección se usa tal cual.
//
// Devuelve null si todavía no hay dirección (no hay hosting): quien llama
// muestra un aviso en vez de un botón que no lleva a ningún lado.
export function urlSoftware(base, codigo = '') {
  const url = (base || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url.replaceAll('{codigo}', encodeURIComponent(codigo || ''));
}

// Link a /software para seguir una compra. Lo usan la pantalla post-compra y el
// WhatsApp de aprobación del panel.
export function linkSeguimiento(compraId, origen = window.location.origin) {
  return `${origen}/software?compra=${compraId}`;
}
