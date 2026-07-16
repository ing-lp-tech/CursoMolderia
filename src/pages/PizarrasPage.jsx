import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import { PROVINCIAS_ARGENTINA } from '../utils/provinciasArgentina';
import pizarraDemo from '../assets/pizarra-digitalizando.png';

const VENTAJAS = [
  { icon: 'bolt',          titulo: 'Velocidad',    texto: 'Digitalización en segundos.' },
  { icon: 'target',        titulo: 'Precisión',    texto: 'Resultados profesionales.' },
  { icon: 'tune',          titulo: 'Simplicidad',  texto: 'Muy fácil de configurar.' },
];

const WHATSAPP_NUMERO = '5491162020911';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/pizarras-imagenes/${path}`;
}

function pizarraImages(p) {
  return [p.imagen_1_path, p.imagen_2_path, p.imagen_3_path].filter(Boolean);
}

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
function PantallaVerificacion({ metodo, monto, compraId, settings, onClose }) {
  const wa = settings.moldes_whatsapp_comprobante?.replace(/\D/g, '');
  const texto = encodeURIComponent(
    metodo === 'mercadopago'
      ? `Hola! Ya pagué con MercadoPago la pizarra digitalizadora (código #${compraId?.slice(0, 8) ?? ''}). Te aviso para que apruebes mi compra y coordinemos el envío. ¡Gracias!`
      : `Hola! Acabo de realizar una compra de una pizarra digitalizadora (#${compraId?.slice(0, 8) ?? ''}). ` +
        `Adjunto mi comprobante de pago por $${monto?.toLocaleString('es-AR') ?? ''}.`
  );
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
            Tu pedido está <strong className="text-on-surface">en verificación</strong>. Una vez que confirmemos tu pago, generamos el envío y te pasamos el código de seguimiento.
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
function PizarraModal({ pizarra, settings, onClose }) {
  const [step, setStep] = useState('detalle'); // detalle | form | envio | pago | verificacion
  const [form, setForm] = useState(FORM_EMPTY);
  const [metodo, setMetodo] = useState('mercadopago');
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
  const precioMP = Number(pizarra.precio);
  const precioTransfer = Math.round(precioMP * (1 - descuento / 100));
  const precioBaseElegido = metodo === 'mercadopago' ? precioMP : precioTransfer;
  const totalConEnvio = precioBaseElegido + (envioElegido?.precio || 0);

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
    return form.nombre.trim()
      && normalizeWhatsapp(form.whatsapp).length >= 10
      && emailValido(form.email)
      && form.calle.trim() && form.ciudad.trim() && form.provincia && form.codigo_postal.trim();
  }

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  async function handleCotizarEnvio() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/envia-cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pizarra_id: pizarra.id,
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
    if (!envioElegido) { setError('Elegí una opción de envío'); return; }
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
    const envio = {
      carrier: envioElegido.carrier,
      service: envioElegido.service,
      descripcion: envioElegido.descripcion,
      precio: envioElegido.precio,
      requiere_sucursal: envioElegido.requiere_sucursal,
    };
    try {
      const r = await fetch('/api/create-pizarra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pizarra_id: pizarra.id, comprador, envio, metodo, sucursal: sucursalElegida }),
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
        monto={montoFinal}
        compraId={compraId}
        settings={settings}
        onClose={onClose}
      />
    );
  }

  const TITULOS = { detalle: pizarra.titulo, form: 'Dirección de envío', envio: 'Elegí el envío', pago: 'Método de pago' };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 sticky top-0 bg-surface-container z-10">
          {step !== 'detalle' && (
            <button
              onClick={() => setStep(step === 'pago' ? 'envio' : step === 'envio' ? 'form' : 'detalle')}
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
              <Carousel images={pizarraImages(pizarra)} />
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-headline font-black text-xl text-on-surface">{pizarra.titulo}</h3>
                  <div className="text-right shrink-0">
                    <p className="font-black text-primary text-xl">${Number(pizarra.precio).toLocaleString('es-AR')}</p>
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
              <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-variant/50 rounded-xl p-3">
                <span className="material-symbols-outlined text-base">local_shipping</span>
                Envío a todo el país con envia.com. El costo se calcula según tu dirección.
              </div>
              {pizarra.stock > 0 ? (
                <button onClick={() => setStep('form')} className="btn-primary w-full">Comprar pizarra digitalizadora</button>
              ) : (
                <button disabled className="btn-primary w-full opacity-50 cursor-not-allowed">Sin stock por el momento</button>
              )}
            </>
          )}

          {/* STEP: Form (datos + dirección) */}
          {step === 'form' && (
            <>
              <p className="text-sm text-on-surface-variant">Necesitamos tus datos y tu dirección para cotizar el envío.</p>
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
                  <p className="text-xs text-on-surface-variant mt-1">Lo necesita el correo para avisarte cuando el paquete llegue a la sucursal.</p>
                </div>
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
              </div>

              {error && (
                <p className="text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>{error}
                </p>
              )}

              <button
                onClick={handleCotizarEnvio}
                disabled={!formValid() || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><span className="material-symbols-outlined animate-spin text-xl">refresh</span>Cotizando envío...</>
                  : <><span className="material-symbols-outlined text-xl">local_shipping</span>Cotizar envío</>
                }
              </button>
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
                <p className="text-xs text-on-surface-variant mt-1">Envío: {envioElegido?.carrier} — {envioElegido?.descripcion} (${envioElegido?.precio.toLocaleString('es-AR')})</p>
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

// ── Product card ─────────────────────────────────────────────────────────────
function PizarraCard({ pizarra, onClick }) {
  const imgSrc = imgUrl(pizarra.imagen_1_path);
  return (
    <button onClick={onClick} className="card overflow-hidden text-left group hover:shadow-lg transition-all">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-variant mb-3">
        {imgSrc
          ? <img src={imgSrc} alt={pizarra.titulo} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-4xl text-outline-variant">draw</span></div>
        }
      </div>
      <div className="space-y-1">
        <h3 className="font-headline font-black text-on-surface text-base leading-tight line-clamp-2">{pizarra.titulo}</h3>
        <div className="flex items-center gap-2 pt-1">
          <span className="font-black text-primary text-lg">${Number(pizarra.precio).toLocaleString('es-AR')}</span>
        </div>
        <p className="text-xs text-on-surface-variant">
          {pizarra.stock > 0 ? `${pizarra.stock} disponibles` : 'Sin stock'}
        </p>
      </div>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PizarrasPage() {
  const settings = useAppSettings();
  const [pizarras, setPizarras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [retornoMP, setRetornoMP] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('estado');
    const id = params.get('id');
    if ((estado === 'verificacion' || estado === 'fallo') && id) {
      if (estado === 'verificacion') setRetornoMP({ compraId: id });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pizarras')
      .select('*')
      .eq('activo', true)
      .is('eliminado_en', null)
      .order('orden');
    setPizarras(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const irAlProducto = pizarras[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 to-secondary/10 py-14 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          {/* Texto */}
          <div className="lg:col-span-7 space-y-5">
            <span className="inline-flex items-center gap-2 bg-primary/15 text-primary font-bold text-xs uppercase tracking-widest px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              Digitalizá tus moldes al instante
            </span>

            <h1 className="font-headline font-black text-3xl sm:text-4xl lg:text-5xl text-on-surface leading-tight">
              Pasá tus moldes de <span className="text-primary">cartón a digital</span> con la cámara de tu celular 📱
            </h1>

            <p className="text-on-surface-variant text-base leading-relaxed max-w-xl">
              ¿Cansada de trabajar con moldes en cartón? Con nuestra <strong className="text-on-surface">Pizarra Digitalizadora</strong>, pasá tus moldes físicos a digital en segundos, sin perder precisión.
            </p>

            {/* Ventajas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {VENTAJAS.map(v => (
                <div key={v.titulo} className="bg-surface-container/60 border border-outline-variant/15 rounded-2xl p-4">
                  <span className="material-symbols-outlined text-primary text-2xl mb-1 block">{v.icon}</span>
                  <p className="font-headline font-bold text-sm text-on-surface">{v.titulo}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{v.texto}</p>
                </div>
              ))}
            </div>

            {/* Precio + CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
              <div className="p-4 bg-surface-container border-l-4 border-primary rounded-lg shadow-lg">
                <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest block mb-1">Inversión</span>
                <span className="text-3xl font-headline font-bold text-primary">$400.000</span>
              </div>
              {irAlProducto && (
                <button onClick={() => setSelected(irAlProducto)} className="btn-primary">
                  Quiero mi pizarra digitalizadora
                </button>
              )}
            </div>
          </div>

          {/* Imagen ilustrativa */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl overflow-hidden border border-outline-variant/15 shadow-2xl">
              <img
                src={pizarraDemo}
                alt="Digitalizando un molde con la cámara del celular sobre la pizarra digitalizadora"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Potenciá tu taller */}
      <section className="max-w-6xl mx-auto px-4 pt-10">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          💡 ¿Querés potenciar aún más tu taller?
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="/temario" className="flex items-start gap-4 p-5 rounded-2xl border border-outline-variant/20 hover:border-primary/40 bg-surface-container/40 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl shrink-0">school</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Curso de Moldería Digital</p>
              <p className="text-sm text-on-surface-variant mt-1">Aprendé a crear, modificar y escalar moldes con Audaces.</p>
            </div>
          </a>
          <div className="flex items-start gap-4 p-5 rounded-2xl border border-outline-variant/20 bg-surface-container/40">
            <span className="material-symbols-outlined text-secondary text-3xl shrink-0">print</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Plotter de Tizada</p>
              <p className="text-sm text-on-surface-variant mt-1">Optimizá tus cortes y reducí el desperdicio de telas.</p>
            </div>
          </div>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Hola! Tengo dudas sobre la pizarra digitalizadora, ¿me asesorás?')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#25D366] hover:underline"
        >
          <span className="material-symbols-outlined text-base">chat</span>
          📩 ¿Dudas? Escribinos y te asesoramos
        </a>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
          </div>
        ) : pizarras.length === 0 ? (
          <div className="text-center py-20 space-y-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl block">search_off</span>
            <p className="font-bold">No hay pizarras disponibles por el momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {pizarras.map(p => (
              <PizarraCard key={p.id} pizarra={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <PizarraModal pizarra={selected} settings={settings} onClose={() => setSelected(null)} />
      )}

      {retornoMP && (
        <PantallaVerificacion
          metodo="mercadopago"
          monto={null}
          compraId={retornoMP.compraId}
          settings={settings}
          onClose={() => setRetornoMP(null)}
        />
      )}
    </div>
  );
}
