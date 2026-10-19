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

// Códigos elegidos a mano (demos). La misma regla que la constraint del
// script 14 y que /api/digitalizacion: 4 a 32 caracteres, mayúsculas, números
// y guiones, sin guion en las puntas.
export const CODIGO_RE = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;

// Lo que se escribe a mano pasa a la forma válida mientras se tipea:
// mayúsculas, sin acentos, espacios a guiones, y nada fuera del alfabeto.
export function normalizarCodigo(texto) {
  return (texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 32);
}

// Link a /software para seguir una compra. Lo usan la pantalla post-compra y el
// WhatsApp de aprobación del panel.
export function linkSeguimiento(compraId, origen = window.location.origin) {
  return `${origen}/software?compra=${compraId}`;
}
