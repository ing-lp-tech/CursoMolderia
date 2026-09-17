// ─── SHIM DE COMPATIBILIDAD ──────────────────────────────────────────────────
// Este endpoint se generalizó a /api/producto-admin durante la migración de
// `pizarras_compras` a `producto_compras`.
//
// Se mantiene vivo por si el panel quedó abierto en una pestaña con el código
// anterior: aprobar una venta desde ahí sigue funcionando.
//
// Se puede borrar cuando se borren las vistas de compatibilidad (script 09).
// ─────────────────────────────────────────────────────────────────────────────
export { default } from './producto-admin.js';
