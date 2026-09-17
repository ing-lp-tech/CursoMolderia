import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { notificarNuevaVenta } from './_lib/notify.js';
import { setCors, bloquearSiOrigenInvalido } from './_lib/cors.js';

// Checkout de productos físicos (pizarras, plotters, PCs, accesorios).
// Generalización de create-pizarra.js, que quedó como shim de compatibilidad.

// Páginas desde las que se puede comprar. Se valida contra esta lista para
// que nadie pueda inyectar una URL de retorno arbitraria en MercadoPago.
const RETORNOS_VALIDOS = ['/pizarras', '/tienda'];

// El contacto se pide siempre: sin WhatsApp no hay forma de avisarle al
// comprador, ni de mandarle el código si compró créditos.
function validarContacto(c) {
  return c && typeof c === 'object'
    && c.nombre?.trim() && c.whatsapp?.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email?.trim() || '');
}

// La dirección solo se exige cuando hay algo que despachar.
function validarDireccion(c) {
  return !!(c.calle?.trim() && c.ciudad?.trim() && c.provincia?.trim() && c.codigo_postal?.trim());
}

function validarEnvio(e, metodoEnvio, exigeEnvio) {
  if (!exigeEnvio) return true;                      // producto que no se despacha
  if (!e || typeof e !== 'object' || !(Number(e.precio) >= 0)) return false;
  if (metodoEnvio === 'coordinar') return true;      // sin carrier/service: se coordina por WhatsApp
  return !!(e.carrier && e.service);
}

function validarSucursal(envio, sucursal, exigeEnvio) {
  if (!exigeEnvio || !envio?.requiere_sucursal) return true;
  return sucursal && typeof sucursal === 'object' && sucursal.codigo;
}

// Cuando hay plan, el precio sale del PLAN, no del producto: "Combo Taller"
// cobra $400.000 aunque la pizarra figure a $250.000.
function precioUnitarioDe(producto, plan) {
  return Number(plan ? plan.precio : producto.precio);
}

// Lo que ve el comprador en MercadoPago y lo que llega en la notificación.
function tituloVenta(producto, plan) {
  return plan ? `${producto.titulo} — ${plan.nombre}` : producto.titulo;
}

// Campos comunes a los dos métodos de pago. Tenerlos en un solo lugar evita
// que se desincronicen (el bug clásico de este endpoint cuando eran dos copias).
function filaCompra({ compraId, producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio }) {
  // Un plan sin envío (créditos de software) no tiene dirección: se guarda en
  // null en vez de inventar un placeholder que después ensucie las etiquetas.
  const direccion = exigeEnvio ? {
    direccion_calle:         comprador.calle.trim().slice(0, 200),
    direccion_numero:        comprador.numero?.trim().slice(0, 20) || null,
    direccion_piso_depto:    comprador.piso_depto?.trim().slice(0, 50) || null,
    direccion_ciudad:        comprador.ciudad.trim().slice(0, 100),
    direccion_provincia:     comprador.provincia.trim().slice(0, 100),
    direccion_codigo_postal: comprador.codigo_postal.trim().slice(0, 20),
    direccion_referencia:    comprador.referencia?.trim().slice(0, 200) || null,
  } : {
    direccion_calle:         null,
    direccion_numero:        null,
    direccion_piso_depto:    null,
    direccion_ciudad:        null,
    direccion_provincia:     null,
    direccion_codigo_postal: null,
    direccion_referencia:    null,
  };

  return {
    id:                      compraId,
    producto_id:             producto.id,
    titulo_producto:         producto.titulo,
    categoria_producto:      producto.producto_categorias?.nombre || null,
    cantidad,
    // Snapshots del plan: si mañana le cambian el precio desde el panel, la
    // venta de hoy tiene que seguir contando lo que realmente se cobró.
    plan_id:                 plan?.id || null,
    titulo_plan:             plan?.nombre || null,
    precio_base_plan:        plan ? Number(plan.precio) : null,
    nombre:                  comprador.nombre.trim().slice(0, 200),
    whatsapp:                comprador.whatsapp.trim().slice(0, 50),
    email:                   comprador.email.trim().slice(0, 254),
    ...direccion,
    metodo_envio:              exigeEnvio ? metodoEnvio : 'coordinar',
    envia_carrier:             exigeEnvio ? (envio.carrier || null) : null,
    envia_service:             exigeEnvio ? (envio.service || null) : null,
    envia_service_descripcion: exigeEnvio ? (envio.descripcion || null) : null,
    sucursal_codigo:           sucursal?.codigo || null,
    sucursal_nombre:           sucursal?.nombre || null,
    sucursal_direccion:        sucursal?.direccion || null,
    estado:                  'en_verificacion',
  };
}

