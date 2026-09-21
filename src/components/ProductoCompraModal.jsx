import { useState } from 'react';
import { PROVINCIAS_ARGENTINA } from '../utils/provinciasArgentina';
import { imgUrl, productoImages } from '../utils/imagenesProducto';
import SelectorCreditos from './SelectorCreditos';

// Modal de compra de un producto: detalle → plan → datos → envío → pago.
//
// Vive acá y no dentro de una página porque lo usan /pizarras y /tienda. Es el
// código que mueve la plata de verdad, así que se movió tal cual estaba en
// PizarrasPage: mismos pasos, mismos textos, mismas validaciones. Lo único que
// cambió es el nombre del componente y que el producto entra por prop.
//
// La variable interna se sigue llamando `pizarra` a propósito: renombrarla en
// las 600 líneas del formulario era la forma más fácil de romper algo probado.

// ── Image carousel ──────────────────────────────────────────────────────────
function Carousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images?.length) return (
    <div className="w-full aspect-[4/3] bg-surface-variant rounded-2xl flex items-center justify-center">
      <span className="material-symbols-outlined text-4xl text-outline-variant">draw</span>
    </div>
  );
  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-surface-variant select-none">
      <img src={imgUrl(images[idx])} alt="" className="w-full h-full object-contain" />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Form state ───────────────────────────────────────────────────────────────
const FORM_EMPTY = {
  nombre: '', whatsapp: '', email: '',
  calle: '', numero: '', piso_depto: '',
  ciudad: '', provincia: '', codigo_postal: '', referencia: '',
};

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeWhatsapp(raw) {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 13 && d.startsWith('549')) return d;
  if (d.length === 12 && d.startsWith('54'))  return '549' + d.slice(2);
  if (d.length === 11 && d.startsWith('0'))   return '549' + d.slice(1);
  if (d.length === 10)                        return '549' + d;
  return d;
}

