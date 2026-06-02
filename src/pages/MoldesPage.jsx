import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/moldes-imagenes/${path}`;
}

function moldeImages(m) {
  return [m.imagen_1_path, m.imagen_2_path, m.imagen_3_path].filter(Boolean);
}


// ── Image carousel ──────────────────────────────────────────────────────────
function Carousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images?.length) return (
    <div className="w-full aspect-square bg-surface-variant rounded-2xl flex items-center justify-center">
      <span className="material-symbols-outlined text-4xl text-outline-variant">image</span>
    </div>
  );
  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-surface-variant select-none">
      <img src={imgUrl(images[idx])} alt="" className="w-full h-full object-cover" />
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

// ── Buyer form ──────────────────────────────────────────────────────────────
const FORM_EMPTY = { nombre: '', whatsapp: '' };

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
    `Hola! Acabo de realizar una compra de molde (#${compraId?.slice(0, 8) ?? ''}). ` +
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
            Tu pedido está <strong className="text-on-surface">en verificación</strong>. Una vez que confirmemos tu pago, te enviaremos el molde por WhatsApp.
          </p>
        </div>

        {metodo === 'transferencia' && (
          <div className="bg-secondary/10 rounded-2xl p-4 text-left space-y-2 text-sm">
            <p className="font-bold text-on-surface uppercase tracking-wide text-xs mb-3">Datos para transferir</p>
            {settings.moldes_titular && <p><span className="text-on-surface-variant">Titular:</span> <strong>{settings.moldes_titular}</strong></p>}
            {settings.moldes_banco && <p><span className="text-on-surface-variant">Banco:</span> <strong>{settings.moldes_banco}</strong></p>}
            {settings.moldes_cbu && <p><span className="text-on-surface-variant">CBU:</span> <strong className="font-mono">{settings.moldes_cbu}</strong></p>}
            {settings.moldes_alias && <p><span className="text-on-surface-variant">Alias:</span> <strong>{settings.moldes_alias}</strong></p>}
            <p className="pt-1"><span className="text-on-surface-variant">Monto:</span> <strong className="text-primary text-base">${monto?.toLocaleString('es-AR')}</strong></p>
          </div>
        )}

        {metodo === 'mercadopago' && (
          <p className="text-sm text-on-surface-variant">
            Pagaste con MercadoPago. Una vez que verifiquemos tu pago, recibirás el molde.
          </p>
        )}

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">send</span>
            Enviar comprobante por WhatsApp
          </a>
        )}

        <button onClick={onClose} className="btn-secondary w-full">Volver al catálogo</button>
      </div>
    </div>
  );
}

