import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { registrarAuditoria } from '../../utils/auditoria';

// Administra los links de la navbar pública (tabla `nav_items`).
//
// Navbar.jsx tiene los links de hoy hardcodeados como FALLBACK: si esta tabla
// quedara vacía o Supabase no respondiera, el sitio sigue navegable. Por eso
// vaciar la lista desde acá no rompe nada, pero tampoco hace lo que uno espera:
// para sacar un link, ocultalo.

const FORM_INICIAL = {
  label: '', path: '', icono: 'link',
  visible: true, abre_en_nueva_pestana: false,
};

async function traerItems() {
  const { data } = await supabase
    .from('nav_items')
    .select('*, producto_categorias(nombre)')
    .is('eliminado_en', null)
    .order('orden');
  return data || [];
}

export default function NavegacionPage() {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [moviendo,  setMoviendo]  = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    let vivo = true;
    traerItems().then(filas => {
      if (!vivo) return;
      setItems(filas);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, []);

  async function recargar() {
    setItems(await traerItems());
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_INICIAL);
    setError('');
    setShowModal(true);
  }

  function abrirEditar(item) {
    setEditando(item);
    setForm({
      label: item.label || '',
      path: item.path || '',
      icono: item.icono || 'link',
      visible: item.visible,
      abre_en_nueva_pestana: item.abre_en_nueva_pestana,
    });
    setError('');
    setShowModal(true);
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const path = form.path.trim();
      // Una ruta interna sin barra inicial ('tienda') el router la resuelve
      // relativa a la página actual y manda al usuario a cualquier lado.
      if (!/^https?:\/\//i.test(path) && !path.startsWith('/')) {
        setError('Una ruta interna tiene que empezar con "/". Ej: /tienda');
        return;
      }

      const payload = {
        label: form.label.trim(),
        path,
        icono: form.icono.trim() || 'link',
        visible: !!form.visible,
        abre_en_nueva_pestana: !!form.abre_en_nueva_pestana,
      };

      const { error: err } = editando
        ? await supabase.from('nav_items').update(payload).eq('id', editando.id)
        // Un link nuevo va al final: que aparezca en el medio de la barra
        // sorprende más de lo que ayuda.
        : await supabase.from('nav_items').insert({ ...payload, orden: items.length });

      if (err) { setError(err.message); return; }
      setShowModal(false);
      await recargar();
    } catch (ex) {
      setError(ex?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleVisible(item) {
    const visible = !item.visible;
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, visible } : x));

    const { error: err } = await supabase
      .from('nav_items')
      .update({ visible })
      .eq('id', item.id);
    if (err) { alert(err.message); await recargar(); return; }

    // Si el link es el de una categoría, la categoría tiene que enterarse: si
    // no, el panel de Productos seguiría mostrándola como "En el navbar"
    // mientras el link está oculto. Un solo dato, una sola verdad.
    if (item.categoria_id) {
      await supabase
        .from('producto_categorias')
        .update({ visible_en_navbar: visible })
        .eq('id', item.categoria_id);
    }
  }

  // Mueve una fila y renumera toda la lista por posición. Renumerar evita el
  // caso feo de dos filas con el mismo `orden`, donde el intercambio no se
  // nota porque quedan empatadas.
  async function mover(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length || moviendo) return;

    const lista = [...items];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    const conOrden = lista.map((x, idx) => ({ ...x, orden: idx }));

    const previos = new Map(items.map(x => [x.id, x.orden]));
    const cambios = conOrden.filter(x => previos.get(x.id) !== x.orden);

    setItems(conOrden);
    setMoviendo(true);
    const resultados = await Promise.all(cambios.map(x =>
      supabase.from('nav_items').update({ orden: x.orden }).eq('id', x.id)
    ));
    setMoviendo(false);

    const fallo = resultados.find(r => r.error);
    if (fallo) { alert(fallo.error.message); await recargar(); }
  }

  async function eliminar(item) {
    if (!confirm(
      `¿Enviar "${item.label}" a la papelera?\n\n` +
      `Si solo querés sacarlo de la barra por un tiempo, usá el ojo para ocultarlo: ` +
      `así conserva su posición.`
    )) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('nav_items').update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: user?.id,
      eliminado_por_email: user?.email,
    }).eq('id', item.id);
    if (err) { alert(err.message); return; }
    await registrarAuditoria({
      tabla: 'nav_items', registroId: item.id, accion: 'eliminacion',
      descripcion: `Link "${item.label}" (${item.path}) enviado a papelera`,
      datosAnteriores: item,
    });
    await recargar();
  }

  if (loading) {
    return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;
  }

  const visibles = items.filter(i => i.visible).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-bold">Navegación</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Los links de la barra superior del sitio público. {visibles} de {items.length} visibles.
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary text-sm py-2 px-4">
          <span className="material-symbols-outlined text-base align-middle mr-1">add</span>Nuevo link
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${
            item.visible ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-60'
          }`}>
            <div className="flex flex-col shrink-0">
              <button onClick={() => mover(i, -1)} disabled={i === 0 || moviendo} title="Subir"
                className="p-0.5 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:hover:bg-transparent">
                <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
              </button>
              <button onClick={() => mover(i, 1)} disabled={i === items.length - 1 || moviendo} title="Bajar"
                className="p-0.5 rounded hover:bg-surface-variant text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:hover:bg-transparent">
                <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
              </button>
            </div>

            <span className="material-symbols-outlined text-on-surface-variant shrink-0">{item.icono || 'link'}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm">{item.label}</p>
                {item.producto_categorias?.nombre && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary rounded-full px-2 py-0.5">
                    {item.producto_categorias.nombre}
                  </span>
                )}
                {item.abre_en_nueva_pestana && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-variant text-on-surface-variant rounded-full px-2 py-0.5">
                    Nueva pestaña
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-mono truncate">{item.path}</p>
            </div>

            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => toggleVisible(item)} title={item.visible ? 'Ocultar del navbar' : 'Mostrar en el navbar'}
                className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">{item.visible ? 'visibility' : 'visibility_off'}</span>
              </button>
              <button onClick={() => abrirEditar(item)}
                className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button onClick={() => eliminar(item)}
                className="p-1.5 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block">menu</span>
            <p className="text-on-surface-variant">Sin links cargados</p>
            <p className="text-xs text-on-surface-variant">
              El sitio está mostrando los links de respaldo que tiene el código.
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={handleGuardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editando ? 'Editar link' : 'Nuevo link'}</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Texto *</label>
              <input type="text" required value={form.label} className="input-field" placeholder="Ej: Plotters"
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Destino *</label>
              <input type="text" required value={form.path} className="input-field font-mono text-sm"
                placeholder="/tienda/plotters"
                onChange={e => setForm(f => ({ ...f, path: e.target.value }))} />
              <p className="text-xs text-on-surface-variant mt-1">
                Una ruta del sitio empieza con “/”. También se puede poner una dirección
                completa (https://…) para mandar a otro lado.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Ícono</label>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-primary">{form.icono || 'link'}</span>
                <input type="text" value={form.icono} className="input-field font-mono text-sm" placeholder="print"
                  onChange={e => setForm(f => ({ ...f, icono: e.target.value }))} />
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Nombre de un ícono de Material Symbols (home, storefront, print, draw…).
                Se ve solo en el menú del celular.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, visible: !f.visible }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.visible ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.visible ? 'Visible en el navbar' : 'Oculto'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, abre_en_nueva_pestana: !f.abre_en_nueva_pestana }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.abre_en_nueva_pestana ? 'bg-secondary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.abre_en_nueva_pestana ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">
                  {form.abre_en_nueva_pestana ? 'Abre en una pestaña nueva' : 'Abre en la misma pestaña'}
                </span>
              </label>
            </div>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear link'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
