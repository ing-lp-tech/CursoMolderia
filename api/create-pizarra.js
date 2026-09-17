// ─── SHIM DE COMPATIBILIDAD ──────────────────────────────────────────────────
// Este endpoint se generalizó a /api/create-producto durante la migración de
// `pizarras` a `productos`.
//
// Se mantiene vivo porque el navegador de un comprador puede tener la página
// cacheada de antes del deploy y postear acá: si devolviéramos 404, esa compra
// se perdería. `create-producto` acepta `pizarra_id` como alias de `producto_id`,
// así que alcanza con reenviarle el request tal cual.
//
// Se puede borrar cuando se borren las vistas de compatibilidad (script 09).
// ─────────────────────────────────────────────────────────────────────────────
export { default } from './create-producto.js';