// ── Detail / purchase modal ──────────────────────────────────────────────────
function MoldeModal({ molde, settings, onClose }) {
  const [step, setStep] = useState('detalle'); // detalle | form | pago | verificacion
  const [form, setForm] = useState(FORM_EMPTY);
  const [metodo, setMetodo] = useState('mercadopago');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compraId, setCompraId] = useState(null);
  const [montoFinal, setMontoFinal] = useState(null);
  const [waHint, setWaHint] = useState('');

  const descuento = Number(settings.moldes_descuento_transferencia) || 0;
  const precioMP = Number(molde.precio);
  const precioTransfer = Math.round(precioMP * (1 - descuento / 100));

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
    return form.nombre.trim() && normalizeWhatsapp(form.whatsapp).length >= 10;
  }

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  async function handleComprar() {
    setLoading(true);
    setError('');
    const comprador = {
      nombre:   form.nombre.trim(),
      whatsapp: normalizeWhatsapp(form.whatsapp) || form.whatsapp.trim(),
    };
    try {
      if (metodo === 'mercadopago') {
        const r = await fetch('/api/create-molde-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ molde_id: molde.id, comprador }),
        });
        const data = await safeJson(r);
        if (!r.ok || !data) throw new Error(data?.error || `Error del servidor (${r.status})`);
        setCompraId(data.compra_id);
        setMontoFinal(precioMP);
        window.location.href = data.init_point;
      } else {
        const r = await fetch('/api/create-molde-transferencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ molde_id: molde.id, comprador }),
        });
        const data = await safeJson(r);
        if (!r.ok || !data) throw new Error(data?.error || `Error del servidor (${r.status})`);
        setCompraId(data.compra_id);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 sticky top-0 bg-surface-container z-10">
          {step !== 'detalle' && (
            <button onClick={() => setStep(step === 'pago' ? 'form' : 'detalle')} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <h2 className="font-headline font-black text-lg text-on-surface flex-1 truncate">
            {step === 'detalle' ? molde.titulo : step === 'form' ? 'Tus datos' : 'Método de pago'}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface ml-2">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {/* STEP: Detalle */}
          {step === 'detalle' && (
            <>
              <Carousel images={moldeImages(molde)} />
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                      {molde.categoria_nombre}{molde.subcategoria_nombre ? ` › ${molde.subcategoria_nombre}` : ''}
                    </p>
                    <h3 className="font-headline font-black text-xl text-on-surface mt-0.5">{molde.titulo}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-primary text-xl">${Number(molde.precio).toLocaleString('es-AR')}</p>
                    {descuento > 0 && (
                      <p className="text-xs text-secondary font-bold">{descuento}% off con transferencia</p>
                    )}
                  </div>
                </div>
                {molde.descripcion && (
                  <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{molde.descripcion}</p>
                )}
              </div>
              <div className="flex gap-2 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">attach_file</span>Archivo Audaces (.ads)</span>
                {molde.archivo_pdf_path && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF incluido</span>}
              </div>
              <button onClick={() => setStep('form')} className="btn-primary w-full">
                Comprar molde
              </button>
            </>
          )}

          {/* STEP: Form */}
          {step === 'form' && (
            <>
              <p className="text-sm text-on-surface-variant">Solo necesitamos tu nombre y WhatsApp para enviarte el molde.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Nombre completo *</label>
                  <input name="nombre" value={form.nombre} onChange={handleFormChange} className="input-field w-full" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">WhatsApp *</label>
                  <input
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={handleFormChange}
                    onBlur={handleWhatsappBlur}
                    className="input-field w-full"
                    placeholder="Ej: 1162020911"
                    type="tel"
                  />
                  {waHint && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Se va a usar: {waHint}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setStep('pago')} disabled={!formValid()} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                Continuar con el pago
              </button>
            </>
          )}

          {/* STEP: Pago */}
          {step === 'pago' && (
            <>
              <div className="bg-surface-variant/50 rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Comprando</p>
                <p className="font-headline font-black text-on-surface">{molde.titulo}</p>
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
                      <p className="font-black text-primary">${precioMP.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                  {metodo === 'mercadopago' && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-base text-primary">info</span>
                      Serás redirigido a MercadoPago para completar el pago.
                    </div>
                  )}
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
                        {descuento > 0 && <p className="text-xs text-secondary font-bold">{descuento}% de descuento</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {descuento > 0 && <p className="text-xs line-through text-on-surface-variant">${precioMP.toLocaleString('es-AR')}</p>}
                      <p className="font-black text-secondary">${precioTransfer.toLocaleString('es-AR')}</p>
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

// ── Molde card ───────────────────────────────────────────────────────────────
function MoldeCard({ molde, onClick }) {
  const imgSrc = imgUrl(molde.imagen_1_path);
  const descuento = molde._descuento || 0;
  return (
    <button
      onClick={onClick}
      className="card overflow-hidden text-left group hover:shadow-lg transition-all"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-surface-variant mb-3">
        {imgSrc
          ? <img src={imgSrc} alt={molde.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-4xl text-outline-variant">straighten</span></div>
        }
      </div>
      <div className="space-y-1">
        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wide truncate">
          {molde.categoria_nombre}{molde.subcategoria_nombre ? ` › ${molde.subcategoria_nombre}` : ''}
        </p>
        <h3 className="font-headline font-black text-on-surface text-sm leading-tight line-clamp-2">{molde.titulo}</h3>
        <div className="flex items-center gap-2 pt-1">
          <span className="font-black text-primary">${Number(molde.precio).toLocaleString('es-AR')}</span>
          {descuento > 0 && (
            <span className="text-xs bg-secondary/15 text-secondary font-bold px-2 py-0.5 rounded-full">{descuento}% off</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MoldesPage() {
  const settings = useAppSettings();
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [moldes, setMoldes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [subcatFilter, setSubcatFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const descuento = Number(settings.moldes_descuento_transferencia) || 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: subcats }, { data: mlds }] = await Promise.all([
      supabase.from('moldes_categorias').select('id, nombre, slug').is('eliminado_en', null).order('orden'),
      supabase.from('moldes_subcategorias').select('id, nombre, slug, categoria_id').is('eliminado_en', null).order('orden'),
      supabase.from('moldes').select(`
        id, titulo, descripcion, precio, orden,
        imagen_1_path, imagen_2_path, imagen_3_path,
        archivo_ads_path, archivo_pdf_path,
        categoria_id, subcategoria_id,
        moldes_categorias!moldes_categoria_id_fkey(nombre),
        moldes_subcategorias!moldes_subcategoria_id_fkey(nombre)
      `).eq('activo', true).is('eliminado_en', null).order('orden'),
    ]);
    setCategorias(cats || []);
    setSubcategorias(subcats || []);
    setMoldes((mlds || []).map(m => ({
      ...m,
      categoria_nombre: m.moldes_categorias?.nombre || '',
      subcategoria_nombre: m.moldes_subcategorias?.nombre || '',
      _descuento: descuento,
    })));
    setLoading(false);
  }, [descuento]);

  useEffect(() => { if (settings.loaded) fetchData(); }, [fetchData, settings.loaded]);

  function handleCatFilter(id) {
    setCatFilter(c => c === id ? '' : id);
    setSubcatFilter('');
  }

  const subcatsFiltered = catFilter
    ? subcategorias.filter(s => s.categoria_id === catFilter)
    : [];

  const moldesFiltrados = moldes.filter(m => {
    if (catFilter && m.categoria_id !== catFilter) return false;
    if (subcatFilter && m.subcategoria_id !== subcatFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 to-secondary/10 py-14 px-4 text-center">
        <span className="material-symbols-outlined text-primary text-4xl mb-2 block">straighten</span>
        <h1 className="font-headline font-black text-3xl sm:text-4xl text-primary uppercase tracking-tight mb-3">
          Moldes de ropa
        </h1>
        <p className="text-on-surface-variant max-w-md mx-auto text-sm sm:text-base">
          Descargá moldes profesionales en formato Audaces (.ads) y PDF. Pago seguro, descarga inmediata tras verificación.
        </p>
        {descuento > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-secondary/15 text-secondary font-bold px-4 py-2 rounded-full text-sm">
            <span className="material-symbols-outlined text-base">local_offer</span>
            {descuento}% de descuento pagando por transferencia
          </div>
        )}
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category filters */}
        {categorias.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCatFilter(''); setSubcatFilter(''); }}
                className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide border-2 transition-all ${!catFilter ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant'}`}
              >
                Todos
              </button>
              {categorias.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCatFilter(c.id)}
                  className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide border-2 transition-all ${catFilter === c.id ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant'}`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            {subcatsFiltered.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-2">
                {subcatsFiltered.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSubcatFilter(sc => sc === s.id ? '' : s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all ${subcatFilter === s.id ? 'border-secondary bg-secondary/15 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:border-secondary/40'}`}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
          </div>
        ) : moldesFiltrados.length === 0 ? (
          <div className="text-center py-20 space-y-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl block">search_off</span>
            <p className="font-bold">No hay moldes en esta categoría todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {moldesFiltrados.map(m => (
              <MoldeCard key={m.id} molde={m} onClick={() => setSelected(m)} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <MoldeModal
          molde={selected}
          settings={settings}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
