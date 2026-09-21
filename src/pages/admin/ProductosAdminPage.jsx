import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { registrarAuditoria } from '../../utils/auditoria';
import { imgUrl, uploadImagen } from '../../utils/imagenesProducto';
import SlotImagen from '../../components/SlotImagen';

// Catálogo completo: categorías, subcategorías y productos de cualquier tipo.
//
// /admin/pizarras sigue existiendo como sector propio de la pizarra (sus planes,
// sus créditos, sus ventas). Los datos son los mismos: una sola tabla
// `productos`. Acá se ve todo junto; allá, solo lo de pizarras.
//
// Las ventas de TODOS los productos se siguen aprobando desde
// /admin/pizarras → Ventas, que nunca filtró por categoría.

function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }

// ════════════════════════════════════════════════════════════════
// TAB CATEGORÍAS
// ════════════════════════════════════════════════════════════════

const CAT_INICIAL = {
  nombre: '', slug: '', icono: 'category', color: 'text-primary',
  descripcion: '', orden: 0, activo: true,
};

const SUB_INICIAL = { categoria_id: '', nombre: '', slug: '', icono: 'label', orden: 0, activo: true };

// "Papel para plotter 90cm" → "papel-para-plotter-90cm". El slug arma la URL
// (/tienda/plotters), así que no puede tener espacios ni acentos.
function aSlug(texto) {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function TabCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [subs,       setSubs]       = useState([]);
  const [conteo,     setConteo]     = useState({});   // categoria_id → productos visibles
  const [loading,    setLoading]    = useState(true);

  const [modal,     setModal]     = useState(null); // 'categoria' | 'subcategoria'
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(CAT_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  async function cargar() {
    const [{ data: cats }, { data: subcats }, { data: prods }] = await Promise.all([
      supabase.from('producto_categorias').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('producto_subcategorias').select('*').is('eliminado_en', null).order('orden'),
      // Solo para saber qué categorías tienen algo que mostrar.
      supabase.from('productos').select('categoria_id').eq('activo', true).is('eliminado_en', null),
    ]);
    setCategorias(cats || []);
    setSubs(subcats || []);
    setConteo((prods || []).reduce((acc, p) => {
      acc[p.categoria_id] = (acc[p.categoria_id] || 0) + 1;
      return acc;
    }, {}));
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  // El switch del navbar escribe en dos lados: la categoría y su fila de
  // nav_items. Si solo tocara la categoría, el link no aparecería nunca, porque
  // la navbar lee de nav_items.
  async function toggleNavbar(cat) {
    const visible = !cat.visible_en_navbar;

    // Un link a una categoría vacía lleva al cliente a una página que dice
    // "no hay productos". Mejor avisarlo acá que descubrirlo en producción.
    if (visible && !conteo[cat.id] && !confirm(
      `"${cat.nombre}" no tiene productos visibles todavía.

` +
      `Si la mostrás en el navbar, el link va a llevar a una sección vacía. ` +
      `¿Mostrarla igual?`
    )) return;

    setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, visible_en_navbar: visible } : c));

    const { error: errCat } = await supabase
      .from('producto_categorias')
      .update({ visible_en_navbar: visible })
      .eq('id', cat.id);
    if (errCat) { alert(errCat.message); await cargar(); return; }

    const { data: item } = await supabase
      .from('nav_items').select('id')
      .eq('categoria_id', cat.id).is('eliminado_en', null)
      .maybeSingle();

    if (item) {
      await supabase.from('nav_items').update({ visible }).eq('id', item.id);
    } else if (visible) {
      // Todavía no tenía link: se crea al final de la barra.
      const { data: ultimo } = await supabase
        .from('nav_items').select('orden')
        .is('eliminado_en', null).order('orden', { ascending: false })
        .limit(1).maybeSingle();
      await supabase.from('nav_items').insert({
        label: cat.nombre,
        path: `/tienda/${cat.slug}`,
        icono: cat.icono,
        categoria_id: cat.id,
        visible: true,
        orden: (ultimo?.orden ?? 0) + 1,
      });
    }
  }

  function abrirCategoria(cat) {
    setEditando(cat);
    setForm(cat ? {
      nombre: cat.nombre, slug: cat.slug, icono: cat.icono, color: cat.color,
      descripcion: cat.descripcion || '', orden: cat.orden, activo: cat.activo,
    } : CAT_INICIAL);
    setError('');
    setModal('categoria');
  }

  function abrirSub(sub, categoriaId) {
    setEditando(sub);
    setForm(sub ? {
      categoria_id: sub.categoria_id, nombre: sub.nombre, slug: sub.slug,
      icono: sub.icono, orden: sub.orden, activo: sub.activo,
    } : { ...SUB_INICIAL, categoria_id: categoriaId || categorias[0]?.id || '' });
    setError('');
    setModal('subcategoria');
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const slug = aSlug(form.slug || form.nombre);
      if (!slug) { setError('Poné un nombre válido'); return; }

      const tabla = modal === 'categoria' ? 'producto_categorias' : 'producto_subcategorias';
      const payload = modal === 'categoria'
        ? {
            nombre: form.nombre.trim(), slug, icono: form.icono.trim() || 'category',
            color: form.color || 'text-primary', descripcion: form.descripcion.trim() || null,
            orden: Number(form.orden) || 0, activo: !!form.activo,
          }
        : {
            categoria_id: form.categoria_id, nombre: form.nombre.trim(), slug,
            icono: form.icono.trim() || 'label',
            orden: Number(form.orden) || 0, activo: !!form.activo,
          };

      const { error: err } = editando
        ? await supabase.from(tabla).update(payload).eq('id', editando.id)
        : await supabase.from(tabla).insert(payload);

      if (err) {
        // El slug es único: el choque es el error más probable acá.
        setError(err.code === '23505' ? 'Ya existe otra con ese nombre' : err.message);
        return;
      }
      setModal(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(fila, tabla, etiqueta) {
    if (!confirm(`¿Enviar "${fila.nombre}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from(tabla).update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', fila.id);
    if (err) { alert(err.message); return; }
    await registrarAuditoria({
      tabla, registroId: fila.id, accion: 'eliminacion',
      descripcion: `${etiqueta} "${fila.nombre}" enviada a papelera`, datosAnteriores: fila,
    });
    await cargar();
  }

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-on-surface-variant">
          Las categorías arman las secciones de la tienda; las subcategorías, los filtros de adentro.
        </p>
        <button onClick={() => abrirCategoria(null)} className="btn-primary text-sm py-2 px-4">
          <span className="material-symbols-outlined text-base align-middle mr-1">add</span>Nueva categoría
        </button>
      </div>

      <div className="space-y-3">
        {categorias.map(cat => {
          const misSubs = subs.filter(s => s.categoria_id === cat.id);
          return (
            <div key={cat.id} className={`rounded-2xl border p-3 space-y-2 ${cat.activo ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined ${cat.color || 'text-primary'}`}>{cat.icono}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{cat.nombre}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    <span className="font-mono">/tienda/{cat.slug}</span>
                    {' · '}
                    <span className={conteo[cat.id] ? '' : 'text-error font-bold'}>
                      {conteo[cat.id] || 0} producto{conteo[cat.id] === 1 ? '' : 's'}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => toggleNavbar(cat)}
                  title={cat.visible_en_navbar ? 'Sacar del navbar' : 'Mostrar en el navbar'}
                  className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 border transition-all shrink-0 ${
                    cat.visible_en_navbar
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  {cat.visible_en_navbar ? 'En el navbar' : 'Fuera del navbar'}
                </button>

                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => abrirSub(null, cat.id)} title="Agregar subcategoría"
                    className="p-1.5 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                  <button onClick={() => abrirCategoria(cat)}
                    className="p-1.5 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button onClick={() => eliminar(cat, 'producto_categorias', 'Categoría')}
                    className="p-1.5 hover:bg-error/10 rounded-lg text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {misSubs.length > 0 && (
                <div className="pl-8 space-y-1">
                  {misSubs.map(sub => (
                    <div key={sub.id} className={`flex items-center gap-2 text-sm py-1 ${sub.activo ? '' : 'opacity-50'}`}>
                      <span className="material-symbols-outlined text-base text-on-surface-variant">{sub.icono}</span>
                      <span className="flex-1 min-w-0 truncate">{sub.nombre}</span>
                      <button onClick={() => abrirSub(sub)}
                        className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-on-surface">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => eliminar(sub, 'producto_subcategorias', 'Subcategoría')}
                        className="p-1 hover:bg-error/10 rounded text-on-surface-variant hover:text-error">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={guardar}
            className="bg-surface-container w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">
                {editando ? 'Editar' : 'Nueva'} {modal === 'categoria' ? 'categoría' : 'subcategoría'}
              </h3>
              <button type="button" onClick={() => setModal(null)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {modal === 'subcategoria' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría *</label>
                <select required value={form.categoria_id} className="input-field"
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                  <option value="">Elegí la categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre *</label>
              <input type="text" required value={form.nombre} className="input-field"
                placeholder={modal === 'categoria' ? 'Ej: Plotters' : 'Ej: Papel 90 cm'}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              <p className="text-xs text-on-surface-variant mt-1">
                Dirección: <span className="font-mono">{aSlug(form.slug || form.nombre) || '…'}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Ícono</label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-primary">{form.icono}</span>
                  <input type="text" value={form.icono} className="input-field font-mono text-sm"
                    onChange={e => setForm(f => ({ ...f, icono: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={form.orden} className="input-field"
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>

            {modal === 'categoria' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Bajada</label>
                <textarea value={form.descripcion} rows={2} className="input-field resize-none"
                  placeholder="Se muestra arriba de la sección en la tienda"
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer py-1">
              <div onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium">{form.activo ? 'Visible en la tienda' : 'Oculta'}</span>
            </label>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB PRODUCTOS
// ════════════════════════════════════════════════════════════════

const PROD_INICIAL = {
  titulo: '', descripcion: '', especificaciones: '',
  categoria_id: '', subcategoria_id: '',
  precio: '0', stock: '1', orden: 0, activo: true, requiere_envio: true,
  peso_kg: '1', alto_cm: '10', ancho_cm: '20', largo_cm: '30',
};

function TabProductos() {
  const [productos,  setProductos]  = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subs,       setSubs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtroCat,  setFiltroCat]  = useState('todas');

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(PROD_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');
  const [imgs,      setImgs]      = useState([null, null, null]);

  async function cargar() {
    const [{ data: prods }, { data: cats }, { data: subcats }] = await Promise.all([
      supabase.from('productos').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('producto_categorias').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('producto_subcategorias').select('*').is('eliminado_en', null).order('orden'),
    ]);
    setProductos(prods || []);
    setCategorias(cats || []);
    setSubs(subcats || []);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  // Solo se guarda el archivo: la compresión y la subida se hacen al guardar.
  function setImgSlot(i, file) {
    setImgs(prev => { const n = [...prev]; n[i] = file; return n; });
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...PROD_INICIAL, categoria_id: categorias[0]?.id || '' });
    setImgs([null, null, null]);
    setError('');
    setShowModal(true);
  }

  function abrirEditar(p) {
    setEditando(p);
    setForm({
      titulo: p.titulo || '', descripcion: p.descripcion || '', especificaciones: p.especificaciones || '',
      categoria_id: p.categoria_id || '', subcategoria_id: p.subcategoria_id || '',
      precio: String(p.precio ?? '0'), stock: String(p.stock ?? '0'),
      orden: p.orden ?? 0, activo: p.activo, requiere_envio: p.requiere_envio !== false,
      peso_kg: String(p.peso_kg ?? '1'), alto_cm: String(p.alto_cm ?? '10'),
      ancho_cm: String(p.ancho_cm ?? '20'), largo_cm: String(p.largo_cm ?? '30'),
    });
    setImgs([null, null, null]);
    setError('');
    setShowModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (!form.categoria_id) { setError('Elegí una categoría'); return; }

      const id = editando?.id || crypto.randomUUID();
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        especificaciones: form.especificaciones.trim() || null,
        categoria_id: form.categoria_id,
        subcategoria_id: form.subcategoria_id || null,
        precio: Number(form.precio) || 0,
        stock: Number(form.stock) || 0,
        orden: Number(form.orden) || 0,
        activo: !!form.activo,
        requiere_envio: !!form.requiere_envio,
        peso_kg: Number(form.peso_kg) || 0,
        alto_cm: Number(form.alto_cm) || 0,
        ancho_cm: Number(form.ancho_cm) || 0,
        largo_cm: Number(form.largo_cm) || 0,
      };

      // Las imágenes se suben recién ahora: si el formulario tenía un error, no
      // dejamos archivos sueltos en el bucket.
      //
      // La carpeta del storage sale del slug de la categoría elegida. Si el
      // producto cambia de categoría más adelante, las fotos viejas quedan en
      // la carpeta anterior: siguen sirviéndose igual (el path está guardado
      // en la fila) y se reacomodan solas cuando las vuelvas a subir.
      const slugCat = categorias.find(c => c.id === form.categoria_id)?.slug;
      for (let i = 0; i < 3; i++) {
        if (!imgs[i]) continue;
        const { imagen_path, thumb_path } = await uploadImagen(imgs[i], id, i + 1, slugCat);
        payload[`imagen_${i + 1}_path`] = imagen_path;
        payload[`thumb_${i + 1}_path`]  = thumb_path;
      }

      const { error: err } = editando
        ? await supabase.from('productos').update(payload).eq('id', id)
        : await supabase.from('productos').insert({ id, ...payload });

      if (err) { setError(err.message); return; }
      setShowModal(false);
      await cargar();
    } catch (ex) {
      setError(ex?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(p) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    setProductos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !p.activo } : x));
  }

  async function eliminar(p) {
    if (!confirm(`¿Enviar "${p.titulo}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('productos').update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', p.id);
    await registrarAuditoria({
      tabla: 'productos', registroId: p.id, accion: 'eliminacion',
      descripcion: `Producto "${p.titulo}" enviado a papelera`, datosAnteriores: p,
    });
    setProductos(prev => prev.filter(x => x.id !== p.id));
  }

  const nombreCat = id => categorias.find(c => c.id === id)?.nombre;
  const nombreSub = id => subs.find(s => s.id === id)?.nombre;
  const subsDelForm = subs.filter(s => s.categoria_id === form.categoria_id);
  const visibles = productos.filter(p => filtroCat === 'todas' || p.categoria_id === filtroCat);

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFiltroCat('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
              filtroCat === 'todas' ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
            }`}>
            Todas ({productos.length})
          </button>
          {categorias.map(c => (
            <button key={c.id} onClick={() => setFiltroCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                filtroCat === c.id ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
              }`}>
              {c.nombre} ({productos.filter(p => p.categoria_id === c.id).length})
            </button>
          ))}
        </div>
        <button onClick={abrirNuevo} disabled={!categorias.length} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
          <span className="material-symbols-outlined text-base align-middle mr-1">add</span>Nuevo producto
        </button>
      </div>

      <div className="space-y-2">
        {visibles.map(p => (
          <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
            p.activo ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-60'
          }`}>
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-variant shrink-0 flex items-center justify-center">
              {imgUrl(p.thumb_1_path || p.imagen_1_path)
                ? <img src={imgUrl(p.thumb_1_path || p.imagen_1_path)} alt="" className="w-full h-full object-cover" />
                : <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl">inventory_2</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.titulo}</p>
              <p className="text-xs text-on-surface-variant truncate">
                {nombreCat(p.categoria_id) || 'Sin categoría'}
                {nombreSub(p.subcategoria_id) ? ` · ${nombreSub(p.subcategoria_id)}` : ''}
                {' · '}Stock: {p.stock}
              </p>
              <p className="text-sm font-headline font-bold text-primary">${fmt(p.precio)}</p>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => toggleActivo(p)} title={p.activo ? 'Ocultar' : 'Mostrar'}
                className="p-1.5 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">{p.activo ? 'visibility' : 'visibility_off'}</span>
              </button>
              <button onClick={() => abrirEditar(p)}
                className="p-1.5 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button onClick={() => eliminar(p)}
                className="p-1.5 hover:bg-error/10 rounded-lg text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
        ))}

        {visibles.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">inventory_2</span>
            <p className="text-on-surface-variant">Sin productos en esta categoría</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={guardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-outline-variant/30 sm:my-4 max-h-[95dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-outline-variant/15 shrink-0">
              <div className="min-w-0">
                <h3 className="font-headline font-bold text-lg">{editando ? 'Editar producto' : 'Nuevo producto'}</h3>
                {editando && (
                  <p className="text-xs text-on-surface-variant truncate">
                    Hoy está en: {nombreCat(form.categoria_id) || 'sin categoría'}
                    {nombreSub(form.subcategoria_id) ? ` · ${nombreSub(form.subcategoria_id)}` : ''}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría *</label>
                <select required value={form.categoria_id} className="input-field"
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value, subcategoria_id: '' }))}>
                  <option value="">Elegí</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Subcategoría</label>
                <select value={form.subcategoria_id} className="input-field" disabled={!subsDelForm.length}
                  onChange={e => setForm(f => ({ ...f, subcategoria_id: e.target.value }))}>
                  <option value="">{subsDelForm.length ? 'Sin subcategoría' : 'No tiene'}</option>
                  {subsDelForm.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Título *</label>
              <input type="text" required value={form.titulo} className="input-field"
                placeholder="Ej: Plotter de tizada 1.80 m"
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción</label>
              <textarea value={form.descripcion} rows={3} className="input-field resize-none"
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Especificaciones (una por línea)</label>
              <textarea value={form.especificaciones} rows={3} className="input-field resize-none font-mono text-sm"
                onChange={e => setForm(f => ({ ...f, especificaciones: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Precio *</label>
                <input type="number" min={0} step={100} value={form.precio} className="input-field"
                  onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Stock</label>
                <input type="number" min={0} value={form.stock} className="input-field"
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={form.orden} className="input-field"
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Peso y dimensiones del paquete (para cotizar el envío)
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[['peso_kg', 'Peso (kg)'], ['largo_cm', 'Largo (cm)'], ['ancho_cm', 'Ancho (cm)'], ['alto_cm', 'Alto (cm)']].map(([campo, label]) => (
                  <div key={campo}>
                    <label className="text-[10px] text-on-surface-variant block mb-1">{label}</label>
                    <input type="number" min={0} step={0.1} value={form[campo]} className="input-field"
                      onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Imágenes (máx 3) — se comprimen automáticamente
              </label>
              <div className="flex gap-4">
                {[0, 1, 2].map(i => (
                  <SlotImagen
                    key={i}
                    label={i === 0 ? 'Portada *' : `Imagen ${i + 1}`}
                    valor={editando ? [editando.imagen_1_path, editando.imagen_2_path, editando.imagen_3_path][i] : null}
                    onChange={file => setImgSlot(i, file)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, requiere_envio: !f.requiere_envio }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.requiere_envio ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiere_envio ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.requiere_envio ? 'Se despacha (pide dirección)' : 'Sin envío'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.activo ? 'Visible en la tienda' : 'Oculto'}</span>
              </label>
            </div>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/15 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB STOCK
// ════════════════════════════════════════════════════════════════

// `productos.stock` es el número de hoy; esto es el porqué de cada cambio.
// Las salidas por venta las escribe api/producto-admin.js al aprobar; acá se
// cargan las entradas de mercadería y los ajustes por conteo.
//
// Los tres movimientos pasan SIEMPRE por fn_registrar_movimiento_stock: mueve
// el stock e inserta el registro en la misma transacción. Si se hicieran los
// dos writes desde acá y el segundo fallara, el historial mentiría.

// Las clases van escritas enteras y nunca armadas con template literals:
// Tailwind escanea el texto del archivo, así que un `hover:${t.color}` genera
// un string que el compilador nunca ve y la clase no llega al CSS.
const TIPOS_MOV = {
  entrada: {
    label: 'Entrada', icon: 'add_box', signo: '+',
    color: 'text-green-400', bg: 'bg-green-400/10', hover: 'hover:text-green-400',
  },
  salida: {
    label: 'Salida', icon: 'indeterminate_check_box', signo: '−',
    color: 'text-error', bg: 'bg-error/10', hover: 'hover:text-error',
  },
  ajuste: {
    label: 'Ajuste', icon: 'tune', signo: '=',
    color: 'text-amber-400', bg: 'bg-amber-400/10', hover: 'hover:text-amber-400',
  },
};

const MOV_INICIAL = { producto_id: '', tipo: 'entrada', cantidad: '1', motivo: '' };

function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function TabStock() {
  const [productos,   setProductos]   = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filtroProd,  setFiltroProd]  = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState(MOV_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  async function cargar() {
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('productos').select('id, titulo, stock, imagen_1_path, activo')
        .is('eliminado_en', null).order('orden'),
      // Un historial largo no se lee: se mira lo último y se filtra por producto.
      supabase.from('movimientos_stock').select('*')
        .is('eliminado_en', null).order('creado_en', { ascending: false }).limit(200),
    ]);
    setProductos(prods || []);
    setMovimientos(movs || []);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirMovimiento(producto, tipo) {
    setForm({
      producto_id: producto.id,
      tipo,
      // En un ajuste se escribe el stock que quedó, no la diferencia: el
      // número que el admin acaba de contar. Arranca en el actual.
      cantidad: tipo === 'ajuste' ? String(producto.stock ?? 0) : '1',
      motivo: '',
    });
    setError('');
    setShowModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const cantidad = Number(form.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 0) {
        setError('La cantidad tiene que ser un número entero de 0 o más');
        return;
      }
      if (cantidad === 0 && form.tipo !== 'ajuste') {
        setError('Una entrada o una salida de 0 unidades no registra nada');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: err } = await supabase.rpc('fn_registrar_movimiento_stock', {
        p_producto_id:      form.producto_id,
        p_tipo:             form.tipo,
        p_cantidad:         cantidad,
        p_motivo:           form.motivo.trim() || null,
        p_compra_id:        null,
        p_creado_por:       user?.id || null,
        p_creado_por_email: user?.email || null,
      });
      if (err) { setError(err.message); return; }

      const prod = productos.find(p => p.id === form.producto_id);
      await registrarAuditoria({
        tabla: 'movimientos_stock', registroId: data?.id || form.producto_id, accion: 'creacion',
        descripcion: `${TIPOS_MOV[form.tipo].label} de ${cantidad} en "${prod?.titulo || 'producto'}" → stock ${data?.stock_resultante ?? '?'}`,
        datosNuevos: data,
      });

      setShowModal(false);
      await cargar();
    } catch (ex) {
      setError(ex?.message || 'Error al registrar el movimiento');
    } finally {
      setGuardando(false);
    }
  }

  // Borrar el registro NO devuelve el stock: el movimiento ya ocurrió en el
  // mundo real. Si el número quedó mal, se corrige con un ajuste.
  async function eliminar(mov) {
    const prod = productos.find(p => p.id === mov.producto_id);
    if (!confirm(
      `¿Enviar este movimiento a la papelera?\n\n` +
      `${TIPOS_MOV[mov.tipo]?.label} de ${mov.cantidad} en "${prod?.titulo || 'producto'}".\n\n` +
      `El stock actual NO cambia: si quedó mal, corregilo con un ajuste.`
    )) return;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('movimientos_stock').update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', mov.id);
    await registrarAuditoria({
      tabla: 'movimientos_stock', registroId: mov.id, accion: 'eliminacion',
      descripcion: `Movimiento de stock enviado a papelera — ${prod?.titulo || 'producto'}`,
      datosAnteriores: mov,
    });
    setMovimientos(prev => prev.filter(m => m.id !== mov.id));
  }

  const tituloProd = id => productos.find(p => p.id === id)?.titulo || 'Producto eliminado';
  const visibles = movimientos.filter(m => filtroProd === 'todos' || m.producto_id === filtroProd);
  const productoDelForm = productos.find(p => p.id === form.producto_id);

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-6">
      {/* ── Stock actual, con los tres botones por producto ── */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Stock actual</h2>

        {productos.map(p => (
          <div key={p.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
            p.activo ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-60'
          }`}>
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface-variant shrink-0 flex items-center justify-center">
              {imgUrl(p.thumb_1_path || p.imagen_1_path)
                ? <img src={imgUrl(p.thumb_1_path || p.imagen_1_path)} alt="" className="w-full h-full object-cover" />
                : <span className="material-symbols-outlined text-on-surface-variant/30 text-xl">inventory_2</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.titulo}</p>
              <p className={`text-xs font-bold ${
                p.stock > 0 ? 'text-on-surface-variant' : 'text-error'
              }`}>
                {p.stock > 0 ? `${p.stock} en stock` : 'Sin stock'}
              </p>
            </div>
            <div className="flex gap-0.5 shrink-0">
              {Object.entries(TIPOS_MOV).map(([tipo, t]) => (
                <button key={tipo} onClick={() => abrirMovimiento(p, tipo)} title={t.label}
                  className={`p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant ${t.hover}`}>
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {productos.length === 0 && (
          <div className="text-center py-10">
            <p className="text-on-surface-variant text-sm">Cargá un producto para empezar a mover stock</p>
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Historial</h2>
          <select value={filtroProd} onChange={e => setFiltroProd(e.target.value)}
            className="input-field text-sm py-1.5 max-w-[16rem]">
            <option value="todos">Todos los productos</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {visibles.map(m => {
            const t = TIPOS_MOV[m.tipo] || TIPOS_MOV.ajuste;
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl border border-outline-variant/20">
                <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${t.bg}`}>
                  <span className={`material-symbols-outlined text-lg ${t.color}`}>{t.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    <span className={t.color}>{t.signo}{m.cantidad}</span>
                    {' · '}{tituloProd(m.producto_id)}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {t.label} · queda {m.stock_resultante}
                    {m.motivo ? ` · ${m.motivo}` : ''}
                    {m.compra_id ? ' · por venta' : ''}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70">
                    {fechaCorta(m.creado_en)}{m.creado_por_email ? ` · ${m.creado_por_email}` : ''}
                  </p>
                </div>
                <button onClick={() => eliminar(m)} title="Enviar a la papelera"
                  className="p-1.5 hover:bg-error/10 rounded-lg text-on-surface-variant hover:text-error shrink-0">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            );
          })}

          {visibles.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">history</span>
              <p className="text-on-surface-variant">Todavía no hay movimientos registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={guardar} className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15 shrink-0">
              <h3 className="font-headline font-bold">
                {TIPOS_MOV[form.tipo].label} de stock
              </h3>
              <button type="button" onClick={() => setShowModal(false)}
                className="p-1 hover:bg-surface-variant rounded-lg text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Producto</label>
                <select value={form.producto_id} required
                  onChange={e => {
                    const p = productos.find(x => x.id === e.target.value);
                    setForm(f => ({
                      ...f,
                      producto_id: e.target.value,
                      cantidad: f.tipo === 'ajuste' ? String(p?.stock ?? 0) : f.cantidad,
                    }));
                  }}
                  className="input-field">
                  <option value="">Elegí un producto</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.titulo} (stock {p.stock})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TIPOS_MOV).map(([tipo, t]) => (
                    <button key={tipo} type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        tipo,
                        cantidad: tipo === 'ajuste' ? String(productoDelForm?.stock ?? 0) : '1',
                      }))}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        form.tipo === tipo
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
                      }`}>
                      <span className="material-symbols-outlined text-lg">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  {form.tipo === 'ajuste' ? 'El stock queda en' : 'Cantidad'}
                </label>
                <input type="number" min={form.tipo === 'ajuste' ? 0 : 1} step="1" required
                  value={form.cantidad}
                  onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                  className="input-field" />
                <p className="text-xs text-on-surface-variant mt-1">
                  {form.tipo === 'entrada' && 'Mercadería que entra al depósito: se suma al stock.'}
                  {form.tipo === 'salida'  && 'Unidades que salen sin venta (rotura, regalo, muestra). El stock nunca baja de 0.'}
                  {form.tipo === 'ajuste'  && 'Conteo físico: el stock pasa a ser exactamente este número.'}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Motivo (opcional)</label>
                <input type="text" value={form.motivo} maxLength={200}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder={form.tipo === 'entrada' ? 'Compra al proveedor' : form.tipo === 'salida' ? 'Rotura en depósito' : 'Conteo de fin de mes'}
                  className="input-field" />
              </div>

              {productoDelForm && (
                <div className="bg-surface-variant/40 rounded-xl px-3 py-2.5 text-sm">
                  Stock <strong>{productoDelForm.stock}</strong>
                  <span className="mx-2 text-on-surface-variant">→</span>
                  <strong className="text-primary">
                    {form.tipo === 'entrada' ? (productoDelForm.stock || 0) + (Number(form.cantidad) || 0)
                      : form.tipo === 'salida' ? Math.max(0, (productoDelForm.stock || 0) - (Number(form.cantidad) || 0))
                      : (Number(form.cantidad) || 0)}
                  </strong>
                </div>
              )}

              {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/15 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando || !form.producto_id} className="btn-primary flex-1 disabled:opacity-50">
                {guardando ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PÁGINA
// ════════════════════════════════════════════════════════════════

export default function ProductosAdminPage() {
  const [tab, setTab] = useState('productos');

  const TABS = [
    { key: 'productos',  label: 'Productos',  icon: 'inventory_2' },
    { key: 'categorias', label: 'Categorías', icon: 'category' },
    { key: 'stock',      label: 'Stock',      icon: 'inventory' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline text-2xl font-bold">Productos</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Todo el catálogo de la tienda. Las ventas se aprueban en Pizarras → Ventas.
        </p>
      </div>

      <div className="flex gap-1 border-b border-outline-variant/20">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-all border-b-2 ${
              tab === t.key
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
            }`}>
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'productos'  && <TabProductos />}
      {tab === 'categorias' && <TabCategorias />}
      {tab === 'stock'      && <TabStock />}
    </div>
  );
}