// ── Post-purchase screen ─────────────────────────────────────────────────────
// `producto` es el título, y puede venir vacío: al volver de MercadoPago la
// página solo tiene el id de la compra en la URL, no el producto. Por eso el
// mensaje cae a "mi compra" en vez de nombrar algo equivocado.
export function PantallaVerificacion({ metodo, metodoEnvio, monto, compraId, direccion, settings, producto = null, sinEnvio = false, onClose }) {
  const wa = settings.moldes_whatsapp_comprobante?.replace(/\D/g, '');

  const direccionTexto = direccion
    ? `${direccion.calle} ${direccion.numero || ''}${direccion.piso_depto ? ', ' + direccion.piso_depto : ''}, ${direccion.ciudad}, ${direccion.provincia} (CP ${direccion.codigo_postal})${direccion.referencia ? ' — Ref: ' + direccion.referencia : ''}`
    : '';

  const queCompro = producto ? `"${producto}"` : 'mi compra';

  const lineaBase = metodo === 'mercadopago'
    ? `Hola! Ya pagué con MercadoPago ${queCompro} (código #${compraId?.slice(0, 8) ?? ''}).`
    : `Hola! Acabo de realizar la compra de ${queCompro} (#${compraId?.slice(0, 8) ?? ''}). Adjunto mi comprobante de pago por $${monto?.toLocaleString('es-AR') ?? ''}.`;

  const lineaCierre = sinEnvio
    ? ` Te aviso para que apruebes mi compra y me pases el código de digitalización. ¡Gracias!`
    : metodoEnvio === 'coordinar'
      ? `\n\nQuedó pendiente coordinar el envío directamente con vos. Mis datos de entrega:\n👤 ${direccion?.nombre || ''}\n📍 ${direccionTexto}`
      : ` Te aviso para que apruebes mi compra y coordinemos el envío. ¡Gracias!`;

  const texto = encodeURIComponent(lineaBase + lineaCierre);
  const waLink = wa ? `https://wa.me/${wa}?text=${texto}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface-container rounded-3xl shadow-2xl max-w-md w-full p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl text-primary">hourglass_top</span>
        </div>
        <div>
          <h2 className="font-headline font-black text-2xl text-primary mb-2">¡Compra registrada!</h2>
          <p className="text-on-surface-variant text-sm">
            {sinEnvio
              ? <>Tu compra está <strong className="text-on-surface">en verificación</strong>. Una vez que confirmemos tu pago, te mandamos por WhatsApp tu <strong className="text-on-surface">código de digitalización</strong>.</>
              : metodoEnvio === 'coordinar'
                ? <>Tu pedido está <strong className="text-on-surface">en verificación</strong>. Una vez que confirmemos tu pago, nos vamos a comunicar por WhatsApp para coordinar el envío.</>
                : <>Tu pedido está <strong className="text-on-surface">en verificación</strong>. Una vez que confirmemos tu pago, generamos el envío y te pasamos el código de seguimiento.</>
            }
          </p>
        </div>

        {metodo === 'transferencia' && (
          <div className="bg-secondary/10 rounded-2xl p-4 text-left space-y-2 text-sm">
            <p className="font-bold text-on-surface uppercase tracking-wide text-xs mb-3">Datos para transferir</p>
            {settings.moldes_titular && <p><span className="text-on-surface-variant">Titular:</span> <strong>{settings.moldes_titular}</strong></p>}
            {settings.moldes_banco && <p><span className="text-on-surface-variant">Banco:</span> <strong>{settings.moldes_banco}</strong></p>}
            {settings.moldes_cbu && <p><span className="text-on-surface-variant">CBU:</span> <strong className="font-mono">{settings.moldes_cbu}</strong></p>}
            {settings.moldes_alias && <p><span className="text-on-surface-variant">Alias:</span> <strong>{settings.moldes_alias}</strong></p>}
            {monto != null && <p className="pt-1"><span className="text-on-surface-variant">Monto:</span> <strong className="text-primary text-base">${monto.toLocaleString('es-AR')}</strong></p>}
          </div>
        )}

        {metodo === 'mercadopago' && (
          <p className="text-sm text-on-surface-variant">
            Pagaste con MercadoPago. Una vez que verifiquemos tu pago, coordinamos el envío.
          </p>
        )}

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-2xl px-5 py-4 font-headline font-black text-base uppercase tracking-wide text-white bg-[#25D366] hover:bg-[#1EBE5A] shadow-lg shadow-[#25D366]/30 ring-4 ring-[#25D366]/20 transition-all"
          >
            <span className="material-symbols-outlined text-2xl">chat</span>
            Avisar por WhatsApp ahora
          </a>
        )}
        {waLink && (
          <p className="text-xs text-on-surface-variant -mt-3">
            👆 Este paso es clave: nos llega tu aviso al instante y aprobamos más rápido.
          </p>
        )}

        <button onClick={onClose} className="btn-secondary w-full">Volver al catálogo</button>
      </div>
    </div>
  );
}

// ── Detail / purchase modal ──────────────────────────────────────────────────
export default function ProductoCompraModal({
  producto: pizarra,
  planes = [],
  planInicial = null,
  settings,
  // A dónde vuelve el comprador desde MercadoPago. El endpoint solo acepta
  // rutas de una lista blanca, así que no se puede inyectar cualquier cosa.
  retorno = '/pizarras',
  onClose,
}) {
  // Si entró por una card de plan, ya arranca en el paso de planes con el suyo
  // marcado: no lo mandamos de vuelta al detalle que acaba de leer.
  const [step, setStep] = useState(planInicial ? 'planes' : 'detalle'); // detalle | planes | form | metodo_envio | envio | pago | verificacion
  const [plan, setPlan] = useState(planInicial);
  const [cantidad, setCantidad] = useState(planInicial?.cantidad_min || 1);
  const [form, setForm] = useState(FORM_EMPTY);
  const [metodo, setMetodo] = useState('mercadopago');
  const [metodoEnvio, setMetodoEnvio] = useState(null); // 'envia' | 'coordinar'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compraId, setCompraId] = useState(null);
  const [montoFinal, setMontoFinal] = useState(null);
  const [waHint, setWaHint] = useState('');

  const [opcionesEnvio, setOpcionesEnvio] = useState([]);
  const [envioElegido, setEnvioElegido] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalElegida, setSucursalElegida] = useState(null);
  const [cargandoSucursales, setCargandoSucursales] = useState(false);

  const descuento = Number(settings.moldes_descuento_transferencia) || 0;

  // Con plan elegido manda el precio del plan: "Combo Taller" cobra $400.000
  // aunque el producto figure a $250.000. Sin planes cargados, el precio sigue
  // saliendo del producto, exactamente como antes.
  const precioUnitario = Number(plan ? plan.precio : pizarra.precio);
  const precioMP = precioUnitario * cantidad;
  // El redondeo va sobre el precio unitario, igual que en el endpoint: si se
  // redondeara el total, el panel y el checkout mostrarían números distintos.
  const precioTransfer = Math.round(precioUnitario * (1 - descuento / 100)) * cantidad;
  const precioBaseElegido = metodo === 'mercadopago' ? precioMP : precioTransfer;
  const totalConEnvio = precioBaseElegido + (envioElegido?.precio || 0);

  // Un plan de solo software no se despacha: ni dirección, ni cotización, ni
  // costo de envío.
  const exigeEnvio = plan ? plan.requiere_envio !== false : true;
  const precioPlanMin = planes.length ? Math.min(...planes.map(pl => Number(pl.precio))) : null;

  function elegirPlan(pl) {
    setPlan(pl);
    setCantidad(pl.cantidad_min || 1);
    // Cambiar de plan puede cambiar si hay envío o no: la cotización vieja ya
    // no sirve.
    setMetodoEnvio(null);
    setEnvioElegido(null);
    setOpcionesEnvio([]);
    setSucursales([]);
    setSucursalElegida(null);
    setError('');
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'whatsapp') setWaHint('');
  }

  function handleWhatsappBlur() {
    const norm = normalizeWhatsapp(form.whatsapp);
    if (norm.length >= 11) setWaHint('+' + norm);
  }

  function formValid() {
    const contactoOk = form.nombre.trim()
      && normalizeWhatsapp(form.whatsapp).length >= 10
      && emailValido(form.email);
    if (!exigeEnvio) return !!contactoOk;
    return !!(contactoOk && form.calle.trim() && form.ciudad.trim() && form.provincia && form.codigo_postal.trim());
  }

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  function elegirCoordinarPorWhatsapp() {
    setMetodoEnvio('coordinar');
    setEnvioElegido({ carrier: null, service: null, descripcion: 'Coordinar por WhatsApp', precio: 0, requiere_sucursal: false });
    setSucursalElegida(null);
    setError('');
    setStep('pago');
  }

  async function handleCotizarEnvio() {
    setMetodoEnvio('envia');
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/envia-cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: pizarra.id,
          destino: {
            nombre: form.nombre.trim(),
            whatsapp: normalizeWhatsapp(form.whatsapp) || form.whatsapp.trim(),
            email: form.email.trim(),
            calle: form.calle.trim(),
            numero: form.numero.trim(),
            piso_depto: form.piso_depto.trim(),
            ciudad: form.ciudad.trim(),
            provincia: form.provincia,
            codigo_postal: form.codigo_postal.trim(),
            referencia: form.referencia.trim(),
          },
        }),
      });
      const data = await safeJson(r);
      if (!r.ok || !data) throw new Error(data?.error || `Error del servidor (${r.status})`);
      setOpcionesEnvio(data.opciones);
      setStep('envio');
      if (data.opciones[0]) await elegirEnvio(data.opciones[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function elegirEnvio(op) {
    setEnvioElegido(op);
    setSucursalElegida(null);
    setSucursales([]);
    if (!op.requiere_sucursal) return;

    setCargandoSucursales(true);
    setError('');
    try {
      const r = await fetch('/api/envia-cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'sucursales',
          carrier: op.carrier,
          codigo_postal: form.codigo_postal.trim(),
          provincia: form.provincia,
        }),
      });
      const data = await safeJson(r);
      if (!r.ok || !data) throw new Error(data?.error || `Error del servidor (${r.status})`);
      setSucursales(data.sucursales);
      setSucursalElegida(data.sucursales[0] || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoSucursales(false);
    }
  }

  async function handleComprar() {
    if (exigeEnvio && !envioElegido) { setError('Elegí una opción de envío'); return; }
    setLoading(true);
    setError('');
    const comprador = {
      nombre:        form.nombre.trim(),
      whatsapp:      normalizeWhatsapp(form.whatsapp) || form.whatsapp.trim(),
      email:         form.email.trim(),
      calle:         form.calle.trim(),
      numero:        form.numero.trim(),
      piso_depto:    form.piso_depto.trim(),
      ciudad:        form.ciudad.trim(),
      provincia:     form.provincia,
      codigo_postal: form.codigo_postal.trim(),
      referencia:    form.referencia.trim(),
    };
    const envio = exigeEnvio ? {
      carrier: envioElegido.carrier,
      service: envioElegido.service,
      descripcion: envioElegido.descripcion,
      precio: envioElegido.precio,
      requiere_sucursal: envioElegido.requiere_sucursal,
    } : { precio: 0 };
    try {
      const r = await fetch('/api/create-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: pizarra.id,
          plan_id: plan?.id || null,
          cantidad,
          comprador, envio, metodo,
          metodo_envio: metodoEnvio,
          sucursal: sucursalElegida,
          retorno,
        }),
      });
      const data = await safeJson(r);
      if (!r.ok || !data) throw new Error(data?.error || `Error del servidor (${r.status})`);
      setCompraId(data.compra_id);
      if (metodo === 'mercadopago') {
        setMontoFinal(totalConEnvio);
        window.location.href = data.init_point;
      } else {
        setMontoFinal(data.monto);
        setStep('verificacion');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'verificacion') {
    return (
      <PantallaVerificacion
        metodo={metodo}
        metodoEnvio={metodoEnvio}
        producto={pizarra.titulo}
        sinEnvio={!exigeEnvio}
        monto={montoFinal}
        compraId={compraId}
        direccion={exigeEnvio ? {
          nombre: form.nombre.trim(),
          calle: form.calle.trim(),
          numero: form.numero.trim(),
          piso_depto: form.piso_depto.trim(),
          ciudad: form.ciudad.trim(),
          provincia: form.provincia,
          codigo_postal: form.codigo_postal.trim(),
          referencia: form.referencia.trim(),
        } : null}
        settings={settings}
        onClose={onClose}
      />
    );
  }

  const TITULOS = {
    detalle: pizarra.titulo,
    planes: 'Elegí tu plan',
    form: exigeEnvio ? 'Dirección de envío' : 'Tus datos',
    metodo_envio: 'Método de envío',
    envio: 'Elegí el envío',
    pago: 'Método de pago',
  };

  // Un solo lugar decide el camino de vuelta: los pasos que se saltean para
  // adelante también se saltean para atrás.
  function pasoAnterior() {
    if (step === 'pago') {
      if (!exigeEnvio) return 'form';
      return metodoEnvio === 'coordinar' ? 'metodo_envio' : 'envio';
    }
    if (step === 'envio') return 'metodo_envio';
    if (step === 'metodo_envio') return 'form';
    if (step === 'form') return planes.length ? 'planes' : 'detalle';
    return 'detalle';
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 sticky top-0 bg-surface-container z-10">
          {step !== 'detalle' && (
            <button
              onClick={() => setStep(pasoAnterior())}
              className="text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <h2 className="font-headline font-black text-lg text-on-surface flex-1 truncate">{TITULOS[step]}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface ml-2">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {/* STEP: Detalle */}
          {step === 'detalle' && (
            <>
              <Carousel images={productoImages(pizarra)} />
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-headline font-black text-xl text-on-surface">{pizarra.titulo}</h3>
                  <div className="text-right shrink-0">
                    {precioPlanMin != null && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">desde</p>
                    )}
                    <p className="font-black text-primary text-xl">${(precioPlanMin ?? Number(pizarra.precio)).toLocaleString('es-AR')}</p>
                    {descuento > 0 && (
                      <p className="text-xs text-secondary font-bold">{descuento}% off con transferencia</p>
                    )}
                  </div>
                </div>
                {pizarra.descripcion && (
                  <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{pizarra.descripcion}</p>
                )}
              </div>
              {pizarra.especificaciones && (
                <ul className="space-y-1.5">
                  {pizarra.especificaciones.split('\n').filter(Boolean).map((linea, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">check_circle</span>
                      {linea}
                    </li>
                  ))}
                </ul>
              )}
              {/* Un producto que no se despacha (créditos de software) no tiene
                  por qué prometer un envío que nunca va a ocurrir. */}
              {pizarra.requiere_envio !== false && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-variant/50 rounded-xl p-3">
                  <span className="material-symbols-outlined text-base">local_shipping</span>
                  Envío a todo el país con envia.com. El costo se calcula según tu dirección.
                </div>
              )}
              {planes.length > 0 ? (
                <button onClick={() => setStep('planes')} className="btn-primary w-full">Ver planes y comprar</button>
              ) : pizarra.stock > 0 ? (
                <button onClick={() => setStep('form')} className="btn-primary w-full">Comprar {pizarra.titulo}</button>
              ) : (
                <button disabled className="btn-primary w-full opacity-50 cursor-not-allowed">Sin stock por el momento</button>
              )}
            </>
          )}

          {/* STEP: Planes */}
          {step === 'planes' && (
            <>
              <p className="text-sm text-on-surface-variant">
                Elegí con qué plan querés arrancar. Lo podés cambiar hasta el momento de pagar.
              </p>

              <div className="space-y-3">
                {planes.map(pl => {
                  // Un plan que se despacha necesita stock; los créditos de
                  // software se pueden vender siempre.
                  const sinStock = pl.requiere_envio !== false && !(pizarra.stock > 0);
                  const elegido = plan?.id === pl.id;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => elegirPlan(pl)}
                      disabled={sinStock}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        elegido ? 'border-primary bg-primary/10' : 'border-outline-variant/40 hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-headline font-black text-on-surface">{pl.nombre}</p>
                            {pl.destacado && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/20 text-secondary rounded-full px-2 py-0.5">
                                Más elegido
                              </span>
                            )}
                          </div>
                          {pl.descripcion && (
                            <p className="text-xs text-on-surface-variant mt-0.5">{pl.descripcion}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-primary">${Number(pl.precio).toLocaleString('es-AR')}</p>
                          {pl.precio_sufijo && (
                            <p className="text-[10px] text-on-surface-variant">{pl.precio_sufijo}</p>
                          )}
                        </div>
                      </div>

                      {pl.incluye && (
                        <ul className="mt-3 space-y-1">
                          {pl.incluye.split('\n').filter(Boolean).map((linea, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                              <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">check_circle</span>
                              {linea}
                            </li>
                          ))}
                        </ul>
                      )}

                      {sinStock && (
                        <p className="text-xs text-error mt-2 font-bold">Sin stock por el momento</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {plan && plan.cantidad_max > plan.cantidad_min && (
                <SelectorCreditos
                  cantidad={cantidad}
                  min={plan.cantidad_min}
                  max={plan.cantidad_max}
                  precioUnitario={plan.precio}
                  onChange={setCantidad}
                />
              )}

              {plan && plan.requiere_envio === false && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-variant/50 rounded-xl p-3">
                  <span className="material-symbols-outlined text-base">chat</span>
                  Sin envío: recibís tu código por WhatsApp apenas confirmemos el pago.
                </div>
              )}

              <button
                onClick={() => setStep('form')}
                disabled={!plan}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </>
          )}

          {/* STEP: Form (datos + dirección) */}
          {step === 'form' && (
            <>
              <p className="text-sm text-on-surface-variant">
                {exigeEnvio
                  ? 'Necesitamos tus datos y tu dirección para cotizar el envío.'
                  : 'Solo necesitamos tus datos de contacto: a este WhatsApp te mandamos el código.'}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Nombre completo *</label>
                  <input name="nombre" value={form.nombre} onChange={handleFormChange} className="input-field w-full" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">WhatsApp *</label>
                  <input
                    name="whatsapp" value={form.whatsapp} onChange={handleFormChange} onBlur={handleWhatsappBlur}
                    className="input-field w-full" placeholder="Ej: 1162020911" type="tel"
                  />
                  {waHint && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Se va a usar: {waHint}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Email *</label>
                  <input name="email" value={form.email} onChange={handleFormChange} className="input-field w-full" placeholder="tu@email.com" type="email" />
                  {exigeEnvio && (
                    <p className="text-xs text-on-surface-variant mt-1">Lo necesita el correo para avisarte cuando el paquete llegue a la sucursal.</p>
                  )}
                </div>
                {exigeEnvio && (<>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Calle *</label>
                    <input name="calle" value={form.calle} onChange={handleFormChange} className="input-field w-full" placeholder="Av. Siempre Viva" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Número</label>
                    <input name="numero" value={form.numero} onChange={handleFormChange} className="input-field w-full" placeholder="742" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Piso / Depto (opcional)</label>
                  <input name="piso_depto" value={form.piso_depto} onChange={handleFormChange} className="input-field w-full" placeholder="Piso 3, depto B" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Ciudad *</label>
                    <input name="ciudad" value={form.ciudad} onChange={handleFormChange} className="input-field w-full" placeholder="Ciudad" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Código postal *</label>
                    <input name="codigo_postal" value={form.codigo_postal} onChange={handleFormChange} className="input-field w-full" placeholder="1414" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Provincia *</label>
                  <select name="provincia" value={form.provincia} onChange={handleFormChange} className="input-field w-full">
                    <option value="">Elegí tu provincia</option>
                    {PROVINCIAS_ARGENTINA.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Referencia (opcional)</label>
                  <input name="referencia" value={form.referencia} onChange={handleFormChange} className="input-field w-full" placeholder="Entre calles, color de casa, etc." />
                </div>
                </>)}
              </div>

              {error && (
                <p className="text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>{error}
                </p>
              )}

              <button
                onClick={() => setStep(exigeEnvio ? 'metodo_envio' : 'pago')}
                disabled={!formValid()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-xl">arrow_forward</span>Continuar
              </button>
            </>
          )}

          {/* STEP: Método de envío */}
          {step === 'metodo_envio' && (
            <>
              <p className="text-sm text-on-surface-variant">Elegí cómo se coordina el envío de tu pedido.</p>

              <div className="space-y-3">
                <button
                  onClick={handleCotizarEnvio}
                  disabled={loading}
                  className="w-full rounded-2xl border-2 border-outline-variant/40 hover:border-primary/60 p-4 text-left transition-all disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-2xl text-primary shrink-0">local_shipping</span>
                    <div>
                      <p className="font-bold text-on-surface text-sm">
                        {loading ? 'Cotizando envío...' : 'Envío automático (cotización online)'}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Elegís la paquetería y el precio del envío se calcula al instante según tu dirección.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={elegirCoordinarPorWhatsapp}
                  disabled={loading}
                  className="w-full rounded-2xl border-2 border-outline-variant/40 hover:border-secondary/60 p-4 text-left transition-all disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-2xl text-secondary shrink-0">chat</span>
                    <div>
                      <p className="font-bold text-on-surface text-sm">Coordinar por WhatsApp con el vendedor</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Ideal si tu dirección es de difícil acceso o las calles no están bien señalizadas. Coordinamos el envío directamente por WhatsApp, sin costo calculado ahora.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {error && (
                <p className="text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>{error}
                </p>
              )}
            </>
          )}

          {/* STEP: Envío */}
          {step === 'envio' && (
            <>
              <p className="text-sm text-on-surface-variant">Elegí la opción de envío para tu dirección.</p>
              <div className="space-y-2">
                {opcionesEnvio.map(op => (
                  <button
                    key={`${op.carrier}-${op.service}`}
                    onClick={() => elegirEnvio(op)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                      envioElegido?.service === op.service && envioElegido?.carrier === op.carrier
                        ? 'border-primary bg-primary/10' : 'border-outline-variant/40 hover:border-outline-variant'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-on-surface text-sm capitalize">{op.carrier} — {op.descripcion}</p>
                        {op.entrega_estimada && <p className="text-xs text-on-surface-variant">Llega en {op.entrega_estimada}</p>}
                      </div>
                      <p className="font-black text-primary shrink-0">${op.precio.toLocaleString('es-AR')}</p>
                    </div>
                  </button>
                ))}
              </div>

              {envioElegido?.requiere_sucursal && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-on-surface uppercase tracking-wide">Elegí la sucursal de retiro</p>
                  {cargandoSucursales ? (
                    <div className="flex justify-center py-6">
                      <span className="material-symbols-outlined text-primary text-2xl animate-spin">refresh</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {sucursales.map(s => (
                        <button
                          key={s.codigo}
                          onClick={() => setSucursalElegida(s)}
                          className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                            sucursalElegida?.codigo === s.codigo
                              ? 'border-primary bg-primary/10' : 'border-outline-variant/40 hover:border-outline-variant'
                          }`}
                        >
                          <p className="font-bold text-sm text-on-surface">{s.nombre}</p>
                          {s.direccion && <p className="text-xs text-on-surface-variant">{s.direccion}</p>}
                        </button>
                      ))}
                      {!sucursales.length && (
                        <p className="text-sm text-error">No se encontraron sucursales para esta dirección.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-surface-variant/50 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">Total (producto + envío)</span>
                <span className="font-headline font-black text-primary text-lg">${totalConEnvio.toLocaleString('es-AR')}</span>
              </div>

              {error && (
                <p className="text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>{error}
                </p>
              )}

              <button
                onClick={() => setStep('pago')}
                disabled={!envioElegido || (envioElegido.requiere_sucursal && !sucursalElegida)}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar con el pago
              </button>
            </>
          )}

          {/* STEP: Pago */}
          {step === 'pago' && (
            <>
              <div className="bg-surface-variant/50 rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Comprando</p>
                <p className="font-headline font-black text-on-surface">{pizarra.titulo}</p>
                {plan && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Plan: {plan.nombre}{cantidad > 1 ? ` — ${cantidad} créditos` : ''}
                  </p>
                )}
                <p className="text-xs text-on-surface-variant mt-1">
                  {!exigeEnvio
                    ? 'Sin envío: el código llega por WhatsApp'
                    : metodoEnvio === 'coordinar'
                      ? 'Envío: a coordinar por WhatsApp'
                      : `Envío: ${envioElegido?.carrier} — ${envioElegido?.descripcion} ($${envioElegido?.precio.toLocaleString('es-AR')})`
                  }
                </p>
                {sucursalElegida && (
                  <p className="text-xs text-on-surface-variant mt-1">Retiro en: {sucursalElegida.nombre}</p>
                )}
              </div>

              <p className="text-sm font-bold text-on-surface uppercase tracking-wide">Elegí cómo pagar</p>

              <div className="space-y-3">
                {/* MercadoPago */}
                <button
                  onClick={() => setMetodo('mercadopago')}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${metodo === 'mercadopago' ? 'border-primary bg-primary/10' : 'border-outline-variant/40 hover:border-outline-variant'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl text-primary">payment</span>
                      <div>
                        <p className="font-bold text-on-surface text-sm">MercadoPago</p>
                        <p className="text-xs text-on-surface-variant">Tarjeta, débito o dinero en cuenta</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary">${(precioMP + (envioElegido?.precio || 0)).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </button>

                {/* Transferencia */}
                <button
                  onClick={() => setMetodo('transferencia')}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${metodo === 'transferencia' ? 'border-secondary bg-secondary/10' : 'border-outline-variant/40 hover:border-outline-variant'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl text-secondary">account_balance</span>
                      <div>
                        <p className="font-bold text-on-surface text-sm">Transferencia bancaria</p>
                        {descuento > 0 && <p className="text-xs text-secondary font-bold">{descuento}% de descuento en el producto</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {descuento > 0 && <p className="text-xs line-through text-on-surface-variant">${(precioMP + (envioElegido?.precio || 0)).toLocaleString('es-AR')}</p>}
                      <p className="font-black text-secondary">${(precioTransfer + (envioElegido?.precio || 0)).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                  {metodo === 'transferencia' && (
                    <div className="mt-3 text-xs text-on-surface-variant space-y-1">
                      {settings.moldes_titular && <p><span className="font-bold">Titular:</span> {settings.moldes_titular}</p>}
                      {settings.moldes_banco && <p><span className="font-bold">Banco:</span> {settings.moldes_banco}</p>}
                      {settings.moldes_cbu && <p><span className="font-bold">CBU:</span> <span className="font-mono">{settings.moldes_cbu}</span></p>}
                      {settings.moldes_alias && <p><span className="font-bold">Alias:</span> {settings.moldes_alias}</p>}
                      <p className="mt-2 flex items-start gap-1">
                        <span className="material-symbols-outlined text-base text-secondary shrink-0 mt-0.5">info</span>
                        Después de registrar la compra, envianos el comprobante por WhatsApp.
                      </p>
                    </div>
                  )}
                </button>
              </div>

              <div className="rounded-2xl border-2 border-[#25D366]/40 bg-[#25D366]/10 p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-2xl text-[#25D366] shrink-0">chat</span>
                <div>
                  <p className="font-headline font-black text-sm text-on-surface">¡Importante!</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Al terminar te va a aparecer un botón para avisarnos por WhatsApp con un solo clic, así aprobamos y generamos tu envío más rápido.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>{error}
                </p>
              )}

              <button
                onClick={handleComprar}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? <><span className="material-symbols-outlined animate-spin text-xl">refresh</span>Procesando...</>
                  : metodo === 'mercadopago'
                    ? <><span className="material-symbols-outlined text-xl">payment</span>Pagar con MercadoPago</>
                    : <><span className="material-symbols-outlined text-xl">account_balance</span>Registrar compra por transferencia</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