async function crearConMercadoPago({ producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio, retorno, baseUrl, supabase }) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw Object.assign(new Error('Configuración del servidor incompleta'), { status: 500 });

  const precioUnitario = precioUnitarioDe(producto, plan);
  if (!precioUnitario || precioUnitario <= 0) throw Object.assign(new Error('Precio inválido'), { status: 400 });

  const precioProducto = precioUnitario * cantidad;
  const precioEnvio = exigeEnvio ? Number(envio.precio) : 0;
  const montoTotal = precioProducto + precioEnvio;
  const compraId = crypto.randomUUID();

  const { error: insertErr } = await supabase.from('producto_compras').insert({
    ...filaCompra({ compraId, producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio }),
    precio_base_producto:    precioUnitario,
    descuento_aplicado_pct:  0,
    monto_producto:          precioProducto,
    monto_envio:             precioEnvio,
    monto_cobrado:           montoTotal,
    metodo_pago:             'mercadopago',
  });
  if (insertErr) {
    console.error('[PRODUCTO_MP_ERROR] INSERT', insertErr.message);
    throw Object.assign(new Error('Error al registrar la compra'), { status: 500 });
  }

  await notificarNuevaVenta({
    nombre: comprador.nombre.trim(), titulo: tituloVenta(producto, plan), monto: montoTotal, metodo: 'mercadopago', baseUrl,
  });

  const sufijoRetorno = exigeEnvio ? '' : '&sin_envio=1';

  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  const preference = new Preference(client);

  const items = [{
    title: tituloVenta(producto, plan).replace(/[<>]/g, '').slice(0, 256),
    unit_price: precioUnitario,
    quantity: cantidad,
    currency_id: 'ARS',
  }];
  if (precioEnvio > 0) {
    items.push({
      title: `Envío (${envio.descripcion || envio.carrier})`,
      unit_price: precioEnvio,
      quantity: 1,
      currency_id: 'ARS',
    });
  }

  try {
    const response = await preference.create({
      body: {
        items,
        payer: { email: 'comprador@molderia-digital.com' },
        back_urls: {
          // Al volver de MercadoPago la página no puede leer la compra (anon no
          // tiene select sobre producto_compras), así que le avisamos por la URL
          // si hay envío o no: es lo único que cambia en el texto que ve.
          success: `${baseUrl}${retorno}?estado=verificacion&id=${compraId}${sufijoRetorno}`,
          pending: `${baseUrl}${retorno}?estado=verificacion&id=${compraId}${sufijoRetorno}`,
          failure: `${baseUrl}${retorno}?estado=fallo&id=${compraId}`,
        },
        auto_return: 'approved',
        payment_methods: { installments: 1 },
        external_reference: compraId,
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    return { init_point: response.init_point, compra_id: compraId };
  } catch (err) {
    console.error('[PRODUCTO_MP_ERROR] MP', err?.message || err);
    throw Object.assign(new Error('Error al procesar el pago. Intentá de nuevo.'), { status: 500 });
  }
}

async function crearPorTransferencia({ producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio, baseUrl, supabase }) {
  const precioUnitario = precioUnitarioDe(producto, plan);
  if (!precioUnitario || precioUnitario <= 0) throw Object.assign(new Error('Precio inválido'), { status: 400 });

  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'moldes_descuento_transferencia')
    .single();

  const descuento = settingRow?.value ? Math.max(0, Math.min(100, Number(settingRow.value))) : 0;
  const montoProducto = Math.round(precioUnitario * (1 - descuento / 100)) * cantidad;
  const precioEnvio = exigeEnvio ? Number(envio.precio) : 0;
  const montoTotal = montoProducto + precioEnvio;

  const compraId = crypto.randomUUID();

  const { error: insertErr } = await supabase.from('producto_compras').insert({
    ...filaCompra({ compraId, producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio }),
    precio_base_producto:    precioUnitario,
    descuento_aplicado_pct:  descuento,
    monto_producto:          montoProducto,
    monto_envio:             precioEnvio,
    monto_cobrado:           montoTotal,
    metodo_pago:             'transferencia',
  });

  if (insertErr) {
    console.error('[PRODUCTO_TRANSFER_INSERT]', insertErr.message);
    throw Object.assign(new Error('Error al registrar la compra'), { status: 500 });
  }

  await notificarNuevaVenta({
    nombre: comprador.nombre.trim(), titulo: tituloVenta(producto, plan), monto: montoTotal, metodo: 'transferencia', baseUrl,
  });

  return { compra_id: compraId, monto: montoTotal };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (bloquearSiOrigenInvalido(req, res)) return;

  const { comprador, envio, metodo, sucursal } = req.body || {};

  // `pizarra_id` es el nombre viejo del campo: lo sigue mandando cualquier
  // navegador que tenga la página cacheada de antes de la migración.
  const productoId = req.body?.producto_id || req.body?.pizarra_id;

  // Compatibilidad hacia atrás: si el cliente no manda metodo_envio (página
  // vieja), el único método que existía era "envia", así que lo asumimos en
  // vez de rechazar la compra.
  const metodoEnvioBody = req.body?.metodo_envio;
  const metodoEnvio = (metodoEnvioBody === 'envia' || metodoEnvioBody === 'coordinar') ? metodoEnvioBody : 'envia';

  const retorno = RETORNOS_VALIDOS.includes(req.body?.retorno) ? req.body.retorno : '/pizarras';

  // Tope duro del endpoint. El rango real lo pone cada plan (cantidad_min /
  // cantidad_max) y se valida más abajo, cuando ya sabemos cuál eligió.
  const cantidad = Math.trunc(Number(req.body?.cantidad ?? 1));
  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100) {
    return res.status(400).json({ error: 'Cantidad inválida' });
  }

  const planId = typeof req.body?.plan_id === 'string' ? req.body.plan_id : null;

  if (!productoId || typeof productoId !== 'string') {
    return res.status(400).json({ error: 'producto_id inválido' });
  }
  if (metodo !== 'mercadopago' && metodo !== 'transferencia') {
    return res.status(400).json({ error: 'metodo inválido' });
  }
  if (!validarContacto(comprador)) {
    return res.status(400).json({ error: 'Datos del comprador incompletos o inválidos' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let producto;
  try {
    const { data, error: productoErr } = await supabase
      .from('productos')
      .select('id, titulo, precio, activo, eliminado_en, stock, requiere_envio, producto_categorias(nombre)')
      .eq('id', productoId)
      .single();
    if (productoErr || !data) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!data.activo || data.eliminado_en) return res.status(400).json({ error: 'Producto no disponible' });
    producto = data;
  } catch (err) {
    console.error('[PRODUCTO_ERROR] QUERY', err?.message || err);
    return res.status(500).json({ error: 'Error al buscar el producto' });
  }

  // El plan es opcional: un plotter se compra sin plan y el precio sale del
  // producto, igual que hasta ahora.
  let plan = null;
  if (planId) {
    const { data, error: planErr } = await supabase
      .from('producto_planes')
      .select('id, producto_id, nombre, precio, requiere_envio, otorga_creditos, cantidad_min, cantidad_max, activo, eliminado_en')
      .eq('id', planId)
      .single();

    if (planErr || !data) return res.status(404).json({ error: 'Plan no encontrado' });
    // Sin esta comprobación se podría pagar el plan más barato de un producto
    // y llevarse otro: el plan tiene que ser de ESTE producto.
    if (data.producto_id !== producto.id) return res.status(400).json({ error: 'El plan no corresponde a este producto' });
    if (!data.activo || data.eliminado_en) return res.status(400).json({ error: 'Plan no disponible' });
    if (cantidad < data.cantidad_min || cantidad > data.cantidad_max) {
      return res.status(400).json({
        error: data.cantidad_min === data.cantidad_max
          ? 'Cantidad inválida para este plan'
          : `Elegí entre ${data.cantidad_min} y ${data.cantidad_max} unidades`,
      });
    }
    plan = data;
  }

  // requiere_envio = false → licencias, créditos de software y demás cosas
  // que no se despachan: no se pide dirección, ni carrier, ni se cobra envío.
  // Manda el plan cuando hay plan: el producto puede ser físico y el plan no
  // (la pizarra existe, "Solo Software" no se despacha).
  const exigeEnvio = plan ? plan.requiere_envio !== false : producto.requiere_envio !== false;

  // Lo que no se despacha no sale del depósito: 3 créditos de software no son
  // 3 pizarras, así que el stock solo se controla si hay algo que mandar.
  if (exigeEnvio && producto.stock < cantidad) {
    return res.status(400).json({
      error: cantidad > 1 ? `Solo quedan ${producto.stock} unidades disponibles` : 'Sin stock disponible',
    });
  }

  if (exigeEnvio && !validarDireccion(comprador)) {
    return res.status(400).json({ error: 'Faltan datos de la dirección de envío' });
  }
  if (!validarEnvio(envio, metodoEnvio, exigeEnvio)) {
    return res.status(400).json({ error: 'Debés elegir una opción de envío' });
  }
  if (!validarSucursal(envio, sucursal, exigeEnvio)) {
    return res.status(400).json({ error: 'Debés elegir una sucursal de destino' });
  }

  const host = req.headers.host || 'curso-molderia.vercel.app';
  const baseUrl = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;

  try {
    const args = { producto, plan, comprador, envio, sucursal, metodoEnvio, cantidad, exigeEnvio, retorno, baseUrl, supabase };
    const resultado = metodo === 'mercadopago'
      ? await crearConMercadoPago(args)
      : await crearPorTransferencia(args);
    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Error al registrar la compra' });
  }
}
