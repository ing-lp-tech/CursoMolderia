import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import ProductoCompraModal from '../components/ProductoCompraModal';
import { urlSoftware } from '../utils/software';

// /software — el sector del software de digitalización.
//
// Tres cosas en una página:
//   1. ?compra=<id>  → el estado de una compra. Acá vuelve el comprador desde
//                      MercadoPago, y acá lleva el link del WhatsApp de
//                      aprobación. Cuando se aprueba, ve su código y lo copia.
//   2. "Ya tengo un código" → cuántos usos le quedan.
//   3. Comprar créditos → los planes que emiten código, con el mismo modal de
//                      compra que /pizarras.
//
// Desde 1 y 2 sale el botón al software, cuya dirección se edita en
// /admin/configuracion (todavía no hay hosting: mientras esté vacía, la página
// lo avisa en vez de mostrar un botón roto).

const POLL_MS = 30_000;

async function consultar(body) {
  const res = await fetch('/api/digitalizacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'consultar', ...body }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta no JSON */ }
  if (!res.ok) throw new Error(data?.error || `No pudimos consultar (HTTP ${res.status})`);
  return data;
}

function fmtFecha(d) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_CODIGO = {
  activo:  { label: 'Activo',  clase: 'bg-secondary/15 text-secondary' },
  agotado: { label: 'Agotado', clase: 'bg-surface-variant text-on-surface-variant' },
  anulado: { label: 'Anulado', clase: 'bg-error/10 text-error' },
  vencido: { label: 'Vencido', clase: 'bg-error/10 text-error' },
};

// ── El código, grande y copiable, con el botón al software ───────────────────
function TarjetaCodigo({ credito, settings }) {
  const [copiado, setCopiado] = useState(false);
  const est = ESTADO_CODIGO[credito.estado] || ESTADO_CODIGO.activo;
  const usable = credito.estado === 'activo' && credito.restantes > 0;
  const destino = urlSoftware(settings.software_url, credito.codigo);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(credito.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (algunos navegadores in-app): al menos que
      // lo pueda seleccionar a mano.
      window.prompt('Copiá tu código:', credito.codigo);
    }
  }

  return (
    <div className="card border-2 border-primary/30 space-y-5 text-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Tu código</p>
        <button onClick={copiar}
          className="font-mono font-black text-3xl sm:text-4xl text-primary tracking-wider hover:opacity-80 transition-opacity break-all">
          {credito.codigo}
        </button>
        <div className="mt-3">
          <button onClick={copiar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-all">
            <span className="material-symbols-outlined text-base">{copiado ? 'check' : 'content_copy'}</span>
            {copiado ? '¡Copiado!' : 'Copiar código'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <div>
          <p className="font-headline font-black text-3xl">
            {credito.restantes}<span className="text-base text-on-surface-variant"> / {credito.total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Usos disponibles</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-1 ${est.clase}`}>
          {est.label}
        </span>
      </div>

      {credito.vence_en && (
        <p className="text-xs text-on-surface-variant">Vence el {fmtFecha(credito.vence_en)}</p>
      )}

      {usable && (destino ? (
        <a href={destino} target="_blank" rel="noopener noreferrer"
          className="btn-primary w-full flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-xl">open_in_new</span>
          {settings.software_boton || 'Abrir el software'}
        </a>
      ) : (
        <p className="text-sm text-on-surface-variant bg-surface-variant/50 rounded-xl p-3">
          El acceso al software se habilita muy pronto. <strong className="text-on-surface">Guardá tu código</strong>:
          te avisamos por WhatsApp cuando esté listo.
        </p>
      ))}

      {!usable && (
        <p className="text-sm text-on-surface-variant">
          Este código ya no tiene usos disponibles. Podés comprar más créditos acá abajo.
        </p>
      )}
    </div>
  );
}

// ── Estado de una compra (?compra=…) ─────────────────────────────────────────
function SeguimientoCompra({ compraId, settings }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await consultar({ compra: compraId }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [compraId]);

  useEffect(() => { cargar(); }, [cargar]);

  // La aprobación es manual: mientras esté en verificación se vuelve a
  // preguntar cada tanto, así el código aparece solo sin recargar.
  const enVerificacion = datos?.compra?.estado === 'en_verificacion';
  useEffect(() => {
    if (!enVerificacion) return;
    const t = setInterval(() => { if (!document.hidden) cargar(); }, POLL_MS);
    return () => clearInterval(t);
  }, [enVerificacion, cargar]);

  if (cargando && !datos) {
    return <div className="card flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;
  }
  if (error && !datos) {
    return (
      <div className="card text-center space-y-2">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="font-bold">{error}</p>
        <button onClick={cargar} className="text-sm font-bold text-primary hover:underline">Reintentar</button>
      </div>
    );
  }

  const { compra, credito } = datos;
  const queCompro = [compra.producto, compra.plan].filter(Boolean).join(' — ');

  if (compra.estado === 'aprobado' && credito) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-secondary font-bold flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-base">check_circle</span>
          Pago aprobado · {queCompro}
        </p>
        <TarjetaCodigo credito={credito} settings={settings} />
      </div>
    );
  }

  if (compra.estado === 'aprobado') {
    // Plan aprobado que no trae código (un plan físico sin créditos): igual se
    // le muestra la puerta al software.
    const destino = urlSoftware(settings.software_url);
    return (
      <div className="card text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-secondary">check_circle</span>
        <div>
          <h2 className="font-headline font-black text-xl">¡Tu pago fue aprobado!</h2>
          <p className="text-sm text-on-surface-variant mt-1">{queCompro}</p>
        </div>
        {destino && (
          <a href={destino} target="_blank" rel="noopener noreferrer"
            className="btn-primary w-full flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">open_in_new</span>
            {settings.software_boton || 'Abrir el software'}
          </a>
        )}
      </div>
    );
  }

  if (compra.estado === 'rechazado') {
    return (
      <div className="card text-center space-y-2">
        <span className="material-symbols-outlined text-5xl text-error">cancel</span>
        <h2 className="font-headline font-black text-xl">No pudimos aprobar esta compra</h2>
        <p className="text-sm text-on-surface-variant">Escribinos por WhatsApp y lo revisamos juntos.</p>
      </div>
    );
  }

  return (
    <div className="card text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-3xl text-primary">hourglass_top</span>
      </div>
      <div>
        <h2 className="font-headline font-black text-xl text-primary">Estamos verificando tu pago</h2>
        <p className="text-sm text-on-surface-variant mt-1">{queCompro}</p>
      </div>
      <p className="text-sm text-on-surface-variant">
        Apenas lo confirmemos, <strong className="text-on-surface">tu código aparece en esta página</strong> y
        también te lo mandamos por WhatsApp. Podés guardar este link y volver cuando quieras.
      </p>
      <button onClick={cargar} disabled={cargando}
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline disabled:opacity-50">
        <span className={`material-symbols-outlined text-base ${cargando ? 'animate-spin' : ''}`}>refresh</span>
        Volver a consultar
      </button>
    </div>
  );
}

// ── "Ya tengo un código" ─────────────────────────────────────────────────────
function ConsultarCodigo({ settings }) {
  const [codigo, setCodigo] = useState('');
  const [credito, setCredito] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function buscar(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setCredito(null);
    try {
      const data = await consultar({ codigo: codigo.trim().toUpperCase() });
      setCredito(data.credito);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="card space-y-3">
        <h2 className="font-headline font-black text-lg">¿Ya tenés un código?</h2>
        <p className="text-sm text-on-surface-variant -mt-1">Fijate cuántos usos te quedan y entrá al software.</p>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="MTX-XXXX-XXXX"
            maxLength={13}
            autoComplete="off"
            spellCheck={false}
            className="input-field font-mono uppercase tracking-wider flex-1 min-w-0"
          />
          <button type="submit" disabled={cargando || codigo.trim().length < 13}
            className="btn-primary shrink-0 disabled:opacity-50">
            {cargando ? '…' : 'Consultar'}
          </button>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
      </form>
      {credito && <TarjetaCodigo credito={credito} settings={settings} />}
    </div>
  );
}

// ── Pagar por alias ──────────────────────────────────────────────────────────
// El camino sin checkout: transfiere al alias, manda el comprobante por
// WhatsApp y el admin le crea el código a mano desde el panel (Créditos →
// Nuevo código → "Pagó por alias"), con el regalo incluido.
function PagoPorAlias({ settings, planes }) {
  const [copiado, setCopiado] = useState(false);
  const wa = (settings.moldes_whatsapp_comprobante || '').replace(/\D/g, '');
  const extra = Number(settings.transferencia_creditos_extra) || 0;
  const descuento = Number(settings.moldes_descuento_transferencia) || 0;

  if (!settings.moldes_alias && !settings.moldes_cbu) return null;

  // Referencia de precio: el plan de créditos sueltos ("por crédito"), o el
  // primero que haya.
  const plan = planes.find(pl => pl.cantidad_max > pl.cantidad_min) || planes[0];
  const precio = plan ? Math.round(Number(plan.precio) * (1 - descuento / 100)) : null;

  async function copiarAlias() {
    try {
      await navigator.clipboard.writeText(settings.moldes_alias);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copiá el alias:', settings.moldes_alias);
    }
  }

  const textoWa = encodeURIComponent(
    'Hola! Pagué por alias créditos de digitalización. Te paso el comprobante.\n\n' +
    'Mi nombre: \nCantidad de créditos: '
  );

  return (
    <section className="card border-2 border-secondary/30 space-y-5">
      <div>
        <h2 className="font-headline font-black text-2xl">Pagá por alias</h2>
        {extra > 0 && (
          <p className="mt-2 inline-flex items-center gap-2 bg-secondary/15 text-secondary font-bold text-sm rounded-full px-3 py-1">
            🎁 Pagando por alias te regalamos {extra} {extra === 1 ? 'crédito extra' : 'créditos extra'}
          </p>
        )}
      </div>

      {precio != null && (
        <p className="text-sm text-on-surface-variant">
          Cada crédito cuesta <strong className="text-on-surface">${precio.toLocaleString('es-AR')}</strong>
          {plan.cantidad_max > plan.cantidad_min ? '' : ` (${plan.nombre})`}.
          Transferí el total según cuántos créditos quieras.
        </p>
      )}

      <div className="bg-surface-variant/50 rounded-2xl p-4 space-y-2 text-sm">
        {settings.moldes_alias && (
          <div className="flex items-center justify-between gap-2">
            <p><span className="text-on-surface-variant">Alias:</span> <strong className="font-mono">{settings.moldes_alias}</strong></p>
            <button onClick={copiarAlias}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/15 text-secondary text-xs font-bold hover:bg-secondary/25 transition-all shrink-0">
              <span className="material-symbols-outlined text-base">{copiado ? 'check' : 'content_copy'}</span>
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}
        {settings.moldes_cbu && <p><span className="text-on-surface-variant">CBU:</span> <strong className="font-mono break-all">{settings.moldes_cbu}</strong></p>}
        {settings.moldes_titular && <p><span className="text-on-surface-variant">Titular:</span> <strong>{settings.moldes_titular}</strong></p>}
        {settings.moldes_banco && <p><span className="text-on-surface-variant">Banco:</span> <strong>{settings.moldes_banco}</strong></p>}
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary font-black flex items-center justify-center shrink-0">1</span>
          <span>Transferí el monto al alias.</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary font-black flex items-center justify-center shrink-0">2</span>
          <span>
            <strong>Mandanos el comprobante por WhatsApp</strong>
            {wa && <> al <strong className="font-mono">+{wa}</strong></>}, con tu nombre y cuántos créditos compraste.
            Sin el comprobante no podemos generar tu código.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary font-black flex items-center justify-center shrink-0">3</span>
          <span>
            Te mandamos tu código por WhatsApp{extra > 0 ? ', con el regalo ya incluido' : ''}. Lo consultás y lo
            copiás acá arriba, en "¿Ya tenés un código?".
          </span>
        </li>
      </ol>

      {wa && (
        <a href={`https://wa.me/${wa}?text=${textoWa}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-2xl px-5 py-4 font-headline font-black text-base uppercase tracking-wide text-white bg-[#25D366] hover:bg-[#1EBE5A] transition-all">
          <span className="material-symbols-outlined text-2xl">chat</span>
          Enviar comprobante por WhatsApp
        </a>
      )}
    </section>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function SoftwarePage() {
  const settings = useAppSettings();
  const [compraId] = useState(() => new URLSearchParams(window.location.search).get('compra'));
  const [planes, setPlanes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [elegido, setElegido] = useState(null);   // { producto, plan }

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Solo los planes que entregan un código: es lo que se vende en esta
      // página. Los planes con pizarra se siguen comprando desde /pizarras.
      const { data: filas } = await supabase
        .from('producto_planes')
        .select('*')
        .eq('otorga_creditos', true)
        .eq('activo', true)
        .is('eliminado_en', null)
        .order('orden');
      const ids = [...new Set((filas || []).map(pl => pl.producto_id))];
      let prods = [];
      if (ids.length) {
        const { data } = await supabase
          .from('productos')
          .select('*')
          .in('id', ids)
          .eq('activo', true)
          .is('eliminado_en', null);
        prods = data || [];
      }
      if (!vivo) return;
      setProductos(prods);
      // Un plan colgado de un producto inactivo no se puede comprar.
      setPlanes((filas || []).filter(pl => prods.some(p => p.id === pl.producto_id)));
    })();
    return () => { vivo = false; };
  }, []);

  function comprar(pl) {
    const producto = productos.find(p => p.id === pl.producto_id);
    if (producto) setElegido({ producto, plan: pl });
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <span className="inline-flex items-center gap-2 bg-primary/15 text-primary font-bold text-xs uppercase tracking-widest px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-base">key</span>
            Software de digitalización
          </span>
          <h1 className="font-headline font-black text-3xl sm:text-4xl text-on-surface leading-tight">
            Tu código, tus <span className="text-primary">digitalizaciones</span>
          </h1>
          <p className="text-on-surface-variant">
            Cada código trae una cantidad de usos: 1 crédito = 1 digitalización.
            Copialo y pegalo en el software para empezar.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
        {compraId && <SeguimientoCompra compraId={compraId} settings={settings} />}

        <ConsultarCodigo settings={settings} />

        {planes.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-headline font-black text-2xl text-center">Comprá créditos</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {planes.map(pl => (
                <div key={pl.id} className={`card flex flex-col ${pl.destacado ? 'ring-2 ring-primary/50' : ''}`}>
                  <h3 className="font-headline font-black">{pl.nombre}</h3>
                  <div className="mt-2">
                    <span className="font-headline font-black text-primary text-2xl">
                      ${Number(pl.precio).toLocaleString('es-AR')}
                    </span>
                    {pl.precio_sufijo && <span className="text-xs text-on-surface-variant ml-1">{pl.precio_sufijo}</span>}
                  </div>
                  {pl.descripcion && <p className="text-sm text-on-surface-variant mt-2">{pl.descripcion}</p>}
                  {pl.incluye && (
                    <ul className="mt-3 space-y-1.5">
                      {pl.incluye.split('\n').filter(Boolean).map((linea, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm text-primary shrink-0 mt-0.5">check_circle</span>
                          {linea}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-4">
                    <button onClick={() => comprar(pl)} className="btn-primary w-full">
                      {pl.cantidad_max > pl.cantidad_min ? 'Elegir cantidad' : 'Comprar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <PagoPorAlias settings={settings} planes={planes} />
      </div>

      {elegido && (
        <ProductoCompraModal
          producto={elegido.producto}
          planes={planes.filter(pl => pl.producto_id === elegido.producto.id)}
          planInicial={elegido.plan}
          settings={settings}
          retorno="/software"
          onClose={() => setElegido(null)}
        />
      )}
    </div>
  );
}
