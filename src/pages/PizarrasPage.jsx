import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import { PROVINCIAS_ARGENTINA } from '../utils/provinciasArgentina';
import pizarraDemo from '../assets/pizarra-digitalizando.png';
import ProductoCompraModal, { PantallaVerificacion } from '../components/ProductoCompraModal';
import { imgUrl } from '../utils/imagenesProducto';

const VENTAJAS = [
  { icon: 'bolt',          titulo: 'Velocidad',    texto: 'Digitalización en segundos.' },
  { icon: 'target',        titulo: 'Precisión',    texto: 'Resultados profesionales.' },
  { icon: 'tune',          titulo: 'Simplicidad',  texto: 'Muy fácil de configurar.' },
];

const WHATSAPP_NUMERO = '5491162020911';

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
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  // Plan con el que se abre el modal cuando entran por una card de plan.
  const [planInicial, setPlanInicial] = useState(null);
  const [retornoMP, setRetornoMP] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('estado');
    const id = params.get('id');
    if ((estado === 'verificacion' || estado === 'fallo') && id) {
      if (estado === 'verificacion') setRetornoMP({ compraId: id, sinEnvio: params.get('sin_envio') === '1' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // `productos` ahora guarda también plotters, PCs y accesorios, así que esta
    // página se acota a la categoría "Pizarras". Si no se encontrara la
    // categoría, se listan todos los productos activos en vez de dejar la
    // página vacía.
    const { data: categoria } = await supabase
      .from('producto_categorias')
      .select('id')
      .eq('slug', 'pizarras')
      .maybeSingle();

    let query = supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .is('eliminado_en', null)
      .order('orden');
    if (categoria?.id) query = query.eq('categoria_id', categoria.id);

    const { data } = await query;
    const productos = data || [];
    setPizarras(productos);

    // Los planes viven en su propia tabla y se editan desde el panel: los
    // precios de esta página salen de acá, no del código.
    if (productos.length) {
      const { data: filas } = await supabase
        .from('producto_planes')
        .select('*')
        .in('producto_id', productos.map(x => x.id))
        .eq('activo', true)
        .is('eliminado_en', null)
        .order('orden');
      setPlanes(filas || []);
    } else {
      setPlanes([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const irAlProducto = pizarras[0];
  const planesDe = (productoId) => planes.filter(pl => pl.producto_id === productoId);
  const planesDestacados = irAlProducto ? planesDe(irAlProducto.id) : [];

  function abrirPlan(pl) {
    setPlanInicial(pl);
    setSelected(pizarras.find(x => x.id === pl.producto_id) || irAlProducto);
  }

  function cerrarModal() {
    setSelected(null);
    setPlanInicial(null);
  }

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

      {/* Planes */}
      {planesDestacados.length > 0 && (
        <section id="planes" className="max-w-6xl mx-auto px-4 pt-12">
          <h2 className="font-headline font-black text-2xl sm:text-3xl text-on-surface text-center">
            Elegí tu plan
          </h2>
          <p className="text-center text-sm text-on-surface-variant mt-2 mb-6">
            Todos se compran desde acá, con MercadoPago o transferencia.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {planesDestacados.map(pl => (
              <div
                key={pl.id}
                className={`card flex flex-col h-full ${pl.destacado ? 'ring-2 ring-primary/50' : ''}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-headline font-black text-on-surface">{pl.nombre}</h3>
                  {pl.destacado && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/20 text-secondary rounded-full px-2 py-0.5">
                      Más elegido
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <span className="font-headline font-black text-primary text-2xl">
                    ${Number(pl.precio).toLocaleString('es-AR')}
                  </span>
                  {pl.precio_sufijo && (
                    <span className="text-xs text-on-surface-variant ml-1">{pl.precio_sufijo}</span>
                  )}
                </div>

                {pl.descripcion && (
                  <p className="text-sm text-on-surface-variant mt-2">{pl.descripcion}</p>
                )}

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
                  <button onClick={() => abrirPlan(pl)} className="btn-primary w-full">
                    {pl.cantidad_max > pl.cantidad_min ? 'Elegir cantidad' : 'Comprar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
        <ProductoCompraModal
          producto={selected}
          planes={planesDe(selected.id)}
          planInicial={planInicial}
          settings={settings}
          onClose={cerrarModal}
        />
      )}

      {retornoMP && (
        <PantallaVerificacion
          metodo="mercadopago"
          monto={null}
          compraId={retornoMP.compraId}
          sinEnvio={retornoMP.sinEnvio}
          settings={settings}
          onClose={() => setRetornoMP(null)}
        />
      )}
    </div>
  );
}
