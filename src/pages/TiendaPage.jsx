import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import ProductoCompraModal, { PantallaVerificacion } from '../components/ProductoCompraModal';
import { imgUrl } from '../utils/imagenesProducto';

// Tienda pública: /tienda y /tienda/:categoria
//
// Muestra TODO el catálogo (pizarras, plotters, papel, PCs, accesorios) con
// filtro por categoría y subcategoría. La compra usa el mismo modal que
// /pizarras — no hay una segunda implementación del checkout.

// MercadoPago devuelve al comprador con ?estado=…&id=… en la URL. Se lee una
// sola vez, al montar, y se limpia la barra de direcciones para que un refresh
// no vuelva a abrir la pantalla de "compra registrada".
function leerRetornoMP() {
  const params = new URLSearchParams(window.location.search);
  const estado = params.get('estado');
  const id = params.get('id');
  if (!id || (estado !== 'verificacion' && estado !== 'fallo')) return null;
  window.history.replaceState({}, '', window.location.pathname);
  return estado === 'verificacion'
    ? { compraId: id, sinEnvio: params.get('sin_envio') === '1' }
    : null;
}

async function traerCatalogo() {
  const [{ data: cats }, { data: subs }, { data: prods }] = await Promise.all([
    supabase.from('producto_categorias').select('*')
      .eq('activo', true).is('eliminado_en', null).order('orden'),
    supabase.from('producto_subcategorias').select('*')
      .eq('activo', true).is('eliminado_en', null).order('orden'),
    supabase.from('productos').select('*')
      .eq('activo', true).is('eliminado_en', null).order('orden'),
  ]);

  // Los planes solo los tienen algunos productos (hoy, la pizarra). Se traen
  // todos juntos para no hacer una consulta por card.
  let planes = [];
  if (prods?.length) {
    const { data } = await supabase.from('producto_planes').select('*')
      .in('producto_id', prods.map(p => p.id))
      .eq('activo', true).is('eliminado_en', null).order('orden');
    planes = data || [];
  }

  return { cats: cats || [], subs: subs || [], prods: prods || [], planes };
}

function ProductoCard({ producto, onClick }) {
  const src = imgUrl(producto.thumb_1_path || producto.imagen_1_path);
  const sinStock = !(producto.stock > 0);

  return (
    <button onClick={onClick} className="card overflow-hidden text-left group hover:shadow-lg transition-all flex flex-col">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-variant mb-3">
        {src
          ? <img src={src} alt={producto.titulo} loading="lazy"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-outline-variant">inventory_2</span>
            </div>
        }
      </div>
      <div className="space-y-1 flex-1 flex flex-col">
        <h3 className="font-headline font-black text-on-surface text-base leading-tight line-clamp-2">{producto.titulo}</h3>
        <span className="font-black text-primary text-lg">${Number(producto.precio).toLocaleString('es-AR')}</span>
        <p className={`text-xs mt-auto ${sinStock ? 'text-error' : 'text-on-surface-variant'}`}>
          {sinStock ? 'Sin stock' : `${producto.stock} disponibles`}
        </p>
      </div>
    </button>
  );
}

// Fila de chips reutilizable para categorías y subcategorías.
function Filtros({ opciones, activo, onElegir, etiquetaTodo }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onElegir(null)}
        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
          activo === null
            ? 'bg-primary/15 border-primary/40 text-primary'
            : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
        }`}
      >
        {etiquetaTodo}
      </button>
      {opciones.map(o => (
        <button
          key={o.id}
          onClick={() => onElegir(o)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
            activo?.id === o.id
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
          }`}
        >
          {o.icono && <span className="material-symbols-outlined text-base">{o.icono}</span>}
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

export default function TiendaPage() {
  const settings = useAppSettings();
  const { categoria: slugCategoria } = useParams();
  const navigate = useNavigate();

  const [categorias,    setCategorias]    = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [productos,     setProductos]     = useState([]);
  const [planes,        setPlanes]        = useState([]);
  const [loading,       setLoading]       = useState(true);

  // Guarda el id, no el objeto: así, al cambiar de categoría, el filtro se
  // vacía solo (el id deja de existir entre las subcategorías visibles) sin
  // necesidad de un efecto que lo resetee.
  const [subElegidaId, setSubElegidaId] = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [retornoMP,    setRetornoMP]    = useState(leerRetornoMP);

  useEffect(() => {
    let vivo = true;
    traerCatalogo().then(({ cats, subs, prods, planes: pls }) => {
      if (!vivo) return;
      setCategorias(cats);
      setSubcategorias(subs);
      setProductos(prods);
      setPlanes(pls);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, []);

  const catElegida = slugCategoria
    ? categorias.find(c => c.slug === slugCategoria) || null
    : null;

  const subsDeCategoria = catElegida
    ? subcategorias.filter(s => s.categoria_id === catElegida.id)
    : [];

  const subElegida = subsDeCategoria.find(s => s.id === subElegidaId) || null;

  const visibles = productos.filter(p => {
    if (catElegida && p.categoria_id !== catElegida.id) return false;
    if (subElegida && p.subcategoria_id !== subElegida.id) return false;
    return true;
  });

  function elegirCategoria(cat) {
    navigate(cat ? `/tienda/${cat.slug}` : '/tienda');
  }

  const planesDe = id => planes.filter(pl => pl.producto_id === id);

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-headline font-black text-3xl sm:text-4xl text-on-surface">
            {catElegida ? catElegida.nombre : 'Todo para tu taller de moldería'}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-2xl">
            {catElegida?.descripcion
              || 'Pizarras digitalizadoras, plotters de tizada, papel, equipos y accesorios. Envío a todo el país.'}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Filtros
          opciones={categorias}
          activo={catElegida}
          onElegir={elegirCategoria}
          etiquetaTodo="Todo"
        />

        {subsDeCategoria.length > 0 && (
          <Filtros
            opciones={subsDeCategoria}
            activo={subElegida}
            onElegir={sub => setSubElegidaId(sub?.id ?? null)}
            etiquetaTodo={`Todo en ${catElegida.nombre}`}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
          </div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 space-y-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl block">search_off</span>
            <p className="font-bold">No hay productos en esta sección por el momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibles.map(p => (
              <ProductoCard key={p.id} producto={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}

        {/* Lo que no se vende por acá pero la gente busca igual */}
        <div className="grid sm:grid-cols-2 gap-4 pt-6 border-t border-outline-variant/15">
          <Link to="/moldes" className="flex items-start gap-4 p-5 rounded-2xl border border-outline-variant/20 hover:border-primary/40 bg-surface-container/40 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl shrink-0">straighten</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Moldes Audaces</p>
              <p className="text-sm text-on-surface-variant mt-1">Moldes digitales listos para imprimir y tizar.</p>
            </div>
          </Link>
          <Link to="/inscripcion" className="flex items-start gap-4 p-5 rounded-2xl border border-outline-variant/20 hover:border-secondary/40 bg-surface-container/40 transition-all">
            <span className="material-symbols-outlined text-secondary text-3xl shrink-0">school</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Curso de Moldería Digital</p>
              <p className="text-sm text-on-surface-variant mt-1">Aprendé a crear, modificar y escalar moldes con Audaces.</p>
            </div>
          </Link>
        </div>
      </div>

      {selected && (
        <ProductoCompraModal
          producto={selected}
          planes={planesDe(selected.id)}
          settings={settings}
          retorno="/tienda"
          onClose={() => setSelected(null)}
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
